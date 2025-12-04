/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { loadWebSocketRuntimeConfig } from '../../config/websocket.js';
import { WebSocketClient } from '../../services/WebSocketClient.js';
import * as os from 'node:os';
import { readSSOCredentialsSync } from '@rdmind/rdmind-core';

interface UseWebSocketOptions {
  onReloadCommands?: () => void;
  debug?: boolean;
  sessionId?: string;
}

/**
 * 读取 xhs_sso_creds.json 中的 rdmind_sso_id
 */
function getRdmindSsoId(): string | undefined {
  try {
    const creds = readSSOCredentialsSync();
    return creds?.rdmind_sso_id;
  } catch (_error) {
    // 忽略读取错误，不影响 WebSocket 连接
    return undefined;
  }
}

export function useWebSocket({ onReloadCommands, debug, sessionId }: UseWebSocketOptions) {
  const wsClientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const wsRuntimeConfig = loadWebSocketRuntimeConfig(debug);
    if (!wsRuntimeConfig.enabled) {
      if (debug) {
        console.debug(
          '[useWebSocket] WebSocket 未启用，请设置环境变量 RDMIND_WS_ENABLED=true',
        );
      }
      return;
    }

    if (debug) {
      console.debug(
        `[useWebSocket] 开始建立 WebSocket 连接，URL: ${wsRuntimeConfig.url}`,
      );
    }

    const rdmindSsoId = getRdmindSsoId();
    const registrationPayload: Record<string, unknown> = {
      type: 'auth',
      deviceId: sessionId,
      deviceName: os.hostname?.() || 'unknown-host',
      deviceType: 'rdmind-cli',
    };

    // 如果有 rdmind_sso_id，在 auth 消息中携带
    if (rdmindSsoId) {
      registrationPayload['rdmind_sso_id'] = rdmindSsoId;
    }

    const client = new WebSocketClient({
      ...wsRuntimeConfig,
      registrationPayload,
      onReloadCommands,
    });

    client.start();
    wsClientRef.current = client;

    return () => {
      client.stop();
      wsClientRef.current = null;
    };
  }, [onReloadCommands, debug, sessionId]);
}
