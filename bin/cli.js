#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Check for stored API key
let storedApiKey = '';
const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.financial-mcp');
const configFile = path.join(configDir, 'config.json');

try {
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    storedApiKey = config.apiKey || '';
  }
} catch (err) {
  console.warn('Warning: Could not read stored API key.');
}

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = '';
let baseUrl = 'https://api.financialdatasets.ai';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--api-key' || arg === '-k') && i + 1 < args.length) {
    apiKey = args[++i];
  } else if ((arg === '--base-url' || arg === '-u') && i + 1 < args.length) {
    baseUrl = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Financial Datasets MCP Server - Stock Market API

Usage: npx financial-mcp-server [options]

Options:
  --api-key, -k <key>     Your Financial Datasets API key (required if not stored)
  --base-url, -u <url>    API base URL (default: https://api.financialdatasets.ai)
  --help, -h              Show this help message

Example:
  npx financial-mcp-server --api-key YOUR_API_KEY
`);
    process.exit(0);
  }
}

// Use stored API key if no key is provided
if (!apiKey && storedApiKey) {
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
          console.log('API key saved.');
        } catch (err) {
          console.warn('Warning: Could not save API key to config file.', err.message);
        }
      }
      
      startServer(apiKey, baseUrl);
    });
  });
} else {
  startServer(apiKey, baseUrl);
}

function startServer(apiKey, baseUrl) {
  console.log('Starting Financial Datasets MCP Server...');
  
  // Start the server process
  const serverProcess = spawn('node', [
    path.join(packageRoot, 'dist', 'index.js'),
    '--api-key', apiKey,
    '--base-url', baseUrl
  ], {
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    serverProcess.kill('SIGINT');
  });
} 