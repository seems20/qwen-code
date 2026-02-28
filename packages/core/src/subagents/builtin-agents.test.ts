/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { BuiltinAgentRegistry } from './builtin-agents.js';

describe('BuiltinAgentRegistry', () => {
  describe('getBuiltinAgents', () => {
    it('should return empty array when no builtin agents are configured', () => {
      const agents = BuiltinAgentRegistry.getBuiltinAgents();

      expect(agents).toBeInstanceOf(Array);
      expect(agents).toHaveLength(0);
    });
  });

  describe('getBuiltinAgent', () => {
    it('should return null for any name when no builtin agents are configured', () => {
      expect(BuiltinAgentRegistry.getBuiltinAgent('general-purpose')).toBeNull();
      expect(BuiltinAgentRegistry.getBuiltinAgent('changelog')).toBeNull();
      expect(BuiltinAgentRegistry.getBuiltinAgent('invalid')).toBeNull();
      expect(BuiltinAgentRegistry.getBuiltinAgent('')).toBeNull();
    });
  });

  describe('isBuiltinAgent', () => {
    it('should return false for all names when no builtin agents are configured', () => {
      expect(BuiltinAgentRegistry.isBuiltinAgent('general-purpose')).toBe(false);
      expect(BuiltinAgentRegistry.isBuiltinAgent('changelog')).toBe(false);
      expect(BuiltinAgentRegistry.isBuiltinAgent('invalid')).toBe(false);
      expect(BuiltinAgentRegistry.isBuiltinAgent('')).toBe(false);
    });
  });

  describe('getBuiltinAgentNames', () => {
    it('should return empty array', () => {
      const names = BuiltinAgentRegistry.getBuiltinAgentNames();

      expect(names).toBeInstanceOf(Array);
      expect(names).toHaveLength(0);
    });
  });

  describe('consistency', () => {
    it('should maintain consistency across all methods', () => {
      const agents = BuiltinAgentRegistry.getBuiltinAgents();
      const names = BuiltinAgentRegistry.getBuiltinAgentNames();

      expect(names).toEqual(agents.map((agent) => agent.name));
      expect(names).toHaveLength(0);
    });
  });
});
