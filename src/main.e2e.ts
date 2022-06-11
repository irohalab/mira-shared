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

import 'reflect-metadata';
import { Container } from 'inversify';
import { Sentry } from './utils/Sentry';
import { TYPES } from './TYPES';
import { SentryImpl } from './utils/SentryImpl';
import { hostname } from 'os';
import { RabbitMQE2EService } from './e2e-tests/RabbitMQE2EService';
import pino from 'pino';
import { DatabaseService } from './e2e-tests/DatabaseService';
import { DatabaseServiceImpl } from './e2e-tests/DatabaseServiceImpl';
import { ConfigManager } from './e2e-tests/ConfigManager';
import { ConfigManagerImpl } from './e2e-tests/ConfigManagerImpl';
import { RabbitMQService } from './services/RabbitMQService';

const logger = pino();

const container = new Container();

container.bind<Sentry>(TYPES.Sentry).to(SentryImpl).inSingletonScope();
// tslint:disable-next-line
const version  = process.env.RELEASE_VERSION || "0.0.1";
const sentry = container.get<Sentry>(TYPES.Sentry);

sentry.setup(`mira_shared_e2e_${hostname()}`, 'mira-shared-e2e', version, __dirname);

container.bind<ConfigManager>(TYPES.ConfigManager).to(ConfigManagerImpl).inSingletonScope();
container.bind<RabbitMQService>(RabbitMQService).toSelf().inSingletonScope();
container.bind<RabbitMQE2EService>(RabbitMQE2EService).toSelf().inSingletonScope();
container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseServiceImpl).inSingletonScope();

const databaseService = container.get<DatabaseService>(TYPES.DatabaseService);
const mqService = container.get<RabbitMQE2EService>(RabbitMQE2EService);

const isPublisher = process.env.IS_PUBLISHER === 'true';

databaseService.start()
    .then(() => {
        return mqService.start(isPublisher);
    })
    .then(() => {
        sentry.capture({msg: 'start instance...'});
    });

function beforeExitHandler() {
    mqService.stop()
        .then(() => {
            return databaseService.stop();
        })
        .then(() => {
            process.exit(0);
        }, (error) => {
            logger.error(error);
            sentry.capture(error);
            process.exit(-1);
        });
}

process.on('SIGINT', beforeExitHandler);
process.on('SIGTERM', beforeExitHandler);
process.on('SIGHUP', beforeExitHandler);