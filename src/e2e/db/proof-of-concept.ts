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
import { BaseConfigManager, BaseDatabaseService, BasicDatabaseServiceImpl, TYPES } from '../../index';
import { ConfigManager } from './ConfigManager';
import { DbService } from './DbService';
import { Book } from './entity/Book';
import { BookShelfService } from './BookShelfService';

const container = new Container();

container.bind<BaseConfigManager>(TYPES.ConfigManager).to(ConfigManager);
container.bind<DbService>(TYPES.DatabaseService).to(DbService);
container.bind<BookShelfService>(BookShelfService).toSelf().inSingletonScope();

const databaseService = container.get<DbService>(TYPES.DatabaseService);

databaseService.start()
    .then(() => {
        return databaseService.initSchema();
    })
    .then(() => {
        const bookshelf = container.get(BookShelfService);
        return bookshelf.listBooks();
    })
    .then(async () => {
        const repo = databaseService.getBookRepo();
        const book1 = new Book();
        book1.isbn = '1bc';
        book1.name = 'Abc'
        repo.save(book1);
        await repo.flush();
        const book2 = new Book();
        book2.isbn = '1bc';
        book2.name = 'BCD';
        repo.save(book2);
        await repo.flush();
    })
    .catch((e) => {
        console.error(e);
    })