/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'node:crypto';
import { createDebugLogger } from './debugLogger.js';

const debugLogger = createDebugLogger('apiKeyEncryption');

/**
 * 固定密钥（简化实现，避免主机名变化导致解密失败）
 * 注意：这不是最安全的方案，但可以确保解密总是成功
 */
const FIXED_KEY = crypto.pbkdf2Sync(
  'rdmind-xhs-sso-fixed-key-v1',
  'rdmind-xhs-sso-salt-v1',
  100000,
  32,
  'sha256',
);

/**
 * 加密 API Key
 * 使用 AES-256-GCM 加密算法，使用固定密钥确保解密总是成功
 *
 * @param plaintext 明文 API Key
 * @returns 加密后的字符串（格式: iv:authTag:encryptedData，均为 base64）
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') {
    return plaintext;
  }

  // 检查是否已经是加密格式（以 "xhs_enc:" 开头）
  if (plaintext.startsWith('xhs_enc:')) {
    return plaintext;
  }

  try {
    // 生成随机 IV（初始化向量）
    const iv = crypto.randomBytes(16);

    // 创建加密器
    const cipher = crypto.createCipheriv('aes-256-gcm', FIXED_KEY, iv);

    // 加密数据
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 组合 IV、认证标签和加密数据，使用 base64 编码
    const ivBase64 = iv.toString('base64');
    const authTagBase64 = authTag.toString('base64');
    const encryptedBase64 = encrypted.toString('base64');

    return `xhs_enc:${ivBase64}:${authTagBase64}:${encryptedBase64}`;
  } catch (error) {
    // 如果加密失败，返回原始值（向后兼容）
    debugLogger.warn('[ApiKeyEncryption] 加密失败，使用明文:', error);
    return plaintext;
  }
}

/**
 * 解密 API Key
 *
 * @param ciphertext 加密后的字符串
 * @returns 解密后的明文 API Key
 */
export function decryptApiKey(ciphertext: string): string {
  if (!ciphertext || ciphertext.trim() === '') {
    return ciphertext;
  }

  // 如果不是加密格式，直接返回（向后兼容）
  if (!ciphertext.startsWith('xhs_enc:')) {
    return ciphertext;
  }

  try {
    // 移除前缀并分割
    const parts = ciphertext.substring(8).split(':');
    if (parts.length !== 3) {
      throw new Error('无效的加密格式');
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;

    // 解码 base64
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // 创建解密器（使用固定密钥）
    const decipher = crypto.createDecipheriv('aes-256-gcm', FIXED_KEY, iv);
    decipher.setAuthTag(authTag);

    // 解密数据
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // 解密失败时抛出错误，而不是返回加密字符串
    // 这样可以避免将加密字符串当作 API Key 使用
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}。请重新进行 SSO 认证。`,
    );
  }
}

/**
 * 检查字符串是否为加密格式
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('xhs_enc:');
}
