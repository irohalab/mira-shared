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

import { ConfigManager } from '../utils/ConfigManager';
import { Options } from 'amqplib';
import { injectable } from 'inversify';
import { NotImplementException } from '../exceptions/NotImplementException';

@injectable()
export class FakeConfigManager implements ConfigManager {
    amqpConfig(): Options.Connect {
        const host = 'localhost';
        const port = 5672;
        const username = 'guest';
        const password = 'guest';
        return {
            protocol: 'amqp',
            hostname: host,
            port,
            username,
            password,
            locale: 'en_US',
            frameMax: 0,
            heartbeat: 0,
            vhost: '/'
        };
    }

    amqpServerUrl(): string {
        return process.env.AMQP_URL;
    }

    databaseConnectionConfig(): import("typeorm").ConnectionOptions {
        throw new NotImplementException();
    }
}