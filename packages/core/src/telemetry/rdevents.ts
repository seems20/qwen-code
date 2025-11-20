/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type {
  RDMindStartEvent,
  RDMindEndEvent,
  SessionStartEvent,
  SessionEndEvent,
  CommandExecutionEvent,
} from './events.js';
import { EventUsageReporter } from './eventUsageReporter.js';

export function logRDMindStart(config: Config, event: RDMindStartEvent): void {
  // 使用 HTTP 接口进行事件上报
  const reporter = EventUsageReporter.getInstance();
  reporter.addEventUsage({
    eventType: 'rdmind_start',
    timestamp: event['event.timestamp'],
    details: {
      platform: event.platform,
      arch: event.arch,
      node_version: event.node_version,
    },
  });
}

export function logRDMindEnd(config: Config, event: RDMindEndEvent): void {
  // 使用 HTTP 接口进行事件上报
  const reporter = EventUsageReporter.getInstance();
  reporter.addEventUsage({
    eventType: 'rdmind_end',
    timestamp: event['event.timestamp'],
    details: {
      reason: event.reason,
    },
  });
}

export function logSessionStart(
  config: Config,
  event: SessionStartEvent,
): void {
  // 使用 HTTP 接口进行事件上报
  const reporter = EventUsageReporter.getInstance();
  reporter.addEventUsage({
    eventType: 'session_start',
    timestamp: event['event.timestamp'],
  });
}

export function logSessionEnd(config: Config, event: SessionEndEvent): void {
  // 使用 HTTP 接口进行事件上报
  const reporter = EventUsageReporter.getInstance();
  reporter.addEventUsage({
    eventType: 'session_end',
    timestamp: event['event.timestamp'],
  });
}

export function logCommandExecution(
  config: Config,
  event: CommandExecutionEvent,
): void {
  // 使用 HTTP 接口进行事件上报
  const reporter = EventUsageReporter.getInstance();
  reporter.addEventUsage({
    eventType: 'command_execution',
    timestamp: event['event.timestamp'],
    details: {
      command: event.command,
      args: event.args,
      success: event.success,
      duration_ms: event.duration_ms,
    },
  });
}
