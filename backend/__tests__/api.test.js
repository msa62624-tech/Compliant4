import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend server details
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
let serverProcess;
let authToken;

describe('Backend API Tests', () => {
  beforeAll(async () => {
    // Start the backend server
    console.log('Starting backend server...');
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
      stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Backend server started');
  }, 30000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
      console.log('Backend server stopped');
    }
  });

  describe('Authentication', () => {
    test('POST /auth/login - should login with valid credentials', async () => {
      const response = await request(BASE_URL)
        .post('/auth/login')
        .send({
          username: process.env.TEST_USERNAME || 'admin',
          password: process.env.TEST_PASSWORD || 'INsure2026!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('username', process.env.TEST_USERNAME || 'admin');
      
      // Store token for later tests
      authToken = response.body.accessToken;
    });

    test('POST /auth/login - should reject invalid credentials', async () => {
      await request(BASE_URL)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('POST /auth/login - should reject missing credentials', async () => {
      await request(BASE_URL)
        .post('/auth/login')
        .send({
          username: 'admin'
        })
        .expect(400);
    });
  });

  describe('Entity Endpoints', () => {
    test('GET /entities/Contractor - should require authentication', async () => {
      await request(BASE_URL)
        .get('/entities/Contractor')
        .expect(401);
    });

    test('GET /entities/Contractor - should return contractors with auth', async () => {
      const response = await request(BASE_URL)
        .get('/entities/Contractor')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /entities/Project - should return projects with auth', async () => {
      const response = await request(BASE_URL)
        .get('/entities/Project')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /entities/User - should return users with auth', async () => {
      const response = await request(BASE_URL)
        .get('/entities/User')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    let createdContractorId;

    test('POST /entities/Contractor - should create a new contractor', async () => {
      const response = await request(BASE_URL)
        .post('/entities/Contractor')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Test Contractor Co',
          contractor_type: 'subcontractor',
          email: 'test@contractor.com',
          phone: '555-1234',
          status: 'active'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('company_name', 'Test Contractor Co');
      createdContractorId = response.body.id;
    });

    test('GET /entities/Contractor/:id - should get contractor by id', async () => {
      const response = await request(BASE_URL)
        .get(`/entities/Contractor/${createdContractorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', createdContractorId);
      expect(response.body).toHaveProperty('company_name', 'Test Contractor Co');
    });

    test('PUT /entities/Contractor/:id - should update contractor', async () => {
      const response = await request(BASE_URL)
        .put(`/entities/Contractor/${createdContractorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Updated Contractor Co',
          contractor_type: 'subcontractor',
          email: 'updated@contractor.com',
          phone: '555-5678',
          status: 'active'
        })
        .expect(200);

      expect(response.body).toHaveProperty('company_name', 'Updated Contractor Co');
      expect(response.body).toHaveProperty('email', 'updated@contractor.com');
    });

    test('DELETE /entities/Contractor/:id - should delete contractor', async () => {
      await request(BASE_URL)
        .delete(`/entities/Contractor/${createdContractorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(BASE_URL)
        .get(`/entities/Contractor/${createdContractorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Health Check', () => {
    test('GET /debug/health - should return server health', async () => {
      const response = await request(BASE_URL)
        .get('/debug/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
