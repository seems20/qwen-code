/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';
import * as os from 'os';

/**
 * 简单的加密盐值
 */
const SALT = 'rdmind-xhs-sso-v1';

/**
 * 生成加密密钥（基于机器信息）
 */
function getKey(): Buffer {
  const material = `${os.hostname()}:${os.userInfo().username}:${SALT}`;
  return crypto.createHash('sha256').update(material).digest();
}

/**
 * 加密 API Key
 */
export function encryptApiKey(key: string): string {
  if (!key) return key;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 解密 API Key
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return encrypted;

  const parts = encrypted.split(':');
  if (parts.length !== 2) return encrypted; // 不是加密格式，返回原值

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      getKey(),
      Buffer.from(parts[0], 'hex'),
    );
    return Buffer.concat([
      decipher.update(parts[1], 'hex'),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return encrypted; // 解密失败，返回原值
  }
}

/**
 * 判断是否是加密的 key
 */
export function isEncrypted(key: string): boolean {
  if (!key) return false;
  const parts = key.split(':');
  return parts.length === 2 && /^[0-9a-f]{32}$/i.test(parts[0]);
}

/**
 * 自动解密（如果是加密的则解密，否则返回原值）
 */
export function getDecryptedKey(key: string): string {
  return isEncrypted(key) ? decryptApiKey(key) : key;
}
