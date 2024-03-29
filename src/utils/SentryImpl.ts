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

import {
    init,
    captureMessage as sentryCaptureMessage,
    captureException as sentryCaptureException, Scope
} from '@sentry/node';
import { Sentry } from './Sentry';
import { injectable } from 'inversify';

const DSN = process.env.SENTRY_DSN;

@injectable()
export class SentryImpl implements Sentry {

    public setup(serverName: string, appName: string, version: string): void {
        if (DSN) {
            init({
                dsn: DSN,
                release: `${appName}@v${version}`,
                serverName
            });
        }
    }

    public capture(obj: any, context?: { [p: string]: string }): void {
        if (DSN) {
            if (context) {
                if (obj instanceof Error) {
                    sentryCaptureException(obj, scope => {
                        for (const [k, v] of Object.entries(context)) {
                            scope.setTag(k, v);
                        }
                        return scope;
                    });
                } else {
                    sentryCaptureMessage(obj, scope => {
                        for (const [k, v] of Object.entries(context)) {
                            scope.setTag(k, v);
                        }
                        return scope;
                    });
                }
            } else {
                if (obj instanceof Error) {
                    sentryCaptureException(obj);
                } else {
                    sentryCaptureMessage(obj);
                }
            }
        }
    }
}