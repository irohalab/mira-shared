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

import { ConfigManager } from './ConfigManager';
import { MikroORMOptions, NamingStrategy } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Options } from 'amqplib';
import { MiraNamingStrategy } from '../utils/MiraNamingStrategy';
import { ORMConfig } from '../utils/ORMConfig';
import { injectable } from 'inversify';
import { resolve } from 'path';
import { readFileSync } from 'fs';

@injectable()
export class ConfigManagerImpl implements ConfigManager {
    private readonly _ormConfig: ORMConfig;
    constructor() {
        const ormConfigPath = process.env.ORMCONFIG || resolve(__dirname, '../../ormconfig.json');
        this._ormConfig = JSON.parse(readFileSync(ormConfigPath, {encoding: 'utf-8'}));
    }
    public amqpConfig(): Options.Connect {
        return undefined;
    }

    public amqpServerUrl(): string {
        return process.env.AMQP_URL;
    }

    public checkInterval(): number {
        return ConfigManagerImpl.getIntFromEnv(12 * 3600 * 1000, process.env.CHECK_INTERVAL);
    }

    public databaseConfig(): MikroORMOptions<PostgreSqlDriver> {
        return Object.assign({namingStrategy: MiraNamingStrategy as new() => NamingStrategy}, this._ormConfig) as MikroORMOptions<PostgreSqlDriver>;
    }

    public maxDiff(): number {
        return ConfigManagerImpl.getIntFromEnv(10, process.env.MAX_DIFF);
    }

    public sendInterval(): number {
        return ConfigManagerImpl.getIntFromEnv(10 * 60 * 1000, process.env.SEND_INTERVAL);
    }

    private static getIntFromEnv(defaultValue: number, env: string): number {
        if (env) {
            const parsedVal = parseInt(env, 10);
            if (Number.isInteger(parsedVal)) {
                return parsedVal;
            }
        }
        return defaultValue;
    }
}