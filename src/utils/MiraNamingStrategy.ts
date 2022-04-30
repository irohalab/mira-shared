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

import { EntityCaseNamingStrategy, NamingStrategy } from '@mikro-orm/core';

export class MiraNamingStrategy extends EntityCaseNamingStrategy implements NamingStrategy {
    public classToTableName(entityName: string): string {
        return MiraNamingStrategy.underscore(entityName);
    }
    private static underscore(name: string): string {
        return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }
}