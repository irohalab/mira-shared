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

import { BasicDatabaseServiceImpl } from '../services/BasicDatabaseServiceImpl';
import { DatabaseService } from './DatabaseService';
import { injectable } from 'inversify';

@injectable()
export class DatabaseServiceImpl extends BasicDatabaseServiceImpl implements DatabaseService {
    public async init(): Promise<void> {
        try {
            await this.syncSchema();
            await this._em.execute('DROP TABLE IF EXISTS msg_count');
            await this._em.execute('CREATE TABLE IF NOT EXISTS msg_count (count integer not NULL);');
        } catch (e) {
            console.error(e);
        }
    }

    public async start(): Promise<void> {
        await super.start();
    }

    public async decrementMsgCount(): Promise<void> {
        let count = await this.getCount();
        count = count > 0 ? count - 1 : 0;
        await this._em.execute(`UPDATE msg_count SET count = ${count}`);
    }

    public async incrementMsgCount(): Promise<void> {
        let count = await this.getCount();
        count++;
        await this._em.execute(`UPDATE msg_count SET count = ${count}`);
    }

    public async getCount(): Promise<number> {
        console.log()
        const row = await this._em.execute('SELECT count FROM msg_count');
        if (row.length === 0) {
            await this._em.execute('insert into msg_count (count) VALUES (0)');
            return 0;
        } else {
            return row[0].count;
        }
    }
}