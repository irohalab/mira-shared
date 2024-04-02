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

import { PostgreSqlDriver, SqlEntityManager, MikroORMOptions } from '@mikro-orm/postgresql';
import { Options } from 'amqplib';
import { BaseConfigManager, MiraNamingStrategy, ORMConfig } from '../../index';
import { readFileSync } from 'fs';
import process from 'process';
import { resolve } from 'path';
import { TSMigrationGenerator } from '@mikro-orm/migrations';
import { injectable } from 'inversify';

@injectable()
export class ConfigManager implements BaseConfigManager {
    private _ormConfig: ORMConfig;
    constructor() {
        const ormConfigPath = process.env.ORMCONFIG || resolve(__dirname, './ormconfig.json');
        this._ormConfig = JSON.parse(readFileSync(ormConfigPath, {encoding: 'utf-8'}));
    }

    amqpConfig(): Options.Connect {
        throw new Error('Method not implemented.');
    }
    amqpServerUrl(): string {
        throw new Error('Method not implemented.');
    }
    databaseConfig(): MikroORMOptions<PostgreSqlDriver, SqlEntityManager<PostgreSqlDriver>> {
        return Object.assign({
            namingStrategy: MiraNamingStrategy,
            migrations: {
                tableName: 'mikro_orm_migrations',
                path: 'dist/migrations',
                pathTs: 'src/migrations',
                glob: '!(*.d).{js,ts}',
                transactional: true,
                disableForeignKeys: true,
                allOrNothing: true,
                dropTables: true,
                safe: false,
                snapshot: true,
                emit: 'ts',
                generator: TSMigrationGenerator
            }
        }, this._ormConfig) as unknown as MikroORMOptions<PostgreSqlDriver, SqlEntityManager<PostgreSqlDriver>>;
    }

}