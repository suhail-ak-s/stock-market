#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import readline from 'readline';
import os from 'os';

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
let debug = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--api-key' || arg === '-k') && i + 1 < args.length) {
    apiKey = args[++i];
  } else if ((arg === '--base-url' || arg === '-u') && i + 1 < args.length) {
    baseUrl = args[++i];
  } else if (arg === '--debug' || arg === '-d') {
    debug = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Financial Datasets MCP Server - Stock Market API

Usage: npx stock-market-mcp-server [options]

Options:
  --api-key, -k <key>     Your Financial Datasets API key (required if not stored)
  --base-url, -u <url>    API base URL (default: https://api.financialdatasets.ai)
  --debug, -d             Enable debug output
  --help, -h              Show this help message

Example:
  npx stock-market-mcp-server --api-key YOUR_API_KEY
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
      
      startServer(apiKey, baseUrl, debug);
    });
  });
} else {
  startServer(apiKey, baseUrl, debug);
}

function startServer(apiKey, baseUrl, debug) {
  console.log('Starting Financial Datasets MCP Server...');
  
  // Show log file location
  const logFile = path.join(os.tmpdir(), 'financial-mcp.log');
  console.log(`Log file: ${logFile}`);
  
  // Create a readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nServer is running as a Model Context Protocol (MCP) provider.');
  console.log('This server provides financial data to AI models that support MCP.');
  console.log('It doesn\'t have a web interface - it\'s designed to be used by AI systems.');
  console.log('\nCommands:');
  console.log('  help    - Show this help message');
  console.log('  log     - View the last 10 lines of the log file');
  console.log('  status  - Check if the server is running');
  console.log('  exit    - Stop the server and exit');
  console.log('\nType a command or press Ctrl+C to exit\n');
  
  // Start the server process
  const serverProcess = spawn('node', [
    path.join(packageRoot, 'dist', 'index.js'),
    '--api-key', apiKey,
    '--base-url', baseUrl
  ], {
    stdio: debug ? 'inherit' : 'ignore'
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
    console.log('\nShutting down server...');
    serverProcess.kill('SIGINT');
    rl.close();
    process.exit(0);
  });
  
  // Handle user commands
  rl.on('line', (input) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 'help':
        console.log('\nCommands:');
        console.log('  help    - Show this help message');
        console.log('  log     - View the last 10 lines of the log file');
        console.log('  status  - Check if the server is running');
        console.log('  exit    - Stop the server and exit');
        break;
        
      case 'log':
        try {
          const logContent = fs.existsSync(logFile) 
            ? fs.readFileSync(logFile, 'utf8').split('\n').slice(-10).join('\n') 
            : 'Log file not found';
          console.log('\nLast 10 log entries:\n' + logContent);
        } catch (err) {
          console.error('Error reading log file:', err.message);
        }
        break;
        
      case 'status':
        if (serverProcess.killed) {
          console.log('Server is not running.');
        } else {
          console.log('Server is running.');
          try {
            const stats = fs.statSync(logFile);
            const lastModified = new Date(stats.mtime);
            console.log(`Last log activity: ${lastModified.toLocaleString()}`);
          } catch (err) {
            console.log('Cannot read log file.');
          }
        }
        break;
        
      case 'exit':
        console.log('Shutting down server...');
        serverProcess.kill('SIGINT');
        rl.close();
        process.exit(0);
        break;
        
      default:
        if (command) {
          console.log(`Unknown command: ${command}. Type 'help' for a list of commands.`);
        }
    }
    
    rl.prompt();
  });
  
  rl.setPrompt('> ');
  rl.prompt();
} 