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
import { inject } from 'inversify';
import { TYPES } from '../TYPES';
import { BaseConfigManager } from '../utils/BaseConfigManager';
import { AckOrNack, BrokerAsPromised, BrokerConfig, withDefaultConfig } from 'rascal';
import pino from 'pino';
import { Sentry } from '../utils/Sentry';
import { Message } from 'amqplib';

const logger = pino();

export class RascalImpl implements RabbitMQService {
    private _broker: BrokerAsPromised
    private _brokerConfig: BrokerConfig;

    constructor(@inject(TYPES.ConfigManager) private _config: BaseConfigManager,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
        this._brokerConfig = {
            vhosts: {
                '/': {
                    connection: {
                        url: this._config.amqpServerUrl()
                    },
                    exchanges: {},
                    queues: {},
                    publications: {},
                    subscriptions: {}
                }
            }
        };
    }

    private async createBroker(): Promise<void> {
        this._broker = await BrokerAsPromised.create(withDefaultConfig(this._brokerConfig));
        this._broker.on('error', (error: any) => {
            logger.error(error);
        });
    }

    public async consume(queueName: string, onMessage: (msg: MQMessage) => Promise<boolean>): Promise<string> {
        try {
            const subscription = await this._broker.subscribe(queueName);
            subscription.on('message', async (message: Message, content: any, ackOrNackFn: AckOrNack) => {
                if (await onMessage(content as MQMessage)) {
                    ackOrNackFn();
                } else {
                    ackOrNackFn(new Error('Nack-ed by consumer'));
                }
            });
        } catch (error) {
            // subscription didn't exists
            logger.error(error);
            this._sentry.capture(error);
        }
        return Promise.resolve('');
    }

    public initConsumer(exchangeName: string, exchangeType: string, queueName: string, bindingKey?: string, prefetch?: boolean): Promise<void> {
        this._brokerConfig.vhosts['/'].queues[queueName] = {
            assert: false,
            check: true
        }
        this._brokerConfig.vhosts['/'].publications[RascalImpl.getPublicationName(exchangeName, bindingKey)] = {
            exchange: exchangeName,
            routingKey: bindingKey,
            confirm: true
        };
        this._brokerConfig.vhosts['/'].subscriptions[queueName] = {
            queue: queueName,
            contentType: 'application/json',
            prefetch: prefetch ? 1 : 0
        };
        return Promise.resolve(undefined);
    }

    public initPublisher(exchangeName: string, exchangeType: string): Promise<void> {
        this._brokerConfig.vhosts['/'].exchanges[exchangeName] = {
            type: exchangeType,
            assert: false,
            check: true
        };
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
}