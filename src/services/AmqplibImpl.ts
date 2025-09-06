/*
 * Copyright 2021 IROHA LAB
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

import { BaseConfigManager } from "../utils/BaseConfigManager";
import { ConfirmChannel, connect, Connection } from 'amqplib';
import { inject, injectable } from 'inversify';
import { Buffer } from 'buffer';
import { MQMessage } from '../domain/MQMessage';
import { TYPES } from '../TYPES';
import pino from 'pino';
import { Sentry } from '../utils/Sentry';
import { isFatalError } from 'amqplib/lib/connection';
import { RabbitMQService } from './RabbitMQService';
import { MsgStore } from '../domain/MsgStore';

const logger = pino();
const CHECK_INTERVAL = 5000;

interface QueueSetting {
    bindingKey: string;
    exchangeName: string;
    prefetch: number;
}

interface Consumer {
    queueName: string;
    onMessage: (msg: MQMessage) => Promise<boolean>;
    consumerTag: string;
}

/**
 * RabbitMQService implementation that use amqplib
 */
@injectable()
export class AmqplibImpl implements RabbitMQService {
    private _connection: Connection;
    private _exchanges = new Map<string, string>();
    private _channels = new Map<string, ConfirmChannel>();
    private _queues = new Map<string, QueueSetting>();
    private _consumers = new Map<string, Consumer>();
    private _connected: boolean;
    private _messageStoreQ: MsgStore[] = [];

    constructor(@inject(TYPES.ConfigManager) private _configManager: BaseConfigManager,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
    }

    private async connectAsync(): Promise<void> {
        this._connection = await connect(this._configManager.amqpServerUrl() || this._configManager.amqpConfig());
        this._connection.on('error', (error: any) => {
            logger.error(error,'line: 60, connection error on amqp');
            this._sentry.capture(error);
        });
        this._connection.on('close', (error: any) => {
            logger.error(error || {errorMessage:'closed no error'}, 'connection closed on amqp line:67');
            if (this._connected && isFatalError(error)) {
                this._sentry.capture(error);
                this.reconnect();
            }
        })
        this._connected = true;
        for (const exchangeName of this._channels.keys()) {
            const exchangeType = this._exchanges.get(exchangeName);
            await this.initPublisher(exchangeName, exchangeType);
        }
        for (const [queueName, queueSetting] of this._queues.entries()) {
            const exchangeType = this._exchanges.get(queueSetting.exchangeName);
            await this.initConsumer(queueSetting.exchangeName, exchangeType, queueName, queueSetting.bindingKey, queueSetting.prefetch);
            const consumer = this._consumers.get(queueName);
            consumer.consumerTag = await this.setupConsumer(consumer);
        }
        await this.resendMessageInFailedQueue();
    }

    private reconnect(): void {
        logger.warn('reconnect in 5 seconds');
        setTimeout(() => {
            this.connectAsync()
                .then(() => {
                    logger.info('reconnect successfully');
                })
                .catch((err) => {
                    this._sentry.capture(err);
                    logger.error(err, 'connect failed due to error, line: 94');
                })
        }, 5000);
    };

    public async initPublisher(exchangeName: string, exchangeType: string, routingKey?: string): Promise<void> {
        const channel = await this.addChannel(exchangeName, exchangeType);
        await channel.assertExchange(exchangeName, exchangeType);
    }

    /**
     * initialize a consumer
     * @param exchangeName
     * @param exchangeType
     * @param queueName
     * @param bindingKey
     * @param prefetch, see Fair dispatch in the tutorial (https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html)
     */
    public async initConsumer(exchangeName: string, exchangeType: string, queueName: string, bindingKey: string = '', prefetch = 1): Promise<void> {
        const channel = await this.addChannel(exchangeName, exchangeType);
        await channel.assertExchange(exchangeName, exchangeType);
        const q = await channel.assertQueue(queueName);
        if (prefetch) {
            await channel.prefetch(prefetch);
        }
        await channel.bindQueue(q.queue, exchangeName, bindingKey);
        this._queues.set(queueName, {bindingKey, exchangeName, prefetch});
    }

