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

import { MQMessage } from './MQMessage';
import { RemoteFile } from './RemoteFile';
import { VideoMetadata } from './VideoMetadata';

export class VideoManagerMessage implements MQMessage {
    public id: string;
    public isProcessed: boolean; // if there is no rule match, this is false
    public processedFiles: RemoteFile[]; // can be null
    public metadata: VideoMetadata;
    public jobExecutorId: string;
    public bangumiId: string;
    public videoId: string;
    public version = '3';
    public downloadTaskId: string;
}