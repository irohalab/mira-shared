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

/**
 * DI tokens
 */
export const TYPES = {
    ConfigManager: Symbol.for('ConfigManager'),
    DatabaseService: Symbol.for('DatabaseService'),
    Sentry: Symbol.for('Sentry'),
    RabbitMQService: Symbol.for('RabbitMQService')
};

/**
 * Exchanges
 */
export const JOB_EXCHANGE = 'video_job'; // for video manager job
export const DOWNLOAD_MESSAGE_EXCHANGE = 'download_message';
export const VIDEO_MANAGER_EXCHANGE = 'video_manager';
export const CORE_TASK_EXCHANGE = 'core_task';

/**
 * Queues
 */
export const JOB_QUEUE = 'job_queue'; // for video manager job
export const DOWNLOAD_MESSAGE_QUEUE = 'download_message_queue';
export const VIDEO_MANAGER_QUEUE = 'video_manager_queue';
export const DOWNLOAD_TASK_QUEUE = 'download_task_queue';
export const COMMAND_QUEUE = 'command_queue';

/**
 * Binding Keys
 */
export const VIDEO_MANAGER_GENERAL = 'general';
export const DOWNLOAD_TASK = 'download_task';
export const VIDEO_MANAGER_COMMAND = 'command';