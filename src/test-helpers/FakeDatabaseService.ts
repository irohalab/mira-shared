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


import { injectable } from 'inversify';
import { BaseDatabaseService } from '../services/BaseDatabaseService';
import { NextFunction, Request, Response } from 'express';

@injectable()
export class FakeDatabaseService implements BaseDatabaseService {

    start(): Promise<void> {
        return Promise.resolve(undefined);
    }

    stop(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public requestContextMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return function (p1: Request, p2: Response, p3: NextFunction) {
        };
    }

    public generateSchema(): Promise<string> {
        return Promise.resolve('');
    }

    public syncSchema(): Promise<void> {
        return Promise.resolve(undefined);
    }
}