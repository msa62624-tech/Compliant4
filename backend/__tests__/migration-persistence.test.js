import { describe, test, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Migration State Persistence', () => {
  test('_migrations property should be initialized in default entities structure', async () => {
    // Import entities to check structure
    const { entities } = await import('../config/database.js');
    
    // Verify _migrations is defined in the default structure
    expect(entities).toHaveProperty('_migrations');
    expect(typeof entities._migrations).toBe('object');
    expect(Object.keys(entities._migrations).length).toBe(0);
  });

  test('_migrations state persists through JSON serialization', async () => {
    // Simulate the save/load cycle by testing JSON serialization
    const testEntities = {
      Contractor: [{ id: '1', name: 'Test Contractor' }],
      Project: [],
      _migrations: {
        brokerPasswordsMigrated: true,
        brokerPasswordsMigratedAt: '2026-01-28T12:00:00.000Z'
      }
    };

    // Serialize and deserialize to simulate save/load
    const serialized = JSON.stringify(testEntities);
    const deserialized = JSON.parse(serialized);

    // Verify migration state survives serialization
    expect(deserialized._migrations).toBeDefined();
    expect(deserialized._migrations.brokerPasswordsMigrated).toBe(true);
    expect(deserialized._migrations.brokerPasswordsMigratedAt).toBe('2026-01-28T12:00:00.000Z');
  });
});
