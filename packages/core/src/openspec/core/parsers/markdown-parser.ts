/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Spec,
  Requirement,
  Scenario,
  OpenSpecMetadata,
} from '../schemas/index.js';

/**
 * Parses OpenSpec markdown files into structured data
 */
export class MarkdownParser {
  private lines: string[];

  constructor(content: string) {
    this.lines = content.split('\n');
  }

  /**
   * Parse a complete OpenSpec specification from markdown
   */
  parseSpec(specId: string): Spec {
    // Extract title and overview
    const name = this.extractTitle() || specId;
    const overview = this.extractOverview();

    // Parse requirements
    const requirements = this.parseRequirements();

    // Create metadata
    const metadata: OpenSpecMetadata = {
      version: '1.0.0',
      format: 'openspec',
    };

    return {
      name,
      overview,
      requirements,
      metadata,
    };
  }

  private extractTitle(): string {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();
      if (line.startsWith('# ')) {
        return line.substring(2).trim();
      }
    }
    return '';
  }

  private extractOverview(): string {
    const overviewLines: string[] = [];
    let foundTitle = false;
    let foundRequirements = false;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();

      if (line.startsWith('# ')) {
        foundTitle = true;
        continue;
      }

      if (
        foundTitle &&
        (line.startsWith('## ') || line.startsWith('### Requirement:'))
      ) {
        foundRequirements = true;
        break;
      }

      if (foundTitle && !foundRequirements && line) {
        overviewLines.push(line);
      }
    }

    return overviewLines.join(' ').trim();
  }

  private parseRequirements(): Requirement[] {
    const requirements: Requirement[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();

      if (line.startsWith('### Requirement:')) {
        const requirement = this.parseRequirement(i);
        if (requirement) {
          requirements.push(requirement);
        }
      }
    }

    return requirements;
  }

  private parseRequirement(startLine: number): Requirement | null {
    const headerLine = this.lines[startLine].trim();
    const name = headerLine.substring('### Requirement:'.length).trim();

    if (!name) {
      return null;
    }

    // Find requirement text
    let text = '';
    let textStartLine = startLine + 1;

    // Skip empty lines
    while (
      textStartLine < this.lines.length &&
      !this.lines[textStartLine].trim()
    ) {
      textStartLine++;
    }

    // Collect requirement text until we hit a scenario or next requirement
    for (let i = textStartLine; i < this.lines.length; i++) {
      const line = this.lines[i].trim();

      if (
        line.startsWith('#### Scenario:') ||
        line.startsWith('### Requirement:') ||
        line.startsWith('## ')
      ) {
        break;
      }

      if (line) {
        text += (text ? ' ' : '') + line;
      }
    }

    // Parse scenarios
    const scenarios = this.parseScenarios(startLine);

    return {
      name,
      text,
      scenarios,
    };
  }

  private parseScenarios(requirementStartLine: number): Scenario[] {
    const scenarios: Scenario[] = [];

    // Find all scenarios for this requirement
    for (let i = requirementStartLine; i < this.lines.length; i++) {
      const line = this.lines[i].trim();

      // Stop at next requirement or section
      if (
        i > requirementStartLine &&
        (line.startsWith('### Requirement:') || line.startsWith('## '))
      ) {
        break;
      }

      if (line.startsWith('#### Scenario:')) {
        const scenario = this.parseScenario(i);
        if (scenario) {
          scenarios.push(scenario);
        }
      }
    }

    return scenarios;
  }

  private parseScenario(startLine: number): Scenario | null {
    const headerLine = this.lines[startLine].trim();
    const name = headerLine.substring('#### Scenario:'.length).trim();

    if (!name) {
      return null;
    }

    const steps: string[] = [];
    let description = '';

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i].trim();

      // Stop at next scenario, requirement, or section
      if (
        line.startsWith('#### Scenario:') ||
        line.startsWith('### Requirement:') ||
        line.startsWith('## ')
      ) {
        break;
      }

      // Collect bullet points as steps
      if (line.startsWith('- ')) {
        steps.push(line.substring(2).trim());
      } else if (line && !description) {
        // First non-empty, non-bullet line is description
        description = line;
      }
    }

    return {
      name,
      description: description || name,
      steps: steps.length > 0 ? steps : undefined,
    };
  }

  /**
   * Parse a spec delta from markdown
   */
  parseSpecDelta(_content: string) {
    // Implementation for parsing spec deltas with ADDED/MODIFIED/REMOVED sections
    // This would follow similar patterns but look for delta-specific markers
    return {};
  }

  /**
   * Parse tasks from markdown
   */
  parseTasks(content: string) {
    // Implementation for parsing task lists from markdown
    const lines = content.split('\n');
    const tasks = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        const completed = trimmed.startsWith('- [x]');
        const text = trimmed.substring(5).trim();
        tasks.push({
          id: this.generateTaskId(text),
          name: text,
          description: text,
          completed,
        });
      }
    }

    return tasks;
  }

  private generateTaskId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
}
