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

import { BasicDatabaseServiceImpl } from '../../services/BasicDatabaseServiceImpl';
import { BookRepository } from './repo/BookRepository';
import { Book } from './entity/Book';
import { injectable } from 'inversify';
import { EntityManager } from '@mikro-orm/postgresql';

@injectable()
export class DbService extends BasicDatabaseServiceImpl {

    private _bookRepo: BookRepository;

    public async initSchema(): Promise<void> {
        await this._em.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        await this.syncSchema();
    }
    public getBookRepo(em?: EntityManager): BookRepository {
        if (em) {
            return em.getRepository(Book);
        }
        if (!this._bookRepo) {
            this._bookRepo = this._em.fork().getRepository(Book);

        }
        return this._bookRepo;
    }
}