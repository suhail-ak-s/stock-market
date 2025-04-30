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

// Check if API key was provided
let apiKey = process.env.FINANCIAL_API_KEY;
const args = process.argv.slice(2);

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