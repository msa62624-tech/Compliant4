#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script helps users set up their environment configuration for the INsuretrack application.
 * It creates a .env file from .env.example and prompts for the backend API URL if running interactively.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_EXAMPLE = path.join(__dirname, '.env.example');
const ENV_FILE = path.join(__dirname, '.env');
const BACKEND_DIR = path.join(__dirname, 'backend');
const BACKEND_ENV_EXAMPLE = path.join(BACKEND_DIR, '.env.example');
const BACKEND_ENV_FILE = path.join(BACKEND_DIR, '.env');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkEnvExample() {
  if (!fs.existsSync(ENV_EXAMPLE)) {
    log('❌ Error: .env.example file not found', colors.yellow);
    log('Please ensure you are running this script from the project root directory.', colors.yellow);
    process.exit(1);
  }
}

function envFileExists() {
  return fs.existsSync(ENV_FILE);
}

function backendEnvExists() {
  return fs.existsSync(BACKEND_ENV_FILE);
}

function backendDirExists() {
  return fs.existsSync(BACKEND_DIR) && fs.existsSync(BACKEND_ENV_EXAMPLE);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setupEnvironment() {
  log('\n🚀 INsuretrack Environment Setup\n', colors.bright + colors.cyan);
  
  checkEnvExample();

  // === FRONTEND SETUP ===
  log('📦 FRONTEND CONFIGURATION\n', colors.bright + colors.blue);

  // Check if .env already exists
  if (envFileExists()) {
    log('⚠️  A frontend .env file already exists.', colors.yellow);
    const overwrite = await promptUser('Do you want to overwrite it? (y/N): ');
    
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      log('\n✅ Frontend setup skipped. Your existing .env file was not modified.', colors.green);
    } else {
      await setupFrontend();
    }
  } else {
    await setupFrontend();
  }

  // === BACKEND SETUP ===
  if (backendDirExists()) {
    log('\n📦 BACKEND CONFIGURATION\n', colors.bright + colors.blue);
    
    if (backendEnvExists()) {
      log('⚠️  A backend .env file already exists.', colors.yellow);
      const overwrite = await promptUser('Do you want to overwrite it? (y/N): ');
      
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        log('\n✅ Backend setup skipped. Your existing backend/.env file was not modified.', colors.green);
      } else {
        await setupBackend();
      }
    } else {
      await setupBackend();
    }
  } else {
    log('\n⚠️  Backend directory not found. Skipping backend configuration.', colors.yellow);
  }

  // Final instructions
  log('\n🎉 Setup Complete!\n', colors.bright + colors.green);
  log('Next steps:', colors.bright + colors.cyan);
  log('   1. Run: npm install', colors.cyan);
  log('   2. Run: npm run dev', colors.cyan);
  log('   3. Open http://localhost:5175 in your browser', colors.cyan);
  
  if (backendDirExists()) {
    log('\n   For backend:', colors.bright + colors.cyan);
    log('   1. cd backend', colors.cyan);
    log('   2. npm install', colors.cyan);
    log('   3. npm run dev\n', colors.cyan);
  }
}

async function setupFrontend() {
  // Read the example file
  let envContent = fs.readFileSync(ENV_EXAMPLE, 'utf-8');

  log('📝 Frontend Configuration Options:\n', colors.bright);
  log('1. Local development (backend at http://localhost:3001)', colors.cyan);
  log('2. Custom backend URL', colors.cyan);
  log('3. Demo mode (no backend - use default .env.example)', colors.cyan);

  const choice = await promptUser('\nSelect an option (1-3, default: 3): ');

  let backendUrl = '';

  switch (choice) {
    case '1':
      backendUrl = 'http://localhost:3001';
      log(`\n✅ Using local backend: ${backendUrl}`, colors.green);
      break;
    
    case '2':
      backendUrl = await promptUser('\nEnter your backend URL (e.g., https://api.example.com): ');
      if (backendUrl) {
        // Remove trailing slash
        backendUrl = backendUrl.replace(/\/$/, '');
        log(`\n✅ Using custom backend: ${backendUrl}`, colors.green);
      } else {
        log('\n⚠️  No URL provided. Will use demo mode.', colors.yellow);
      }
      break;
    
    case '3':
    default:
      log('\n✅ Using demo mode (no backend connection)', colors.green);
      break;
  }

  // Update the VITE_API_BASE_URL in the content
  if (backendUrl) {
    envContent = envContent.replace(
      /VITE_API_BASE_URL=.*/,
      `VITE_API_BASE_URL=${backendUrl}`
    );
  } else {
    // Comment out the URL for demo mode
    envContent = envContent.replace(
      /VITE_API_BASE_URL=.*/,
      '# VITE_API_BASE_URL=http://localhost:3001'
    );
  }

  // Write the .env file
  fs.writeFileSync(ENV_FILE, envContent);
  
  log('\n✅ Frontend environment file created successfully!', colors.bright + colors.green);
  log(`📄 Configuration saved to: ${ENV_FILE}`, colors.blue);
  
  if (backendUrl) {
    log(`🔗 Backend URL: ${backendUrl}`, colors.blue);
  } else {
    log('📦 Running in demo mode - backend API not configured', colors.blue);
    log('   The app will use local data only.', colors.blue);
  }
}

