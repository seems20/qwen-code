/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { copyFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bundleDir = join(root, 'bundle');

// Create the bundle directory if it doesn't exist
if (!existsSync(bundleDir)) {
  mkdirSync(bundleDir);
}

// Find and copy all .sb files from packages to the root of the bundle directory
const sbFiles = glob.sync('packages/**/*.sb', { cwd: root });
for (const file of sbFiles) {
  copyFileSync(join(root, file), join(bundleDir, basename(file)));
}

// Copy the sns-demo template to bundle/template
const templateSrc = join(root, 'sns-demo');
const templateDest = join(bundleDir, 'template');

if (existsSync(templateSrc)) {
  try {
    // Remove existing template directory if it exists
    if (existsSync(templateDest)) {
      rmSync(templateDest, { recursive: true, force: true });
    }

    // Copy the template directory
    cpSync(templateSrc, templateDest, { recursive: true });
    console.log('Template copied to bundle/template/');
  } catch (error) {
    console.warn('Warning: Could not copy template directory:', error.message);
  }
} else {
  console.warn('Warning: sns-demo template directory not found');
}

console.log('Assets copied to bundle/');
