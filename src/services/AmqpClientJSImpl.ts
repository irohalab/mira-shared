/*
 * Copyright 2022 IROHA LAB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RabbitMQService } from './RabbitMQService';
import { MQMessage } from '../domain/MQMessage';
import { inject, injectable } from 'inversify';
import { TYPES } from '../TYPES';
import { BaseConfigManager } from '../utils/BaseConfigManager';
import { BaseDatabaseService } from './BaseDatabaseService';
import { Sentry } from '../utils/Sentry';
import { AMQPBaseClient } from '@cloudamqp/amqp-client/types/amqp-base-client';
import { AMQPChannel, AMQPClient, AMQPConsumer, AMQPError, AMQPMessage, AMQPQueue } from '@cloudamqp/amqp-client';
import pino from 'pino';
import { Message } from '../entity/Message';
import { inspect } from 'util';

const logger = pino({
    timestamp: pino.stdTimeFunctions.isoTime
});

interface PublisherSetting {
    channel: AMQPChannel;
    exchangeType: string;
}

interface QueueSetting {
    bindingKey: string;
    exchangeName: string;
    exchangeType: string;
    prefetch: boolean;
    queueInstance: AMQPQueue;
}

interface Consumer {
    queueName: string;
    onMessage: (msg: MQMessage) => Promise<boolean>;
    consumer: AMQPConsumer;
}

const RESEND_INTERVAL = 5000;
const SAVE_MESSAGE_RETRY_INTERVAL = 60000;

/**
 * RabbitMQService implementation that use amqp-client.jss
 */
@injectable()
export class AmqpClientJSImpl implements RabbitMQService {
    private _publisherConnection: AMQPBaseClient;
    private _consumerConnection: AMQPBaseClient;

    // key: exchange name, value: PublisherSetting
    private publishers: Map<string, PublisherSetting>;

    // key: queue name, value: QueueSetting
    private queues: Map<string, QueueSetting>;

    // key: queue name, value: Consumer
    private consumers: Map<string, Consumer>;

    private resendMessageRepeatTimerId: NodeJS.Timeout;
    private saveMessageRetryTimerId: NodeJS.Timeout;

    private isReconnecting = false;

    constructor(@inject(TYPES.ConfigManager) private _configManager: BaseConfigManager,
                @inject(TYPES.DatabaseService) private _databaseService: BaseDatabaseService,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
        this.publishers = new Map<string, PublisherSetting>();
        this.queues = new Map<string, QueueSetting>();
        this.consumers = new Map<string, Consumer>();
    }

    private async connect(connectPublisher = true): Promise<void> {
        try {
            const client = new AMQPClient(this._configManager.amqpServerUrl());
            if (connectPublisher) {
                logger.info('connecting to amqp server for ' + (connectPublisher ? 'publishers': 'consumers'));
                this._publisherConnection = await client.connect();
                this._publisherConnection.onerror = (error) => {
                    logger.error(error);
                };
                // try resend message
                if (this.resendMessageRepeatTimerId) {
                    clearTimeout(this.resendMessageRepeatTimerId);
                }
                await this.resendMessage();
            } else {
                this._consumerConnection = await client.connect();
                this._consumerConnection.onerror = (error) => {
                    logger.error(error);
                };
            }
        } catch (error) {
            logger.error(inspect(error, {depth: 3}));
            logger.info('failed to connect to amqp server, will reconnect in 5s...');
            setTimeout(() => {
                this.connect(connectPublisher);
            }, 5000);
        }
    }

    public async consume(queueName: string, onMessage: (msg: MQMessage) => Promise<boolean>): Promise<string> {
        const queueSettings = this.queues.get(queueName);
        this.consumers.set(queueName, {
            onMessage,
            queueName,
            consumer: null
        });
        const consumer = await this.subscribeConsumer(queueSettings.queueInstance);
        if (consumer) {
            this.consumers.get(queueName).consumer = consumer;
            consumer.wait().then(() => {
                logger.info('consumer canceled by client');
            }).catch((err) => {
                logger.error(inspect(err, {depth: 3}));
                this.checkChannelStatus(consumer.channel);
            });
            return consumer.tag;
        }
    }

    private async subscribeConsumer(queue: AMQPQueue): Promise<AMQPConsumer> {
        const consumerSetting = this.consumers.get(queue.name);
        try {
            return await queue.subscribe({
                noAck: false,
                exclusive: false
            }, async (amqpMessage: AMQPMessage) => {
                try {
                    if (await consumerSetting.onMessage(JSON.parse(amqpMessage.bodyToString()))) {
                        await amqpMessage.ack();
                    }
                } catch (err) {
                    // this should not be enter
                    logger.error(err);
                    this._sentry.capture(err);
                }
            });
        } catch (error) {
            logger.error(inspect(error, {depth: 3}));
            await this.checkChannelStatus(consumerSetting.consumer.channel);
            return null;
        }
    }

