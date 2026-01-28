import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend server details
const BASE_URL = 'http://localhost:3002';
let serverProcess;
let regularUserToken;
let adminToken;

describe('Internal Entity Access Control Tests', () => {
  beforeAll(async () => {
    // Start the backend server on a different port to avoid conflicts
    console.log('Starting backend server for internal entity tests...');
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: '3002', NODE_ENV: 'test' },
      stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Backend server started for internal entity tests');

    // Login as admin to get admin token
    const adminResponse = await request(BASE_URL)
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'INsure2026!'
      });
    
    if (adminResponse.status !== 200) {
      throw new Error(`Failed to login as admin: ${adminResponse.status} ${JSON.stringify(adminResponse.body)}`);
    }
    adminToken = adminResponse.body.accessToken;

    // Create a non-admin user for testing with unique email to avoid conflicts
    const timestamp = Date.now();
    const regularUserData = {
      email: `testuser-${timestamp}@example.com`,
      name: 'Test User',
      password: 'TestPassword123!',
      role: 'user'
    };

    const createUserResponse = await request(BASE_URL)
      .post('/entities/User')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(regularUserData);

    if (createUserResponse.status !== 201) {
      throw new Error(`Failed to create test user: ${createUserResponse.status} ${JSON.stringify(createUserResponse.body)}`);
    }
    console.log('Test user created successfully');
    
    // Login as the regular user to get their token
    const regularUserResponse = await request(BASE_URL)
      .post('/auth/login')
      .send({
        username: regularUserData.email,
        password: 'TestPassword123!'
      });
    
    if (regularUserResponse.status !== 200) {
      throw new Error(`Failed to login as regular user: ${regularUserResponse.status} ${JSON.stringify(regularUserResponse.body)}`);
    }
    regularUserToken = regularUserResponse.body.accessToken;
    console.log('Regular user token obtained');
  }, 30000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
      console.log('Backend server stopped');
    }
  });

  describe('Access to _migrations entity', () => {
    test('GET /entities/_migrations - should block access for non-admin users', async () => {
      // This test verifies that non-admin users are blocked from accessing internal entities
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .get('/entities/_migrations')
        .set('Authorization', `Bearer ${regularUserToken}`);
      
      // Non-admin users should get 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access to internal entities is restricted');
    });

    test('GET /entities/_migrations - should allow access for admin users', async () => {
      if (!adminToken) {
        console.log('Skipping test - no admin token available');
        return;
      }

      const response = await request(BASE_URL)
        .get('/entities/_migrations')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Admin should get 200 or 404 (if entity doesn't exist as array)
      // but NOT 403
      expect(response.status).not.toBe(403);
    });

    test('PUT /entities/_migrations/test - should block modification for non-admin users', async () => {
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .put('/entities/_migrations/test')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ brokerPasswordsMigrated: false });
      
      // Non-admin users should get 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access to internal entities is restricted');
    });

    test('POST /entities/_migrations - should block creation for non-admin users', async () => {
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .post('/entities/_migrations')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ testFlag: true });
      
      // Non-admin users should get 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access to internal entities is restricted');
    });

    test('DELETE /entities/_migrations/test - should block deletion for non-admin users', async () => {
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .delete('/entities/_migrations/test')
        .set('Authorization', `Bearer ${regularUserToken}`);
      
      // Non-admin users should get 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access to internal entities is restricted');
    });
  });

  describe('Access to regular entities should still work', () => {
    test('GET /entities/Contractor - should work normally with auth', async () => {
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .get('/entities/Contractor')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /entities/Project - should work normally with auth', async () => {
      if (!regularUserToken) {
        throw new Error('Test setup failed - no regular user token available');
      }

      const response = await request(BASE_URL)
        .get('/entities/Project')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Unauthenticated access to internal entities', () => {
    test('GET /entities/_migrations - should require authentication', async () => {
      await request(BASE_URL)
        .get('/entities/_migrations')
        .expect(401);
    });
  });
});
