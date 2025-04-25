#!/usr/bin/env node

console.log('Testing npx package execution behavior...');

// Check if stdin is a TTY (interactive terminal)
console.log(`Is stdin a TTY: ${process.stdin.isTTY}`);
console.log(`Is stdout a TTY: ${process.stdout.isTTY}`);
console.log(`Is stderr a TTY: ${process.stderr.isTTY}`);

console.log('Environment variables:');
console.log(`Node Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`TTY Columns: ${process.stdout.columns}`);
console.log(`TTY Rows: ${process.stdout.rows}`);

// Try reading from stdin
console.log('Trying to set stdin in raw mode...');
try {
  process.stdin.setRawMode(true);
  console.log('Successfully set stdin in raw mode');
} catch (err) {
  console.error(`Error setting raw mode: ${err.message}`);
}

// Set up simple readline
import readline from 'readline';
console.log('Setting up readline interface...');
try {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('Type something and press Enter:');
  rl.on('line', (input) => {
    console.log(`Received: ${input}`);
    if (input.toLowerCase() === 'exit') {
      rl.close();
      process.exit(0);
    }
  });
} catch (err) {
  console.error(`Error with readline: ${err.message}`);
}

console.log('If you see this message but no prompt appears, npx is swallowing stdin/stdout interaction.'); 