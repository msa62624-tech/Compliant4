#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';

function run(cmd) {
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  console.log(`Node version: ${process.version}`);
  console.log(`Working directory: ${process.cwd()}`);
  
  // Ensure .env file exists for build (required for VITE_API_BASE_URL)
  // Note: .env.example should only contain non-sensitive default values
  if (!existsSync('.env')) {
    if (existsSync('.env.example')) {
      console.log('⚠️  No .env file found. Creating from .env.example...');
      try {
        copyFileSync('.env.example', '.env');
        console.log('✅ Created .env file from .env.example');
        console.log('ℹ️  For production deployments, override VITE_API_BASE_URL in your platform environment variables');
      } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        console.warn('⚠️  Build will continue but backend URL may not be configured.');
        console.warn('⚠️  Set VITE_API_BASE_URL environment variable in your deployment platform.');
      }
    } else {
      console.warn('⚠️  Warning: No .env or .env.example file found. Backend URL may not be configured.');
      console.warn('⚠️  Set VITE_API_BASE_URL environment variable in your deployment platform.');
    }
  } else {
    console.log('✅ .env file exists');
  }
  
  console.log(`Lockfiles present: package-lock.json=${existsSync('package-lock.json')}, npm-shrinkwrap.json=${existsSync('npm-shrinkwrap.json')}`);
  // Prefer npm ci when a lockfile is present; otherwise fall back to install
  if (existsSync('package-lock.json') || existsSync('npm-shrinkwrap.json')) {
    try {
      run('npm ci');
    } catch (e) {
      console.warn('npm ci failed, falling back to npm install...');
      run('npm install');
    }
  } else {
    run('npm install');
  }

  run('npm run build');
  console.log(`Dist exists: ${existsSync('dist')}`);
  console.log(`Index exists: ${existsSync('dist/index.html')}`);
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error?.message || error);
  process.exit(1);
}
