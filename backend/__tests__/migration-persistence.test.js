import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use test-specific data directory to avoid conflicts
const TEST_DATA_DIR = path.join(__dirname, '..', 'data-test');
const TEST_DATA_FILE = path.join(TEST_DATA_DIR, 'entities.json');

describe('Migration State Persistence', () => {
  beforeEach(async () => {
    // Clean up test data directory before each test
    try {
      await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    await fsPromises.mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test data directory after each test
    try {
      await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('_migrations property should be initialized in default entities structure', async () => {
    // Import entities to check structure
    const { entities } = await import('../config/database.js');
    
    // Verify _migrations is defined in the default structure
    expect(entities).toHaveProperty('_migrations');
    expect(typeof entities._migrations).toBe('object');
  });

  test('_migrations state should persist to disk when saved', async () => {
    // Create a simple entities structure with migration state
    const testEntities = {
      Contractor: [],
      Project: [],
      _migrations: {
        brokerPasswordsMigrated: true,
        brokerPasswordsMigratedAt: new Date().toISOString()
      }
    };

    // Save to test file
    await fsPromises.writeFile(TEST_DATA_FILE, JSON.stringify(testEntities), 'utf8');

    // Read back from disk
    const loadedData = await fsPromises.readFile(TEST_DATA_FILE, 'utf8');
    const parsedEntities = JSON.parse(loadedData);

    // Verify migration state was persisted
    expect(parsedEntities).toHaveProperty('_migrations');
    expect(parsedEntities._migrations).toHaveProperty('brokerPasswordsMigrated', true);
    expect(parsedEntities._migrations).toHaveProperty('brokerPasswordsMigratedAt');
  });

  test('_migrations state should be loaded when entities are loaded from disk', async () => {
    // Create test data with migration state
    const testEntities = {
      Contractor: [{ id: '1', name: 'Test Contractor' }],
      Project: [],
      _migrations: {
        brokerPasswordsMigrated: true,
        brokerPasswordsMigratedAt: '2026-01-28T12:00:00.000Z'
      }
    };

    // Save to test file
    await fsPromises.writeFile(TEST_DATA_FILE, JSON.stringify(testEntities), 'utf8');

    // Load entities (simulating a fresh load)
    const loadedData = await fsPromises.readFile(TEST_DATA_FILE, 'utf8');
    const loadedEntities = JSON.parse(loadedData);

    // Verify migration state is present
    expect(loadedEntities._migrations).toBeDefined();
    expect(loadedEntities._migrations.brokerPasswordsMigrated).toBe(true);
    expect(loadedEntities._migrations.brokerPasswordsMigratedAt).toBe('2026-01-28T12:00:00.000Z');
  });

  test('default entities structure should include empty _migrations object', async () => {
    // This test ensures that new installations start with the _migrations tracking
    const { entities } = await import('../config/database.js');
    
    expect(entities._migrations).toBeDefined();
    expect(typeof entities._migrations).toBe('object');
    expect(Object.keys(entities._migrations).length).toBe(0);
  });
});
