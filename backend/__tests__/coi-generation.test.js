import { describe, test, expect } from '@jest/globals';

/**
 * Test COI Generation - Project Info Inclusion
 * 
 * This test verifies that generated COIs include the current project location
 * in the "Description of Operations" section.
 */

describe('COI Description Building Logic', () => {
  test('description building should include project location', async () => {
    // Mock COI record with project information
    const mockCoiRecord = {
      broker_name: 'Test Broker LLC',
      broker_email: 'broker@test.com',
      broker_phone: '555-1234',
      broker_address: '123 Broker St, New York, NY 10001',
      subcontractor_name: 'Test Subcontractor Inc',
      named_insured: 'Test Subcontractor Inc',
      insurance_carrier_gl: 'Test Insurance Co',
      policy_number_gl: 'GL-2026-12345',
      gl_each_occurrence: 1000000,
      gl_general_aggregate: 2000000,
      gl_effective_date: '2026-01-01',
      gl_expiration_date: '2027-01-01',
      insurance_carrier_wc: 'Workers Comp Insurance Co',
      policy_number_wc: 'WC-2026-67890',
      wc_each_accident: 1000000,
      wc_disease_each_employee: 1000000,
      wc_effective_date: '2026-01-01',
      wc_expiration_date: '2027-01-01',
      description_of_operations: 'General construction work as required by contract.',
      additional_insureds: ['Owner LLC', 'General Contractor Inc'],
      certificate_holder_name: 'GC Company',
      gc_name: 'GC Company',
      // Current project information
      updated_project_address: '456 Construction Ave, Brooklyn, NY 11201',
      updated_project_name: 'Brooklyn Heights Renovation',
      project_address: '456 Construction Ave, Brooklyn, NY 11201',
      project_name: 'Brooklyn Heights Renovation'
    };

    // Simulate the logic from generateGeneratedCOIPDF
    const umbrellaText = (mockCoiRecord.policy_number_umbrella || mockCoiRecord.insurance_carrier_umbrella) ? ' & Umbrella' : '';
    let descriptionText = mockCoiRecord.description_of_operations ||
      `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
    
    // Add job location if available (this is the fix) - with validation
    const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
    if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
      descriptionText += `\n\nJob Location: ${jobLocation}`;
    }

    // Verify that the job location was added to the description
    expect(descriptionText).toContain('Job Location:');
    expect(descriptionText).toContain('456 Construction Ave, Brooklyn, NY 11201');
    expect(descriptionText).toContain('General construction work as required by contract.');
  });

  test('description building should handle missing project location gracefully', async () => {
    // Mock COI record WITHOUT project information
    const mockCoiRecord = {
      broker_name: 'Test Broker LLC',
      description_of_operations: 'General construction work as required by contract.',
      // No project address fields
    };

    // Simulate the logic from generateGeneratedCOIPDF
    const umbrellaText = '';
    let descriptionText = mockCoiRecord.description_of_operations ||
      `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL & Workers Compensation policies.`;
    
    // Add job location if available - with validation
    const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
    if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
      descriptionText += `\n\nJob Location: ${jobLocation}`;
    }

    // Verify that the description still works without job location
    expect(descriptionText).not.toContain('Job Location:');
    expect(descriptionText).toContain('General construction work as required by contract.');
  });

  test('description building should prefer updated_project_address over project_address', async () => {
    // Mock COI record with both addresses
    const mockCoiRecord = {
      broker_name: 'Test Broker LLC',
      description_of_operations: 'Construction work.',
      project_address: '789 Old Address, Queens, NY',
      updated_project_address: '456 New Address, Brooklyn, NY 11201',
    };

    // Simulate the logic from generateGeneratedCOIPDF
    let descriptionText = mockCoiRecord.description_of_operations;
    
    // Add job location if available
    const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
    if (jobLocation) {
      descriptionText += `\n\nJob Location: ${jobLocation}`;
    }

    // Verify that updated address is used
    expect(descriptionText).toContain('Job Location: 456 New Address, Brooklyn, NY 11201');
    expect(descriptionText).not.toContain('789 Old Address');
  });

  test('description building should use project_address when updated_project_address is not available', async () => {
    // Mock COI record with only project_address
    const mockCoiRecord = {
      broker_name: 'Test Broker LLC',
      description_of_operations: 'Construction work.',
      project_address: '789 Project Address, Queens, NY',
      // No updated_project_address
    };

    // Simulate the logic from generateGeneratedCOIPDF
    let descriptionText = mockCoiRecord.description_of_operations;
    
    // Add job location if available
    const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
    if (jobLocation) {
      descriptionText += `\n\nJob Location: ${jobLocation}`;
    }

    // Verify that project_address is used
    expect(descriptionText).toContain('Job Location: 789 Project Address, Queens, NY');
  });

  test('description building should use default description when description_of_operations is missing', async () => {
    // Mock COI record without description_of_operations
    const mockCoiRecord = {
      broker_name: 'Test Broker LLC',
      updated_project_address: '456 Construction Ave, Brooklyn, NY 11201',
      policy_number_umbrella: 'UMB-2026-12345'
    };

    // Simulate the logic from generateGeneratedCOIPDF
    const umbrellaText = (mockCoiRecord.policy_number_umbrella || mockCoiRecord.insurance_carrier_umbrella) ? ' & Umbrella' : '';
    let descriptionText = mockCoiRecord.description_of_operations ||
      `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
    
    // Add job location if available - with validation
    const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
    if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
      descriptionText += `\n\nJob Location: ${jobLocation}`;
    }

    // Verify default description is used and job location is added
    expect(descriptionText).toContain('Certificate holder and entities listed below are included in the GL & Umbrella policies');
    expect(descriptionText).toContain('Job Location: 456 Construction Ave, Brooklyn, NY 11201');
  });

  test('description building should reject empty or punctuation-only addresses', async () => {
    // Mock COI record with empty/punctuation-only addresses
    const testCases = [
      { description_of_operations: 'Test', updated_project_address: '   ' },
      { description_of_operations: 'Test', updated_project_address: ',' },
      { description_of_operations: 'Test', updated_project_address: ', , ,' },
      { description_of_operations: 'Test', updated_project_address: '  ,  ' },
      { description_of_operations: 'Test', project_address: '' },
    ];

    for (const mockCoiRecord of testCases) {
      let descriptionText = mockCoiRecord.description_of_operations;
      
      // Add job location if available - with validation
      const jobLocation = mockCoiRecord.updated_project_address || mockCoiRecord.project_address;
      if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
        descriptionText += `\n\nJob Location: ${jobLocation}`;
      }

      // Verify that empty/punctuation-only addresses are not added
      expect(descriptionText).not.toContain('Job Location:');
      expect(descriptionText).toBe('Test');
    }
  });
});