    public publish(exchangeName: string, routingKey: string, message: any): Promise<boolean> {
        const channel = this._channels.get(exchangeName);
        if (channel) {
            try {
                return new Promise<boolean>((resolve, reject) => {
                    channel.publish(
                        exchangeName,
                        routingKey,
                        Buffer.from(JSON.stringify(message), 'utf-8'),
                        {},
                        (err, ok) => {
                            if (err !== null) {
                                // TODO: currently not reachable, need to figure out how to test this piece of code.
                                logger.warn('message nacked');
                                this.saveMessage(exchangeName, routingKey, message);
                                reject(err);
                            } else {
                                resolve(true);
                                logger.debug('message acked')
                            }
                        });
                });
            } catch (e: any) {
                logger.error(e, 'exception catch when publish' + JSON.stringify(e.stack));
                this._sentry.capture(e, {stack: e.stack, line: '143', exchangeName, routingKey, message});
                this.saveMessage(exchangeName, routingKey, message);
                return Promise.resolve(false);
            }
        }
    }

    public async consume(queueName: string, onMessage: (msg: MQMessage) => Promise<boolean>): Promise<string> {
        const consumer = { queueName, onMessage, consumerTag: null };
        this._consumers.set(queueName, consumer);
        while (consumer.consumerTag == null) {
            consumer.consumerTag = await this.setupConsumer(consumer);
        }
        return consumer.consumerTag;
    }

    private async setupConsumer(consumer: Consumer) {
        const exchangeName = this._queues.get(consumer.queueName).exchangeName;
        const channel = this._channels.get(exchangeName);
        if (channel) {
            try {
                const result = await channel.consume(consumer.queueName, async (msg) => {
                    if (msg) {
                        const mqMsg = JSON.parse(msg.content.toString('utf-8')) as MQMessage;
                        if (await consumer.onMessage(mqMsg)) {
                            channel.ack(msg);
                        } else {
                            channel.nack(msg);
                        }
                    } else {
                        // TODO: Handle the consumer cancel in this service
                        consumer.consumerTag = await this.setupConsumer(consumer);
                    }
                });
                return result.consumerTag;
            } catch (error: any) {
                logger.error(error, 'error when consume, stack: ' + error.stack);
                if (error.isOperational && error.message.includes('BasicConsume; 404')){
                    return null;
                }
                this._sentry.capture(error);
                return null;
            }
        } else {
            return null;
        }
    }

    private saveMessage(exchange: string, routingKey: string, content: any): void {
        const message = {} as MsgStore;
        message.exchange = exchange;
        message.routingKey = routingKey;
        message.content = content;
        this._messageStoreQ.push(message);
    }

    private async resendMessageInFailedQueue(): Promise<void> {
        let result: boolean;
        let message: MsgStore;
        while (result) {
            message = this._messageStoreQ.shift();
            if (message) {
                try {
                    result = await this.publish(message.exchange, message.routingKey, message.content);
                } catch (err) {
                    logger.error(err, 'error when resend message, stack: ' + err.stack);
                    this._sentry.capture(err);
                    result = false;
                    break;
                }
                if (!result) {
                    this._messageStoreQ.unshift(message);
                }
            }
        }
        setTimeout(this.resendMessageInFailedQueue.bind(this), CHECK_INTERVAL);
    }

    private async addChannel(exchangeName: string, exchangeType: string): Promise<ConfirmChannel> {
        if (!this._connection || !this._connected) {
            await this.connectAsync();
        }
        const channel = await this._connection.createConfirmChannel();
        this._channels.set(exchangeName, channel);
        this._exchanges.set(exchangeName, exchangeType);
        channel.on('close', () => this.onChannelClose(exchangeName));
        channel.on('error', (error) => this.onChannelError(exchangeName, error));
        return channel;
    }

    private onChannelClose(exchangeName): void {
        this._channels.set(exchangeName, null);
    }
    private onChannelError(exchangeName, error: any): void {
        this._channels.set(exchangeName, null);
        this._sentry.capture(error, {stack: error.stack, line: '215', exchangeName});
    }
}