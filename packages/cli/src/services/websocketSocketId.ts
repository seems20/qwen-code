/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 管理服务端下发的 socketId
 * 这个 socketId 由服务端在 WebSocket 连接建立时下发
 */
let socketId: string | null = null;

/**
 * 设置服务端下发的 socketId
 */
export function setSocketId(id: string | null): void {
  socketId = id;
}

/**
 * 获取服务端下发的 socketId
 * 如果尚未收到服务端下发的 socketId，返回 null
 */
export function getSocketId(): string | null {
  return socketId;
}
