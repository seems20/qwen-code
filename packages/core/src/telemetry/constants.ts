/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'rdmind';

export const EVENT_USER_PROMPT = 'rdmind.user_prompt';
export const EVENT_TOOL_CALL = 'rdmind.tool_call';
export const EVENT_API_REQUEST = 'rdmind.api_request';
export const EVENT_API_ERROR = 'rdmind.api_error';
export const EVENT_API_CANCEL = 'rdmind.api_cancel';
export const EVENT_API_RESPONSE = 'rdmind.api_response';
export const EVENT_CLI_CONFIG = 'rdmind.config';
export const EVENT_EXTENSION_DISABLE = 'rdmind.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'rdmind.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'rdmind.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'rdmind.extension_uninstall';
export const EVENT_FLASH_FALLBACK = 'rdmind.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'rdmind.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'rdmind.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'rdmind.slash_command';
export const EVENT_IDE_CONNECTION = 'rdmind.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'rdmind.chat_compression';
export const EVENT_INVALID_CHUNK = 'rdmind.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'rdmind.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE = 'rdmind.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'rdmind.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE = 'rdmind.malformed_json_response';
export const EVENT_FILE_OPERATION = 'rdmind.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'rdmind.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'rdmind.subagent_execution';
export const EVENT_AUTH = 'rdmind.auth';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'rdmind.startup.performance';
export const EVENT_MEMORY_USAGE = 'rdmind.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'rdmind.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'rdmind.performance.regression';
