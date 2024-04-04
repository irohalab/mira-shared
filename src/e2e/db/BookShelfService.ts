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

import { DbService } from './DbService';
import { injectable } from 'inversify';
import { BookRepository } from './repo/BookRepository';
import { Book } from './entity/Book';
import { CreateRequestContext, EnsureRequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';

@injectable()
export class BookShelfService {
    constructor(private em: EntityManager,
                private dbService: DbService) {
    }

    public async addBooks(): Promise<void> {

    }

    @EnsureRequestContext<BookShelfService>(t => t.em)
    public async listBooks(): Promise<Book[]> {
        return await this.dbService.getBookRepo(this.em).findAll();
    }
}