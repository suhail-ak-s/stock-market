#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import readline from 'readline';
import os from 'os';

// Debug info - write to a debug file
const debugFile = path.join(os.tmpdir(), 'stock-market-debug.log');
const writeDebug = (message) => {
  try {
    fs.appendFileSync(debugFile, `${new Date().toISOString()} - ${message}\n`);
  } catch (err) {
    // Silently fail if we can't write to the debug file
  }
};

writeDebug('CLI script started');
writeDebug(`Node version: ${process.version}`);
writeDebug(`Platform: ${process.platform}`);
writeDebug(`CLI Arguments: ${process.argv.join(' ')}`);
writeDebug(`Is stdin a TTY: ${process.stdin.isTTY}`);
writeDebug(`Is stdout a TTY: ${process.stdout.isTTY}`);

// Print debug file location
console.error(`Debug log: ${debugFile}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

writeDebug(`__filename: ${__filename}`);
writeDebug(`__dirname: ${__dirname}`);
writeDebug(`packageRoot: ${packageRoot}`);

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
  writeDebug(`Error reading config: ${err.message}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = '';
let baseUrl = 'https://api.financialdatasets.ai';
let debug = false;
let nonInteractive = false;

// Detect if we're running under an MCP context (Claude/ChatGPT/etc.)
// Check multiple indicators that we might be running in an MCP context
const isMcpContext = 
  // Either stdin is not a TTY (being piped)
  !process.stdin.isTTY || 
  // Or we're running under npx
  process.env.npm_execpath?.includes('npx') ||
  // Or we have a specific environment variable set by Claude
  process.env.CLAUDE_API_KEY ||
  // Or we were run with --non-interactive flag
  args.includes('--non-interactive') || args.includes('-n');

writeDebug(`Detected MCP context: ${isMcpContext}`);
if (isMcpContext) {
  nonInteractive = true;
  writeDebug('Setting non-interactive mode due to MCP context detection');
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--api-key' || arg === '-k') && i + 1 < args.length) {
    apiKey = args[++i];
  } else if ((arg === '--base-url' || arg === '-u') && i + 1 < args.length) {
    baseUrl = args[++i];
  } else if (arg === '--debug' || arg === '-d') {
    debug = true;
  } else if (arg === '--non-interactive' || arg === '-n') {
    nonInteractive = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Financial Datasets MCP Server - Stock Market API

Usage: npx stock-market-mcp-server [options]

Options:
  --api-key, -k <key>         Your Financial Datasets API key (required if not stored)
  --base-url, -u <url>        API base URL (default: https://api.financialdatasets.ai)
  --debug, -d                 Enable debug output
  --non-interactive, -n       Run in non-interactive mode (no prompt)
  --help, -h                  Show this help message

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
  if (nonInteractive) {
    console.error('Error: API key is required in non-interactive mode. Use --api-key argument.');
    writeDebug('Exiting: no API key provided in non-interactive mode');
    process.exit(1);
  }

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
      
      startServer(apiKey, baseUrl, debug, nonInteractive);
    });
  });
} else {
  startServer(apiKey, baseUrl, debug, nonInteractive);
}

function startServer(apiKey, baseUrl, debug, nonInteractive) {
  writeDebug(`Starting server with apiKey: ${apiKey ? '[REDACTED]' : 'none'}, baseUrl: ${baseUrl}, debug: ${debug}, nonInteractive: ${nonInteractive}`);
  
  // Show log file location
  const logFile = path.join(os.tmpdir(), 'financial-mcp.log');
  console.error(`Log file: ${logFile}`);
  writeDebug(`Log file: ${logFile}`);
  
  // Check if dist/index.js exists
  const indexPath = path.join(packageRoot, 'dist', 'index.js');
  if (!fs.existsSync(indexPath)) {
    console.error(`Error: Server file not found at ${indexPath}`);
    writeDebug(`Error: Server file not found at ${indexPath}`);
    process.exit(1);
  }
  
  writeDebug(`Starting server process with: node ${indexPath} --api-key [REDACTED] --base-url ${baseUrl}`);
  
  try {
    if (isMcpContext) {
      // Direct execution for MCP contexts - this is critical!
      // In MCP context, we need to just directly execute the server without spawning
      writeDebug('Directly executing server in MCP context (no spawn)');
      
      // Write warning to stderr (not stdout which needs to be clean for MCP)
      console.error('Running in MCP context mode - stdout will be used for MCP communication');
      
      // We need to use exec-style behavior here, not spawn
      // Since we're in the same process, just directly import and run the server
      import(indexPath).then(() => {
        writeDebug('Server module imported and running directly');
      }).catch(err => {
        console.error('Failed to import server module:', err);
        writeDebug(`Import error: ${err.message}`);
        process.exit(1);
      });
      
      // No further code should execute here that would write to stdout
      return;
    }
    
    // Interactive mode - start as child process
    console.log('Starting Financial Datasets MCP Server...');
    
    // Start the server process with proper stdio configuration
    const serverProcess = spawn('node', [
      indexPath,
      '--api-key', apiKey,
      '--base-url', baseUrl
    ], {
      stdio: ['ignore', debug ? 'inherit' : 'ignore', 'inherit']
    });
    
    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      writeDebug(`Server process error: ${err.message}`);
      process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
      writeDebug(`Server process exited with code ${code}`);
      if (code !== 0) {
        console.error(`Server exited with code ${code}`);
        process.exit(code);
      }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
    // In non-interactive mode, just wait for the server to exit
    if (nonInteractive) {
      console.log('\nServer is running as a Model Context Protocol (MCP) provider.');
      console.log('This server provides financial data to AI models that support MCP.');
      console.log('It doesn\'t have a web interface - it\'s designed to be used by AI systems.');
      console.log('\nPress Ctrl+C to stop the server.');
      console.log(`Log file is available at: ${logFile}`);
      console.log(`Debug log is available at: ${debugFile}`);
      return;
    }
    
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
    
    // Handle user commands
    rl.on('line', (input) => {
      const command = input.trim().toLowerCase();
      writeDebug(`Command received: ${command}`);
      
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
            console.log('\nLast 10 log entries:');
            console.log(logContent || 'No log entries found');
          } catch (err) {
            console.error('Error reading log file:', err.message);
          }
          break;
          
        case 'status':
          if (serverProcess.killed) {
            console.log('Server is not running.');
          } else {
            console.log('Server is running.');
          }
          break;
          
        case 'exit':
          console.log('Shutting down server...');
          serverProcess.kill('SIGINT');
          process.exit(0);
          break;
          
        default:
          console.log('Unknown command. Type "help" for available commands.');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    writeDebug(`Error in startServer: ${err.message}`);
    process.exit(1);
  }
} 