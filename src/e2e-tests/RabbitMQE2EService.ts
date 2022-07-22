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

import { inject, injectable } from 'inversify';
import { E2E_BINDING_KEY, E2E_EXCHANGE, E2E_QUEUE } from './Constants';
import { inspect, promisify } from 'util';
import { TYPES } from '../TYPES';
import { DatabaseService } from './DatabaseService';
import pino from 'pino';
import { Sentry } from '../utils/Sentry';
import { E2EMessage } from './E2EMessage';
import { RabbitMQService } from '../services/RabbitMQService';

const sleep = promisify(setTimeout);
const logger = pino({
    timestamp: pino.stdTimeFunctions.isoTime
});

const EXPIRE_TIME = 3 * 60 * 1000;

@injectable()
export class RabbitMQE2EService {
    private _checkTimerId: NodeJS.Timeout;
    private _sendTimerId: NodeJS.Timeout;
    private _checkFailedMsgTimerId: NodeJS.Timeout;
    constructor(@inject(TYPES.RabbitMQService) private _mqService: RabbitMQService,
                @inject(TYPES.DatabaseService) private _databaseService: DatabaseService,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
    }

    public async start(isPublisher: boolean): Promise<void> {
        if (isPublisher) {
            await this._mqService.initPublisher(E2E_EXCHANGE, 'direct');
            this.sendMessage()
                .then(() => {});
            this.checkMsgCount()
                .then(() => {});
            this.checkFailedMessages()
                .then(() => {});
        } else {
            await this._mqService.initConsumer(E2E_EXCHANGE, 'direct', E2E_QUEUE, E2E_BINDING_KEY, false);
            await this._mqService.consume(E2E_QUEUE, async (msg) => {
                logger.info(inspect(msg, {depth: null}))
                await this._databaseService.decrementMsgCount();
                await sleep(2000);
                return true;
            });
        }
    }

    public async stop(): Promise<void> {
        // clean up
        clearTimeout(this._checkTimerId);
        clearTimeout(this._sendTimerId);
    }

    private async sendMessage(): Promise<void> {
        const msg = new E2EMessage();
        msg.sendTime = new Date().toISOString();
        if (await this._mqService.publish(E2E_EXCHANGE, E2E_BINDING_KEY, msg)) {
            logger.info('msg sent: ' + JSON.stringify(msg));
            await this._databaseService.incrementMsgCount();
        }
        this._sendTimerId = setTimeout(() => {this.sendMessage();}, 10 * 60 * 1000);
    }

    private async checkMsgCount(): Promise<void> {
        const count = await this._databaseService.getCount();
        try {
            if (count > 10) {
                throw new Error('Count > 10');
            }
        } catch (e) {
            logger.error(e);
            this._sentry.capture(e);
        }
        this._checkTimerId = setTimeout(() => {this.checkMsgCount();}, 12 * 3600 * 1000);
    }

    private async checkFailedMessages(): Promise<void> {
        const messageRepo = await this._databaseService.getMessageRepository();
        try {
            const nowTimestamp = Date.now();
            const messages = await messageRepo.findAll();
            for (const msg of messages) {
                if (nowTimestamp - msg.enqueuedTime.valueOf() > EXPIRE_TIME) {
                    throw new Error('Message expired: ' + JSON.stringify(msg));
                }
            }
        } catch (e) {
            logger.error(e);
            this._sentry.capture(e);
        }
        this._checkFailedMsgTimerId = setTimeout(() => {this.checkFailedMessages();}, 3600 * 1000);
    }
}