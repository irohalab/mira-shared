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

import { NextFunction, Request, Response } from 'express';

export interface BaseDatabaseService {
    start(): Promise<void>;
    stop(): Promise<void>;
    requestContextMiddleware(): (req: Request, res: Response, next: NextFunction) => void;

    /**
     * Return currently schema base on current entities
     */
    generateSchema(): Promise<string>;

    /**
     * Drop current schema and generate new schema base on entities.
     * Should only be used in the first init in production environment.
     */
    syncSchema(): Promise<void>;
}