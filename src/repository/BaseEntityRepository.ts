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

import { EntityRepository } from '@mikro-orm/postgresql';

export abstract class BaseEntityRepository<E extends object> extends EntityRepository<E> {
    public async save(entities: E | E[]): Promise<E | E[]> {
        if (Array.isArray(entities)) {
            entities = entities.map(entity => this.create(entity));
        } else {
            entities = this.create(entities as E);
        }
        await this.em.persist(entities).flush();
        return entities;
    }
}