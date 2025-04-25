#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Set up logging
const logDir = path.join(process.env.HOME || process.env.USERPROFILE, '.financial-mcp');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const cliLogFile = path.join(logDir, 'cli.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(cliLogFile, logMessage);
}

log('CLI starting');

// Check for stored API key
let storedApiKey = '';
const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.financial-mcp');
const configFile = path.join(configDir, 'config.json');

try {
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    storedApiKey = config.apiKey || '';
    log(`Found stored API key: ${storedApiKey ? 'yes' : 'no'}`);
  }
} catch (err) {
  log(`Warning: Could not read stored API key: ${err.message}`);
  console.warn('Warning: Could not read stored API key.');
}

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = '';
let baseUrl = 'https://api.financialdatasets.ai';
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--api-key' || arg === '-k') && i + 1 < args.length) {
    apiKey = args[++i];
    log('API key provided via command line');
  } else if ((arg === '--base-url' || arg === '-u') && i + 1 < args.length) {
    baseUrl = args[++i];
    log(`Base URL set to: ${baseUrl}`);
  } else if (arg === '--verbose' || arg === '-v') {
    verbose = true;
    log('Verbose mode enabled');
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Financial Datasets MCP Server - Stock Market API

Usage: npx stock-market-mcp-server [options]

Options:
  --api-key, -k <key>     Your Financial Datasets API key (required if not stored)
  --base-url, -u <url>    API base URL (default: https://api.financialdatasets.ai)
  --verbose, -v           Enable verbose logging
  --help, -h              Show this help message

Example:
  npx stock-market-mcp-server --api-key YOUR_API_KEY
`);
    process.exit(0);
  }
}

// Use stored API key if no key is provided
if (!apiKey && storedApiKey) {
  log('Using stored API key');
  console.log('Using stored API key.');
  apiKey = storedApiKey;
}

// Check for API key
if (!apiKey) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Please enter your Financial Datasets API key: ', (answer) => {
    apiKey = answer.trim();
    rl.close();
    
    if (!apiKey) {
      console.error('Error: API key is required');
      log('Error: No API key provided');
      process.exit(1);
    }
    
    // Ask if user wants to save the API key
    const saveRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    saveRl.question('Would you like to save this API key for future use? (y/n): ', (saveAnswer) => {
      saveRl.close();
      
      if (saveAnswer.toLowerCase() === 'y' || saveAnswer.toLowerCase() === 'yes') {
        try {
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          fs.writeFileSync(configFile, JSON.stringify({ apiKey }, null, 2));
          log('API key saved');
          console.log('API key saved.');
        } catch (err) {
          log(`Warning: Could not save API key to config file: ${err.message}`);
          console.warn('Warning: Could not save API key to config file.', err.message);
        }
      }
      
      startServer(apiKey, baseUrl, verbose);
    });
  });
} else {
  startServer(apiKey, baseUrl, verbose);
}

function startServer(apiKey, baseUrl, verbose) {
  log(`Starting Financial Datasets MCP Server with baseUrl: ${baseUrl}`);
  console.log('Starting Financial Datasets MCP Server...');
  
  const serverArgs = [
    path.join(packageRoot, 'dist', 'index.js'),
    '--api-key', apiKey,
    '--base-url', baseUrl
  ];
  
  if (verbose) {
    log('Adding verbose flag to server args');
    serverArgs.push('--verbose');
  }
  
  // Start the server process
  const serverProcess = spawn('node', serverArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      FORCE_COLOR: '1'
    }
  });
  
  log('Server process started');
  
  serverProcess.on('error', (err) => {
    log(`Failed to start server: ${err.message}`);
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      log(`Server exited with code ${code}`);
      console.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('Shutting down server due to SIGINT');
    console.log('Shutting down server...');
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    log('Shutting down server due to SIGTERM');
    console.log('Shutting down server...');
    serverProcess.kill('SIGTERM');
  });
} 