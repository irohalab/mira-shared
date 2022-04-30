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

import { inject, injectable } from "inversify";
import { MessageRepository } from '../repository/MessageRepository';
import { BaseDatabaseService } from './BaseDatabaseService';
import { BaseConfigManager } from '../utils/BaseConfigManager';
import { TYPES } from '../TYPES';
import { promisify } from 'util';
import pino from 'pino';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import type { EntityManager, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Message } from '../entity/Message';
import { NextFunction, Request, Response } from 'express';

const RETRY_DELAY = 5000;
const MAX_RETRY_COUNT = 10;
const sleep = promisify(setTimeout);

const logger = pino();

@injectable()
export class BasicDatabaseServiceImpl implements BaseDatabaseService {
    protected _ormHelper: MikroORM<PostgreSqlDriver>;
    protected _em: EntityManager;
    protected _retryCount: number = 0;

    constructor(@inject(TYPES.ConfigManager) protected _configManager: BaseConfigManager) {
    }

    public async start(): Promise<void> {
        try {
            if (!this._ormHelper) {
                this._ormHelper = await MikroORM.init<PostgreSqlDriver>(this._configManager.databaseConfig());
                this._em = this._ormHelper.em;
            } else {
                await this._ormHelper.connect();
            }
            this._retryCount = 0;
        } catch (exception) {
            logger.warn(exception);
            if (this._retryCount < MAX_RETRY_COUNT) {
                await sleep(RETRY_DELAY);
                this._retryCount++;
                await this.start();
            } else {
                throw exception;
            }
        }
        return Promise.resolve(undefined);
    }

    public async stop(): Promise<void> {
        await this._ormHelper.close();
        return Promise.resolve(undefined);
    }

    public getMessageRepository(): MessageRepository {
        return this._em.getRepository(Message);
    }

    public get entityManager(): EntityManager {
        return this._em;
    }

    public requestContextMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => RequestContext.create(this.entityManager, next);
    }
}