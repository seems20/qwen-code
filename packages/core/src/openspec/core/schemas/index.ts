/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenSpec core type definitions and schemas
 */

export interface OpenSpecMetadata {
  version: string;
  format: 'openspec';
  created?: string;
  updated?: string;
}

export interface Scenario {
  name: string;
  description: string;
  steps?: string[];
}

export interface Requirement {
  name: string;
  text: string;
  scenarios: Scenario[];
}

export interface Spec {
  name: string;
  overview: string;
  requirements: Requirement[];
  metadata: OpenSpecMetadata;
}

export interface SpecDelta {
  added?: Requirement[];
  modified?: Requirement[];
  removed?: string[];
}

export interface ChangeProposal {
  name: string;
  description: string;
  motivation: string;
  scope: string[];
  specDeltas: Record<string, SpecDelta>;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dependencies?: string[];
}

export interface TaskGroup {
  name: string;
  tasks: Task[];
}

export interface Change {
  name: string;
  proposal: ChangeProposal;
  tasks: TaskGroup[];
  created: string;
  updated: string;
  status: 'draft' | 'approved' | 'implementing' | 'completed';
}

export interface ValidationIssue {
  level: 'ERROR' | 'WARNING' | 'INFO';
  path: string;
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface OpenSpecConfig {
  aiTools: string[];
  projectName?: string;
  description?: string;
}
