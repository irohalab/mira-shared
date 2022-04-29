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

import { DateType, Entity, JsonType, PrimaryKey, Property } from '@mikro-orm/core';
import { MessageRepository } from '../repository/MessageRepository';
import { randomUUID } from 'crypto';

@Entity({ customRepository: () => MessageRepository })
export class Message {

    @PrimaryKey()
    public id: string = randomUUID();

    @Property()
    public exchange: string;

    @Property()
    public routingKey: string;

    @Property({
        columnType: 'json',
        type: JsonType
    })
    public content: any;

    @Property({
        columnType: 'timestamp',
        type: DateType
    })
    public enqueuedTime: Date;
}