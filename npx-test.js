#!/usr/bin/env node

/**
 * Test script for the Stock Market MCP Server
 * This script is designed to verify that the MCP server works correctly
 * when installed via npx.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up test log
const testLogFile = path.join(os.tmpdir(), 'stock-market-test.log');
fs.writeFileSync(testLogFile, `[${new Date().toISOString()}] MCP Server Test Started\n`);

console.log(`Test log: ${testLogFile}`);
console.log('Running Stock Market MCP Server test...');

// Basic diagnostics for npx troubleshooting
const args = process.argv.slice(2);
if (args.includes('--diagnostics')) {
  // Run diagnostics mode to troubleshoot npx issues
  console.log('\n--- NPX DIAGNOSTICS MODE ---');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Running from:', __dirname);
  console.log('Is executable:', !!(fs.statSync(__filename).mode & fs.constants.S_IXUSR));
  
  // Check if CLI script exists and is executable
  const cliPath = path.join(__dirname, 'bin', 'cli.js');
  console.log('CLI script exists:', fs.existsSync(cliPath));
  if (fs.existsSync(cliPath)) {
    console.log('CLI script executable:', !!(fs.statSync(cliPath).mode & fs.constants.S_IXUSR));
  }
  
  // Check if dist/index.js exists
  const indexPath = path.join(__dirname, 'dist', 'index.js');
  console.log('index.js exists:', fs.existsSync(indexPath));
  
  // Check module structure
  console.log('\nPackage directory contents:');
  fs.readdirSync(__dirname).forEach(file => {
    console.log(`- ${file} (${fs.statSync(path.join(__dirname, file)).isDirectory() ? 'dir' : 'file'})`);
  });
  
  if (fs.existsSync(path.join(__dirname, 'bin'))) {
    console.log('\nBin directory contents:');
    fs.readdirSync(path.join(__dirname, 'bin')).forEach(file => {
      console.log(`- ${file} (${fs.statSync(path.join(__dirname, 'bin', file)).isDirectory() ? 'dir' : 'file'})`);
    });
  }
  
  if (fs.existsSync(path.join(__dirname, 'dist'))) {
    console.log('\nDist directory contents:');
    fs.readdirSync(path.join(__dirname, 'dist')).forEach(file => {
      console.log(`- ${file} (${fs.statSync(path.join(__dirname, 'dist', file)).isDirectory() ? 'dir' : 'file'})`);
    });
  }
  
  console.log('\nScript permission test...');
  try {
    fs.chmodSync(cliPath, 0o755);
    console.log('Successfully set permissions on CLI script');
  } catch (err) {
    console.log('Failed to set permissions:', err.message);
  }
  
  console.log('\nNPX test...');
  const testProcess = spawn('node', [cliPath, '--help'], { stdio: 'inherit' });
  testProcess.on('exit', (code) => {
    console.log(`Test process exited with code ${code}`);
    process.exit(0);
  });
  
  return;
}

// Check if API key was provided
let apiKey = process.env.FINANCIAL_API_KEY;

// Look for API key in arguments
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--api-key' || args[i] === '-k') && i + 1 < args.length) {
    apiKey = args[i + 1];
    break;
  }
}

if (!apiKey) {
  console.error('Error: API key is required. Set FINANCIAL_API_KEY environment variable or use --api-key flag.');
  process.exit(1);
}

// Set up test parameters
const TEST_TIMEOUT = 10000; // 10 seconds
const serverProcess = spawn('node', [
  path.join(__dirname, 'bin', 'cli.js'),
  '--api-key', apiKey,
  '--non-interactive'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Collect stdout
let stdoutData = '';
serverProcess.stdout.on('data', (data) => {
  stdoutData += data.toString();
  fs.appendFileSync(testLogFile, `[STDOUT] ${data.toString()}`);
});

// Collect stderr
let stderrData = '';
serverProcess.stderr.on('data', (data) => {
  stderrData += data.toString();
  fs.appendFileSync(testLogFile, `[STDERR] ${data.toString()}`);
});

// Handle server process errors
serverProcess.on('error', (err) => {
  console.error('Test failed: Server process error:', err.message);
  fs.appendFileSync(testLogFile, `[ERROR] Server process error: ${err.message}\n`);
  process.exit(1);
});

// Set up test timeout
const timeoutId = setTimeout(() => {
  console.log('Server started successfully and ran for the test period.');
  console.log('Test PASSED.');
  
  // Log success
  fs.appendFileSync(testLogFile, `[${new Date().toISOString()}] Test PASSED - Server ran for ${TEST_TIMEOUT}ms\n`);
  
  // Kill the server process
  serverProcess.kill('SIGINT');
  process.exit(0);
}, TEST_TIMEOUT);

// Handle early termination
serverProcess.on('exit', (code, signal) => {
  clearTimeout(timeoutId);
  
  if (code !== null && code !== 0) {
    console.error(`Test failed: Server exited with code ${code}`);
    fs.appendFileSync(testLogFile, `[${new Date().toISOString()}] Test FAILED - Server exited with code ${code}\n`);
    process.exit(1);
  } else if (signal) {
    console.log(`Server was terminated by signal: ${signal}`);
    fs.appendFileSync(testLogFile, `[${new Date().toISOString()}] Server was terminated by signal: ${signal}\n`);
    process.exit(0);
  }
});

console.log('Server test running...');
fs.appendFileSync(testLogFile, `[${new Date().toISOString()}] Waiting for server to run for ${TEST_TIMEOUT}ms\n`); 