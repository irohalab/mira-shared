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
import { AckOrNack, BrokerAsPromised, BrokerConfig, withDefaultConfig } from 'rascal';
import pino from 'pino';
import { Sentry } from '../utils/Sentry';
import { Message } from 'amqplib';
import { getVhostFromUrl } from '../utils/amqp-utils';

const logger = pino();

@injectable()
export class RascalImpl implements RabbitMQService {
    private _broker: BrokerAsPromised
    private _brokerConfig: BrokerConfig;
    private _vhost: string;

    constructor(@inject(TYPES.ConfigManager) private _config: BaseConfigManager,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
        if (this._config.amqpServerUrl()) {
            this._vhost = getVhostFromUrl(this._config.amqpServerUrl());
        } else {
            this._vhost = this._config.amqpConfig().vhost;
        }

        this._brokerConfig = {
            vhosts: {
                [this._vhost]: {
                    exchanges: {},
                    queues: {},
                    bindings: {},
                    publications: {},
                    subscriptions: {}
                }
            }
        };

        if (this._config.amqpServerUrl()) {
            this._brokerConfig.vhosts[this._vhost]['connection'] = { url: this._config.amqpServerUrl() };
        } else {
            const amqpConfig = this._config.amqpConfig();
            this._brokerConfig.vhosts[this._vhost]['connection'] = {
                protocol: 'amqp',
                hostname: amqpConfig.hostname,
                user: amqpConfig.username,
                password: amqpConfig.password,
                port: amqpConfig.port,
                vhost: amqpConfig.vhost,
                options: {
                    heartbeat: amqpConfig.heartbeat
                }
            }
        }
    }

    private async createBroker(): Promise<void> {

        this._broker = await BrokerAsPromised.create(withDefaultConfig(this._brokerConfig));
        this._broker.on('error', (error: any) => {
            logger.error(error);
        });
    }

    public async consume(queueName: string, onMessage: (msg: MQMessage) => Promise<boolean>): Promise<string> {
        if (!this._broker) {
            await this.createBroker();
        }
        try {
            const subscription = await this._broker.subscribe(queueName);
            subscription.on('message', async (message: Message, content: any, ackOrNackFn: AckOrNack) => {
                if (await onMessage(content as MQMessage)) {
                    ackOrNackFn();
                } else {
                    ackOrNackFn(new Error('Nack-ed by consumer'), { strategy: 'nack', defer: 1000, requeue: true});
                }
            });
            subscription.on('error', (error) => {
                logger.error(error);
            });
        } catch (error) {
            // subscription didn't exists
            logger.error(error);
            this._sentry.capture(error);
        }
        return Promise.resolve('');
    }

    public initConsumer(exchangeName: string, exchangeType: string, queueName: string, bindingKey?: string, prefetch?: boolean): Promise<void> {
        this.ensureExchange(exchangeName, exchangeType);
        this._brokerConfig.vhosts[this._vhost].queues[queueName] = {
            assert: true,
            check: false
        }
        this._brokerConfig.vhosts[this._vhost].bindings[RascalImpl.getBindingName(exchangeName, queueName, bindingKey)] = {
            source: exchangeName,
            destination: queueName,
            destinationType: 'queue',
            bindingKeys: [bindingKey]
        };
        this._brokerConfig.vhosts[this._vhost].subscriptions[queueName] = {
            queue: queueName,
            contentType: 'application/json',
            prefetch: prefetch ? 1 : 0
        };
        return Promise.resolve(undefined);
    }

    public initPublisher(exchangeName: string, exchangeType: string, routingKey?: string): Promise<void> {
        this.ensureExchange(exchangeName, exchangeType);
        this.preparePublisher(exchangeName, routingKey);
        return Promise.resolve(undefined);
    }

    public async publish(exchangeName: string, routingKey: string, message: any): Promise<boolean> {
        if (!this._broker) {
            await this.createBroker();
        }
        try {
            const publication = await this._broker.publish(RascalImpl.getPublicationName(exchangeName, routingKey), message);

            publication.on('success', (messageId) => {
                logger.debug('message id ' + messageId + ' was sent');
            });

            publication.on('error', ((err, messageId) => {
                logger.error(err);
                // TODO save and resent
            }));

            publication.on('return', (message) => {
                logger.info('message was returned: ' + message.properties.messageId);
            });

        } catch (error) {
            // publication didn't exists
            logger.error(error);
            this._sentry.capture(error);
        }

        return Promise.resolve(true);
    }

    private static getPublicationName(exchangeName: string, routingKey?: string): string {
        return routingKey ? exchangeName + '_' + routingKey: exchangeName;
    }

    private static getBindingName(exchangeName: string, queueName: string, bindingKey: string): string {
        return exchangeName + '_' + queueName + '_' + bindingKey;
    }

    private ensureExchange(exchangeName: string, exchangeType: string): void {
        if (!this._brokerConfig.vhosts[this._vhost].exchanges[exchangeName]) {
            this._brokerConfig.vhosts[this._vhost].exchanges[exchangeName] = {
                type: exchangeType,
                assert: true,
                check: false
            };
        }
    }

    private preparePublisher(exchangeName: string, bindingKey: string): void {
        this._brokerConfig.vhosts[this._vhost].publications[RascalImpl.getPublicationName(exchangeName, bindingKey)] = {
            exchange: exchangeName,
            routingKey: bindingKey,
            confirm: true
        };
    }
}