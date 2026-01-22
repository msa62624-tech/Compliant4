// Sample data for INsuretrack backend
// This file contains comprehensive sample data for all entities

export const sampleData = {
  // Sample users for authentication (passwords stored in users array in server.js)
  usersList: [
    { id: '1', username: 'admin', email: 'admin@insuretrack.com', name: 'Admin User', role: 'super_admin' },
    { id: '2', username: 'demo', email: 'demo@insuretrack.com', name: 'Demo User', role: 'user' },
    { id: '3', username: 'broker1', email: 'sarah@nycbrokers.com', name: 'Sarah Williams', role: 'broker' },
    { id: '4', username: 'sub1', email: 'service@abcplumbing.com', name: 'Mike Johnson', role: 'subcontractor' }
  ],

  // General Contractors
  generalContractors: [
    {
      id: 'gc-001',
      company_name: 'BuildCorp Construction',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-12345',
      address: '100 Wall Street',
      city: 'New York',
      state: 'NY',
      zip_code: '10005',
      phone: '212-555-0100',
      email: 'contact@buildcorp.com',
      contact_person: 'John Smith',
      status: 'active',
      admin_id: '1',
      created_date: '2020-01-15T10:00:00Z'
    },
    {
      id: 'gc-002',
      company_name: 'Empire State Builders',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-23456',
      address: '350 5th Avenue',
      city: 'New York',
      state: 'NY',
      zip_code: '10118',
      phone: '212-555-0200',
      email: 'info@empirebuilders.com',
      contact_person: 'Sarah Williams',
      status: 'active',
      admin_id: '1',
      created_date: '2018-05-20T10:00:00Z'
    },
    {
      id: 'gc-003',
      company_name: 'Skyline Developers',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-34567',
      address: '200 Park Avenue',
      city: 'New York',
      state: 'NY',
      zip_code: '10166',
      phone: '212-555-0300',
      email: 'projects@skylinedev.com',
      contact_person: 'David Chen',
      status: 'active',
      admin_id: '1',
      created_date: '2019-03-10T10:00:00Z'
    }
  ],

  // Subcontractors
  subcontractors: [
    {
      id: 'sub-001',
      company_name: 'ABC Plumbing LLC',
      contractor_type: 'subcontractor',
      license_number: 'NYC-PL-45678',
      address: '45 Water St',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11201',
      phone: '718-555-0100',
      email: 'service@abcplumbing.com',
      contact_person: 'Mike Johnson',
      status: 'active',
      created_date: '2021-06-01T10:00:00Z'
    },
    {
      id: 'sub-002',
      company_name: 'XYZ Electrical Services',
      contractor_type: 'subcontractor',
      license_number: 'NYC-EL-56789',
      address: '78 Electric Ave',
      city: 'Queens',
      state: 'NY',
      zip_code: '11375',
      phone: '718-555-0200',
      email: 'info@xyzelectrical.com',
      contact_person: 'Tom Rodriguez',
      status: 'active',
      created_date: '2020-09-15T10:00:00Z'
    },
    {
      id: 'sub-003',
      company_name: 'Superior HVAC Inc',
      contractor_type: 'subcontractor',
      license_number: 'NYC-HV-67890',
      address: '123 Cool St',
      city: 'Bronx',
      state: 'NY',
      zip_code: '10451',
      phone: '718-555-0300',
      email: 'contact@superiorhvac.com',
      contact_person: 'Lisa Anderson',
      status: 'active',
      created_date: '2019-11-20T10:00:00Z'
    },
    {
      id: 'sub-004',
      company_name: 'Metro Concrete Works',
      contractor_type: 'subcontractor',
      license_number: 'NYC-CN-78901',
      address: '456 Foundation Blvd',
      city: 'Staten Island',
      state: 'NY',
      zip_code: '10301',
      phone: '718-555-0400',
      email: 'projects@metroconcrete.com',
      contact_person: 'James Wilson',
      status: 'active',
      created_date: '2018-04-10T10:00:00Z'
    },
    {
      id: 'sub-005',
      company_name: 'Precision Drywall & Painting',
      contractor_type: 'subcontractor',
      license_number: 'NYC-DW-89012',
      address: '789 Wall Board Ave',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11215',
      phone: '718-555-0500',
      email: 'info@precisiondrywall.com',
      contact_person: 'Maria Garcia',
      status: 'active',
      created_date: '2020-02-14T10:00:00Z'
    },
    {
      id: 'sub-006',
      company_name: 'Apex Roofing Solutions',
      contractor_type: 'subcontractor',
      license_number: 'NYC-RF-90123',
      address: '321 Shingle Road',
      city: 'Queens',
      state: 'NY',
      zip_code: '11420',
      phone: '718-555-0600',
      email: 'service@apexroofing.com',
      contact_person: 'Robert Lee',
      status: 'active',
      created_date: '2019-08-05T10:00:00Z'
    },
    {
      id: 'sub-007',
      company_name: 'Elite Steel Erectors',
      contractor_type: 'subcontractor',
      license_number: 'NYC-ST-01234',
      address: '555 Iron Way',
      city: 'Bronx',
      state: 'NY',
      zip_code: '10455',
      phone: '718-555-0700',
      email: 'contact@elitesteel.com',
      contact_person: 'Kevin Martinez',
      status: 'active',
      created_date: '2017-12-10T10:00:00Z'
    },
    {
      id: 'sub-008',
      company_name: 'Pro Masonry Contractors',
      contractor_type: 'subcontractor',
      license_number: 'NYC-MS-12345',
      address: '888 Brick Lane',
      city: 'Queens',
      state: 'NY',
      zip_code: '11385',
      phone: '718-555-0800',
      email: 'info@promasonry.com',
      contact_person: 'Anthony Russo',
      status: 'active',
      created_date: '2019-06-22T10:00:00Z'
    }
  ],

  // Brokers
  brokers: [
    {
      id: 'broker-001',
      company_name: 'NYC Insurance Brokers',
      contact_person: 'Sarah Williams',
      email: 'sarah@nycbrokers.com',
      phone: '212-555-9000',
      address: '500 Insurance Plaza',
      city: 'New York',
      state: 'NY',
      zip_code: '10017',
      license_number: 'NYS-BRK-5001',
      status: 'active',
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'broker-002',
      company_name: 'Manhattan Insurance Group',
      contact_person: 'David Thompson',
      email: 'david@manhattanins.com',
      phone: '212-555-9001',
      address: '750 Insurance Ave',
      city: 'New York',
      state: 'NY',
      zip_code: '10018',
      license_number: 'NYS-BRK-5002',
      status: 'active',
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'broker-003',
      company_name: 'Empire Coverage Solutions',
      contact_person: 'Jennifer Lopez',
      email: 'jennifer@empirecoverage.com',
      phone: '212-555-9002',
      address: '900 Policy Street',
      city: 'New York',
      state: 'NY',
      zip_code: '10019',
      license_number: 'NYS-BRK-5003',
      status: 'active',
      created_date: '2023-01-01T10:00:00Z'
    }
  ],

  // Trades - Comprehensive list
  trades: [
    { id: 'trade-001', trade_name: 'Plumbing', category: 'Mechanical', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-002', trade_name: 'Electrical', category: 'Electrical', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-003', trade_name: 'HVAC', category: 'Mechanical', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-004', trade_name: 'Concrete', category: 'Structural', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-005', trade_name: 'Drywall', category: 'Finishing', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-006', trade_name: 'Painting', category: 'Finishing', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-007', trade_name: 'Roofing', category: 'Exterior', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-008', trade_name: 'Steel Erection', category: 'Structural', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-009', trade_name: 'Masonry', category: 'Structural', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-010', trade_name: 'Carpentry', category: 'Structural', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-011', trade_name: 'Fire Protection', category: 'Mechanical', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-012', trade_name: 'Elevators', category: 'Specialty', is_active: true, requires_professional_liability: true, requires_pollution_liability: false },
    { id: 'trade-013', trade_name: 'Windows & Glazing', category: 'Exterior', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-014', trade_name: 'Flooring', category: 'Finishing', is_active: true, requires_professional_liability: false, requires_pollution_liability: false },
    { id: 'trade-015', trade_name: 'Landscaping', category: 'Site Work', is_active: true, requires_professional_liability: false, requires_pollution_liability: true }
  ],

  // Insurance Programs
  programs: [
    {
      id: 'program-001',
      name: 'Standard Commercial Program',
      description: 'Standard insurance requirements for commercial projects',
      is_active: true,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'program-002',
      name: 'High-Rise Program',
      description: 'Elevated requirements for high-rise construction projects',
      is_active: true,
      created_date: '2023-01-01T10:00:00Z'
    }
  ]
};

export default sampleData;
