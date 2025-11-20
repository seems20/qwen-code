/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PALLAS_WS_BASE } from '@rdmind/rdmind-core';

export interface WebSocketRuntimeConfig {
  enabled: boolean;
  url: string;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  debug: boolean;
}

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function toNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export function loadWebSocketRuntimeConfig(
  debugOverride?: boolean,
): WebSocketRuntimeConfig {
  const enabled = toBoolean(process.env['RDMIND_WS_ENABLED'], true);
  const url =
    process.env['RDMIND_WS_URL']?.trim() || `${PALLAS_WS_BASE}/pallas/ws`;
  const retryMaxAttempts = toNumber(process.env['RDMIND_WS_RETRY_MAX'], 0); // 0 = infinite
  const retryBaseDelayMs = toNumber(
    process.env['RDMIND_WS_RETRY_BASE_MS'],
    1000,
  );
  const heartbeatIntervalMs = toNumber(
    process.env['RDMIND_WS_HEARTBEAT_INTERVAL_MS'],
    3_000,
  );
  const heartbeatTimeoutMs = toNumber(
    process.env['RDMIND_WS_HEARTBEAT_TIMEOUT_MS'],
    30_000,
  );
  // 优先使用传入的 debugOverride，否则从环境变量读取
  const debug =
    debugOverride !== undefined
      ? debugOverride
      : toBoolean(process.env['RDMIND_WS_DEBUG'], false);

  return {
    enabled,
    url,
    retryMaxAttempts,
    retryBaseDelayMs,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
    debug,
  };
}
