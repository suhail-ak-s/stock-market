#!/usr/bin/env node

/**
 * Simple script to automatically bump the patch version in package.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Increment the patch version
const [major, minor, patch] = currentVersion.split('.');
const newVersion = `${major}.${minor}.${parseInt(patch, 10) + 1}`;

// Update the version in the package.json
packageJson.version = newVersion;

// Write the updated package.json back to the file
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version bumped from ${currentVersion} to ${newVersion}`); 