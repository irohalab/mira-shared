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

import { JsonResult } from 'inversify-express-utils/lib/results';
import { IHttpActionResult } from 'inversify-express-utils';

export function JsonResultFactory(status: number, json?: any): IHttpActionResult {
    switch (status) {
        case 200:
            return new JsonResult(json ?? {message: 'ok'}, status);
        case 400:
            return new JsonResult(json ?? {message: 'Bad Request'}, status);
        case 401:
            return new JsonResult(json ?? {message: 'Unauthorized'}, status);
        case 403:
            return new JsonResult(json ?? {message: 'Permission Denied'}, status);
        case 404:
            return new JsonResult(json ?? {message: 'Not Found'}, status);
        case 500:
            return new JsonResult(json ?? {message: 'Internal Server Error'}, status);
        default:
            return new JsonResult(json ?? {}, status);
    }
}