async function setupBackend() {
  // Read the backend example file
  let backendEnvContent = fs.readFileSync(BACKEND_ENV_EXAMPLE, 'utf-8');

  log('📝 Backend Configuration:\n', colors.bright);
  log('Do you want to configure email (SMTP) now?', colors.cyan);
  log('(You can skip this and configure it later)\n', colors.yellow);
  
  const configureEmail = await promptUser('Configure email now? (y/N): ');
  
  if (configureEmail.toLowerCase() === 'y' || configureEmail.toLowerCase() === 'yes') {
    log('\n📧 Email Configuration Options:\n', colors.bright);
    log('1. Microsoft 365 / Outlook (recommended)', colors.cyan);
    log('2. Gmail (requires App Password)', colors.cyan);
    log('3. Custom SMTP server', colors.cyan);
    log('4. Skip email configuration (use test mode)', colors.cyan);
    
    const emailChoice = await promptUser('\nSelect an option (1-4, default: 4): ');
    
    switch (emailChoice) {
      case '1': {
        log('\n📧 Microsoft 365 / Outlook Configuration', colors.bright + colors.blue);
        log('You will need:', colors.yellow);
        log('  1. Your Microsoft 365 email address', colors.yellow);
        log('  2. Your password (or app password if MFA is enabled)\n', colors.yellow);
        
        const m365Email = await promptUser('Enter your Microsoft 365 email address: ');
        const m365Password = await promptUser('Enter your password: ');
        
        if (m365Email && m365Password) {
          // Comment out Gmail section
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_SERVICE=gmail)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_USER=.*@gmail\.com)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_PASS=.*-app-password)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_FROM=.*@gmail\.com)/m,
            '# $1'
          );
          
          // Update Microsoft 365 configuration
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_HOST=smtp\.office365\.com)/,
            '$1'
          );
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_PORT=587)/,
            '$1'
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_USER=your\.email@yourdomain\.onmicrosoft\.com/,
            `SMTP_USER=${m365Email}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_PASS=your-password/,
            `SMTP_PASS=${m365Password}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_FROM=your\.email@yourdomain\.onmicrosoft\.com/,
            `SMTP_FROM=${m365Email}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_SECURE=false)/,
            '$1'
          );
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_REQUIRE_TLS=true)/,
            '$1'
          );
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_TLS_REJECT_UNAUTHORIZED=true)/,
            '$1'
          );
          
          log(`\n✅ Microsoft 365 configured: ${m365Email}`, colors.green);
        } else {
          log('\n⚠️  Microsoft 365 configuration incomplete. Using test mode.', colors.yellow);
        }
        }
        break;
      
      case '2': {
        log('\n📧 Gmail Configuration', colors.bright + colors.blue);
        log('Before proceeding, you need:', colors.yellow);
        log('  1. 2-Step Verification enabled on your Google Account', colors.yellow);
        log('  2. An App Password created for "Mail"', colors.yellow);
        log('  (Visit: https://myaccount.google.com/apppasswords)\n', colors.yellow);
        
        const gmailAddress = await promptUser('Enter your Gmail address: ');
        const appPassword = await promptUser('Enter your 16-character App Password: ');
        
        if (gmailAddress && appPassword) {
          // Comment out Microsoft 365 section
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_HOST=smtp\.office365\.com)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_PORT=587)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_USER=.*@yourdomain\.onmicrosoft\.com)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_PASS=your-password)/m,
            '# $1'
          );
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_FROM=.*@yourdomain\.onmicrosoft\.com)/m,
            '# $1'
          );
          
          // Update Gmail configuration
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_SERVICE=gmail)/,
            '$1'
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_USER=your\.email@gmail\.com/,
            `SMTP_USER=${gmailAddress}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_PASS=your-16-char-app-password/,
            `SMTP_PASS=${appPassword}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_FROM=your\.email@gmail\.com/,
            `SMTP_FROM=${gmailAddress}`
          );
          
          log(`\n✅ Gmail configured: ${gmailAddress}`, colors.green);
        } else {
          log('\n⚠️  Gmail configuration incomplete. Using test mode.', colors.yellow);
        }
        }
        break;
      
      case '3': {
        log('\n📧 Custom SMTP Configuration', colors.bright + colors.blue);
        const smtpHost = await promptUser('SMTP Host (e.g., smtp.sendgrid.net): ');
        const smtpPort = await promptUser('SMTP Port (default: 587): ') || '587';
        const smtpUser = await promptUser('SMTP Username: ');
        const smtpPass = await promptUser('SMTP Password: ');
        const smtpFrom = await promptUser('From Email Address: ');
        
        if (smtpHost && smtpUser && smtpPass && smtpFrom) {
          // Comment out Microsoft 365 section
          backendEnvContent = backendEnvContent.replace(
            /^(SMTP_HOST=smtp\.office365\.com)/m,
            '# $1'
          );
          
          // Comment out Gmail section
          backendEnvContent = backendEnvContent.replace(
            /# (SMTP_SERVICE=gmail)/,
            '# $1'
          );
          
          // Update custom SMTP configuration - find Option C section
          backendEnvContent = backendEnvContent.replace(
            /# Option C: Custom SMTP host\s*\n# SMTP_HOST=.*/,
            `# Option C: Custom SMTP host\nSMTP_HOST=${smtpHost}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_PORT=.*/,
            `SMTP_PORT=${smtpPort}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_USER=.*/,
            `SMTP_USER=${smtpUser}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_PASS=.*/,
            `SMTP_PASS=${smtpPass}`
          );
          backendEnvContent = backendEnvContent.replace(
            /# SMTP_FROM=.*/,
            `SMTP_FROM=${smtpFrom}`
          );
          
          log(`\n✅ Custom SMTP configured: ${smtpHost}`, colors.green);
        } else {
          log('\n⚠️  SMTP configuration incomplete. Using test mode.', colors.yellow);
        }
        }
        break;
      
      default:
        log('\n✅ Skipping email configuration - using test mode', colors.green);
        log('   Emails will be sent to Ethereal test accounts', colors.blue);
        break;
    }
  } else {
    log('\n✅ Skipping email configuration - using test mode', colors.green);
  }

  // Ask about frontend URL
  log('\n🌐 Frontend URL Configuration:\n', colors.bright);
  const frontendUrl = await promptUser('Enter your frontend URL (default: http://localhost:5173): ');
  
  if (frontendUrl && frontendUrl.trim() !== '') {
    backendEnvContent = backendEnvContent.replace(
      /FRONTEND_URL=.*/,
      `FRONTEND_URL=${frontendUrl.trim()}`
    );
    log(`✅ Frontend URL set to: ${frontendUrl.trim()}`, colors.green);
  } else {
    log('✅ Using default frontend URL: http://localhost:5173', colors.green);
  }

  // Write the backend .env file
  fs.writeFileSync(BACKEND_ENV_FILE, backendEnvContent);
  
  log('\n✅ Backend environment file created successfully!', colors.bright + colors.green);
  log(`📄 Configuration saved to: ${BACKEND_ENV_FILE}`, colors.blue);
}

// Handle non-interactive mode (e.g., CI/CD)
const isInteractive = process.stdin.isTTY;

if (!isInteractive) {
  log('Running in non-interactive mode...', colors.blue);
  checkEnvExample();
  
  if (!envFileExists()) {
    // Just copy the example file
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    log('✅ Created frontend .env from .env.example', colors.green);
  } else {
    log('ℹ️  Frontend .env file already exists, skipping setup', colors.blue);
  }
  
  // Also setup backend in non-interactive mode
  if (backendDirExists() && !backendEnvExists()) {
    fs.copyFileSync(BACKEND_ENV_EXAMPLE, BACKEND_ENV_FILE);
    log('✅ Created backend/.env from backend/.env.example', colors.green);
  } else if (backendEnvExists()) {
    log('ℹ️  Backend .env file already exists, skipping setup', colors.blue);
  }
} else {
  // Run interactive setup
  setupEnvironment().catch((error) => {
    log(`\n❌ Error during setup: ${error.message}`, colors.yellow);
    process.exit(1);
  });
}
