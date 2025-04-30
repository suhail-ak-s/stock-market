#!/usr/bin/env node

/**
 * Installation script for stock-market-mcp-server
 * 
 * This script is run by the "install-global" script to help
 * set up global installation of the package.
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log some diagnostic info
console.log(`Running install script from: ${__dirname}`);
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

// Set up config directory
const configDir = path.join(os.homedir(), '.financial-mcp');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
  console.log(`Created config directory: ${configDir}`);
}

// Make the CLI scripts executable
const files = [
  path.join(__dirname, 'bin', 'cli.js'),
  path.join(__dirname, 'npx-test.js')
];

for (const file of files) {
  try {
    fs.chmodSync(file, 0o755); // rwxr-xr-x
    console.log(`Made executable: ${file}`);
  } catch (err) {
    console.warn(`Warning: Could not make ${file} executable. You may need to run: chmod +x ${file}`);
  }
}

// Check if globally installed
exec('npm list -g --depth=0 stock-market-mcp-server', (error, stdout, stderr) => {
  if (stdout.includes('stock-market-mcp-server')) {
    console.log('Package is already globally installed.');
    console.log('\nYou can run it with:');
    console.log('  stock-market-mcp-server --api-key YOUR_API_KEY');
  } else {
    console.log('Package is not globally installed.');
    console.log('\nTo install globally, run:');
    console.log('  npm install -g stock-market-mcp-server');
    console.log('\nAfter installation, you can run it with:');
    console.log('  stock-market-mcp-server --api-key YOUR_API_KEY');
  }
});

console.log('\nYou can also run it with npx:');
console.log('  npx stock-market-mcp-server --api-key YOUR_API_KEY'); 