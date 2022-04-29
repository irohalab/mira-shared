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

import { Message } from '../entity/Message';
import { BaseEntityRepository } from './BaseEntityRepository';

export class MessageRepository extends BaseEntityRepository<Message> {
    public async enqueueMessage(message: Message): Promise<void> {
        message.enqueuedTime = new Date();
        await this.persistAndFlush(message);
    }

    public async dequeueMessage(): Promise<Message | null> {
        const result = await this.find({}, {
            orderBy: {
                enqueuedTime: "ASC"
            },
            limit: 1
        });
        if (result.length > 0) {
            await this.remove(result[0]);
            return result[0];
        }
        return null;
    }
}