    public async initConsumer(exchangeName: string, exchangeType: string, queueName: string, bindingKey: string, prefetch: boolean): Promise<void> {
        // init a queue
        if (!this._consumerConnection || this._consumerConnection.closed) {
            await this.connect(false);
        }
        try {
            const channel = await this._consumerConnection.channel();
            await channel.confirmSelect();
            await channel.exchangeDeclare(exchangeName, exchangeType, {
                autoDelete: false,
                durable: true,
                internal: false,
                passive: false
            });

            const queueInstance = await channel.queue(queueName, {
                autoDelete: false,
                durable: true,
                exclusive: false,
                passive: false
            });
            await queueInstance.bind(exchangeName, bindingKey);
            this.queues.set(queueName, {
                bindingKey,
                exchangeName,
                exchangeType,
                prefetch,
                queueInstance
            });
        } catch (error) {
            logger.error(inspect(error, {depth: 3}));
        }
    }

    public async initPublisher(exchangeName: string, exchangeType: string): Promise<void> {
        if (!this._publisherConnection || this._publisherConnection.closed) {
            await this.connect(true);
        }
        try {
            const channel = await this._publisherConnection.channel();
            await channel.confirmSelect();
            await channel.exchangeDeclare(exchangeName, exchangeType, {
                autoDelete: false,
                durable: true,
                internal: false,
                passive: false
            });
            this.publishers.set(exchangeName, {
                exchangeType,
                channel
            })
        } catch (error) {
            logger.error(inspect(error, {depth: 3}));
        }
    }

    public async publish(exchangeName: string, routingKey: string, message: any): Promise<boolean> {
        const publisher = this.publishers.get(exchangeName);
        try {
            await publisher.channel.basicPublish(exchangeName, routingKey, JSON.stringify(message));
        } catch (error) {
            // not ack
            logger.error(inspect(error, {depth: 3}));
            // this._sentry.capture(error);
            await this.saveMessage(exchangeName, routingKey, message);
            await this.checkChannelStatus(publisher.channel);
        }
        return true;
    }

    private async saveMessage(exchangeName: string, routingKey: string, content: any): Promise<void> {
        const message = new Message();
        message.exchange = exchangeName;
        message.routingKey = routingKey;
        message.content = content;
        try {
            await this._databaseService.getMessageRepository().enqueueMessage(message);
        } catch (error) {
            logger.error(error);
            this._sentry.capture(error);
            this.saveMessageRetryTimerId = setTimeout(() => {this.saveMessage(exchangeName, routingKey, content)}, SAVE_MESSAGE_RETRY_INTERVAL);
        }
    }

    private async resendMessage(): Promise<void> {
        const messageRepo = this._databaseService.getMessageRepository();
        const message = await messageRepo.dequeueMessage();
        if (message) {
            if (!this.publishers.has(message.exchange)) {
                this.resendMessageRepeatTimerId = setTimeout(() => {
                    this.resendMessage();
                }, RESEND_INTERVAL);
                return;
            } else {
                await this.publish(message.exchange, message.routingKey, message.content);
            }
        }
        this.resendMessageRepeatTimerId = setTimeout(() => {
            this.resendMessage();
        }, RESEND_INTERVAL);
    }

    private async checkChannelStatus(channel: AMQPChannel): Promise<void> {
        if (channel.connection.closed && !this.isReconnecting) {
            await this.reconnect();
        }
    }

    private async reconnect(): Promise<void> {
        this.isReconnecting = true;
        // reconnect for all connections
        // try to close first
        logger.warn('trying to close current connection');
        try {
            await this._publisherConnection.close();
        } catch (err) {
            logger.warn(err);
        }

        try {
            await this._consumerConnection.close();
        } catch (err) {
            logger.warn(err);
        }
        logger.warn('trying to reconnect');
        await this.connect(true);
        await this.connect();

        logger.warn('connected successfully, trying to recreate channels');
        for (const [exchangeName, publisherSetting] of this.publishers.entries()) {
            await this.initPublisher(exchangeName, publisherSetting.exchangeType);
        }
        for (const [queueName, queueSetting] of this.queues.entries()) {
            await this.initConsumer(queueSetting.exchangeName, queueSetting.exchangeType, queueName, queueSetting.bindingKey, queueSetting.prefetch);
            this.consumers.get(queueName).consumer = await this.subscribeConsumer(queueSetting.queueInstance);
        }
        this.isReconnecting = false;
    }
}