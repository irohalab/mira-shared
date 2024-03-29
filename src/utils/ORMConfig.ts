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

export type ORMConfig = {
    type: string;
    host: string;
    port: number;
    user: string;
    password: string;
    dbName: string;
    driverOptions?: {
        connection: {
            // ca is cert string not path
            ssl: { ca: string } | boolean
        }
    };
    entities: string[];
    entitiesTs: string[];
};