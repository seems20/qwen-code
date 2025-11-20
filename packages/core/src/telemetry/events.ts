/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BaseTelemetryEvent } from './types.js';

export class RDMindStartEvent implements BaseTelemetryEvent {
  'event.name': 'rdmind_start';
  'event.timestamp': string;
  session_id: string;
  platform: string;
  arch: string;
  node_version: string;

  constructor(session_id: string) {
    this['event.name'] = 'rdmind_start';
    this['event.timestamp'] = new Date().toISOString();
    this.session_id = session_id;
    this.platform = process.platform;
    this.arch = process.arch;
    this.node_version = process.version;
  }
}

export class RDMindEndEvent implements BaseTelemetryEvent {
  'event.name': 'rdmind_end';
  'event.timestamp': string;
  session_id: string;
  reason: 'normal' | 'error' | 'sigint' | 'sigterm';

  constructor(
    session_id: string,
    reason: 'normal' | 'error' | 'sigint' | 'sigterm',
  ) {
    this['event.name'] = 'rdmind_end';
    this['event.timestamp'] = new Date().toISOString();
    this.session_id = session_id;
    this.reason = reason;
  }
}

export class SessionStartEvent implements BaseTelemetryEvent {
  'event.name': 'session_start';
  'event.timestamp': string;
  session_id: string;

  constructor(session_id: string) {
    this['event.name'] = 'session_start';
    this['event.timestamp'] = new Date().toISOString();
    this.session_id = session_id;
  }
}

export class SessionEndEvent implements BaseTelemetryEvent {
  'event.name': 'session_end';
  'event.timestamp': string;
  session_id: string;

  constructor(session_id: string) {
    this['event.name'] = 'session_end';
    this['event.timestamp'] = new Date().toISOString();
    this.session_id = session_id;
  }
}

export class CommandExecutionEvent implements BaseTelemetryEvent {
  'event.name': 'command_execution';
  'event.timestamp': string;
  command: string;
  args: string[];
  success: boolean;
  duration_ms?: number;

  constructor(
    command: string,
    args: string[],
    success: boolean,
    duration_ms?: number,
  ) {
    this['event.name'] = 'command_execution';
    this['event.timestamp'] = new Date().toISOString();
    this.command = command;
    this.args = args;
    this.success = success;
    this.duration_ms = duration_ms;
  }
}
