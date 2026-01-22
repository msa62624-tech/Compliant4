# INsuretrack API Documentation

## Overview
Complete API documentation for the INsuretrack insurance tracking system for General Contractors and their projects.

## Base URL
- **Development:** `http://localhost:3001`
- **Codespaces:** `https://organic-system-wrpwv4xxwvxv3v4pw-3001.app.github.dev`
- **Production:** TBD

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Login
**POST** `/auth/login`

Request:
```json
{
  "username": "admin",
  "password": "INsure2026!"
}
```

Response:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "1",
    "username": "admin",
    "email": "admin@insuretrack.com",
    "name": "Admin User",
    "role": "super_admin"
  }
}
```

**Available Users:**
- `admin` / `INsure2026!` (super_admin role)
- `demo` / `demo` (user role)

### Refresh Token
**POST** `/auth/refresh`

Request:
```json
{
  "refreshToken": "eyJhbGc..."
}
```

Response:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Get Current User
**GET** `/auth/me` *(requires auth)*

Response:
```json
{
  "id": "1",
  "username": "admin",
  "email": "admin@insuretrack.com",
  "name": "Admin User",
  "role": "super_admin"
}
```

---

## Entity Endpoints

All entity endpoints follow the same pattern:

### List All Entities
**GET** `/entities/:entityName` *(requires auth)*

Query Parameters:
- `sort` - Field name to sort by (e.g., `created_date`)

Example:
```
GET /entities/Project?sort=created_date
```

### Query/Filter Entities
**POST** `/entities/:entityName/query` *(requires auth)*

Request:
```json
{
  "gc_id": "gc-001",
  "status": "active"
}
```

### Create Entity
**POST** `/entities/:entityName` *(requires auth)*

Request: Entity data (see entity schemas below)

Response: Created entity with auto-generated `id`, `createdAt`, and `createdBy` fields

### Update Entity
**PATCH** `/entities/:entityName/:id` *(requires auth)*

Request: Partial entity data to update

Response: Updated entity with `updatedAt` and `updatedBy` fields

### Delete Entity
**DELETE** `/entities/:entityName/:id` *(requires auth)*

Response: Deleted entity

---

## Entity Schemas

### Contractor
Represents both General Contractors and Subcontractors.

```json
{
  "id": "gc-001",
  "company_name": "BuildCorp Construction",
  "contractor_type": "general_contractor",  // or "subcontractor"
  "license_number": "NYC-GC-12345",
  "address": "100 Wall Street",
  "city": "New York",
  "state": "NY",
  "zip_code": "10005",
  "mailing_address": "Optional separate mailing address",
  "phone": "212-555-0100",
  "email": "contact@buildcorp.com",
  "contact_person": "John Smith",
  "additional_contacts": [],
  "status": "active",
  "admin_id": "1",  // ID of admin managing this GC
  "master_insurance_data": {},  // Optional: Stored insurance info
  "created_date": "2020-01-15T10:00:00Z"
}
```

**Fields:**
- `contractor_type`: `"general_contractor"` or `"subcontractor"`
- `status`: `"active"` or `"inactive"`
- `admin_id`: Used to assign GCs to specific admin users

### Project
Represents a construction project managed by a General Contractor.

```json
{
  "id": "proj-001",
  "project_name": "Hudson Yards Tower B",
  "gc_id": "gc-001",
  "gc_name": "BuildCorp Construction",
  "gc_address": "100 Wall Street, New York, NY 10005",
  "address": "500 W 33rd St",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001",
  "project_type": "Commercial High-Rise",
  "start_date": "2024-01-01",
  "estimated_completion": "2025-12-31",
  "budget": 50000000,
  "status": "active",
  "program_id": "program-001",
  "owner_entity": "Hudson Yards Development LLC",
  "additional_insured_entities": [
    "Hudson Yards Property LLC",
    "Related Companies"
  ],
  "needs_admin_setup": false,
  "created_date": "2023-11-01T10:00:00Z"
}
```

**Fields:**
- `program_id`: Links to InsuranceProgram defining insurance requirements
- `owner_entity`: Property owner to be listed as additional insured
- `additional_insured_entities`: Array of entities requiring additional insured status
- `needs_admin_setup`: Boolean flag indicating if admin setup is required

### ProjectSubcontractor
Links a Subcontractor to a Project with their specific trade assignments.

```json
{
  "id": "ps-001",
  "project_id": "proj-001",
  "project_name": "Hudson Yards Tower B",
  "subcontractor_id": "sub-001",
  "subcontractor_name": "ABC Plumbing LLC",
  "gc_id": "gc-001",
  "program_id": "program-001",
  "trade_type": "Plumbing",  // Primary trade
  "trade_types": ["Plumbing", "Fire Protection"],  // All trades
  "contact_email": "service@abcplumbing.com",
  "contact_phone": "718-555-0100",
  "compliance_status": "compliant",  // or "pending_broker", "non_compliant", etc.
  "notes": "",
  "created_date": "2024-01-15T10:00:00Z"
}
```

**Compliance Statuses:**
- `compliant` - All requirements met
- `pending_broker` - Waiting for broker to submit insurance
- `pending_hold_harmless` - Waiting for hold harmless signature
- `non_compliant` - Missing or insufficient insurance
- `expiring_soon` - Insurance expiring within 30 days

### InsuranceDocument
Insurance documents uploaded by contractors.

```json
{
  "id": "doc-001",
  "subcontractor_name": "ABC Plumbing LLC",
  "contractor_id": "gc-001",
  "project_id": "proj-001",
  "gc_id": "gc-001",
  "document_type": "Certificate of Insurance",
  "insurance_type": "general_liability",
  "policy_number": "POL-2024-001",
  "insurance_carrier": "ABC Insurance Co",
  "coverage_amount": 2000000,
  "effective_date": "2024-01-01",
  "expiry_date": "2025-12-31",
  "approval_status": "approved",
  "status": "active",
  "file_url": "https://...",
  "created_by": "demo@insuretrack.com",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Insurance Types:**
- `general_liability`
- `workers_compensation`
- `auto_liability`
- `umbrella_policy`
- `professional_liability`
- `pollution_liability`
- `builders_risk`

**Approval Status:**
- `pending` - Awaiting review
- `approved` - Approved by admin
- `rejected` - Rejected, needs resubmission

### SubInsuranceRequirement
Insurance requirements for specific trades within a program.

```json
{
  "id": "req-001",
  "program_id": "program-001",
  "trade_name": "Plumbing",
  "insurance_type": "general_liability",
  "tier": "standard",  // or "elevated", "high_risk"
  "is_required": true,
  "gl_each_occurrence": 1000000,
  "gl_general_aggregate": 2000000,
  "gl_products_completed_ops": 2000000,
  "gl_personal_adv_injury": 1000000,
  "gl_damage_rented_premises": 300000,
  "gl_med_exp": 10000,
  "created_date": "2023-01-01T10:00:00Z"
}
```

**Fields by Insurance Type:**

*General Liability:*
- `gl_each_occurrence`
- `gl_general_aggregate`
- `gl_products_completed_ops`
- `gl_personal_adv_injury`
- `gl_damage_rented_premises`
- `gl_med_exp`

*Workers Compensation:*
- `wc_each_accident`
- `wc_disease_policy_limit`
- `wc_disease_each_employee`

*Auto Liability:*
- `auto_combined_single_limit`

*Umbrella:*
- `umbrella_each_occurrence`
- `umbrella_aggregate`

### StateRequirement
State-specific insurance requirements.

```json
{
  "id": "state-req-001",
  "state": "NY",
  "insurance_type": "workers_compensation",
  "minimum_coverage": 1000000,
  "is_required": true,
  "notes": "New York State requires statutory workers compensation",
  "created_date": "2023-01-01T10:00:00Z"
}
```

### Trade
Available construction trades.

```json
{
  "id": "trade-001",
  "trade_name": "Plumbing",
  "category": "Mechanical",
  "is_active": true,
  "requires_professional_liability": false,
  "requires_pollution_liability": false,
  "created_date": "2023-01-01T10:00:00Z"
}
```

**Categories:**
- `Mechanical` - HVAC, Plumbing, Fire Protection
- `Electrical` - Electrical, Low Voltage
- `Structural` - Concrete, Steel, Masonry
- `Finishing` - Drywall, Painting, Flooring
- `Site Work` - Excavation, Paving, Landscaping

### InsuranceProgram
Insurance program template defining requirements.

```json
{
  "id": "program-001",
  "name": "Standard Commercial Program",
  "description": "Standard insurance requirements for commercial projects",
  "is_active": true,
  "created_date": "2023-01-01T10:00:00Z"
}
```

### GeneratedCOI
System-generated Certificate of Insurance.

```json
{
  "id": "coi-001",
  "project_id": "proj-001",
  "project_sub_id": "ps-001",
  "subcontractor_name": "ABC Plumbing LLC",
  "gc_id": "gc-001",
  "state": "NY",
  "status": "active",
  "pdf_url": "https://...",
  "hold_harmless_status": "signed",
  "gl_each_occurrence": 1000000,
  "gl_general_aggregate": 2000000,
  "policy_number_gl": "GL-123456",
  "insurance_carrier_gl": "ABC Insurance",
  "gl_effective_date": "2024-01-01",
  "gl_expiration_date": "2025-01-01",
  "created_date": "2024-01-15T10:00:00Z"
}
```

**Hold Harmless Statuses:**
- `pending_signature` - Awaiting subcontractor signature
- `signed_by_sub` - Signed by sub, awaiting GC review
- `signed` - Fully executed

### Broker
Insurance broker information.

```json
{
  "id": "broker-001",
  "company_name": "NYC Insurance Brokers",
  "contact_person": "Sarah Williams",
  "email": "sarah@nycbrokers.com",
  "phone": "212-555-9000",
  "address": "123 Broker St, New York, NY",
  "status": "active",
  "created_date": "2023-01-01T10:00:00Z"
}
```

### BrokerUploadRequest
Requests sent to brokers to upload insurance.

```json
{
  "id": "bur-001",
  "project_id": "proj-001",
  "project_sub_id": "ps-001",
  "broker_id": "broker-001",
  "subcontractor_name": "ABC Plumbing LLC",
  "status": "pending",
  "request_date": "2024-01-15T10:00:00Z",
  "requirements": {},
  "notes": ""
}
```

### User
System users (admins, consultants).

```json
{
  "id": "1",
  "username": "admin",
  "email": "admin@insuretrack.com",
  "name": "Admin User",
  "role": "super_admin",
  "phone": "212-555-0000",
  "created_date": "2023-01-01T10:00:00Z"
}
```

**Roles:**
- `super_admin` - Full system access
- `admin` - Manages assigned GCs and their projects
- `user` - Read-only or limited access

### Subscription
GC subscription plans and billing.

```json
{
  "id": "sub-001",
  "gc_id": "gc-001",
  "plan_type": "per_project",
  "status": "active",
  "amount": 500,
  "billing_cycle": "monthly",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "created_date": "2024-01-01T10:00:00Z"
}
```

---

## Integration Endpoints

### LLM Integration
**POST** `/integrations/invoke-llm` *(requires auth)*

Request:
```json
{
  "prompt": "Extract insurance data from this document...",
  "model": "gpt-4"
}
```

Response:
```json
{
  "text": "Mock LLM response...",
  "model": "gpt-4",
  "tokens": 42
}
```

### Email Integration
**POST** `/integrations/send-email` *(requires auth)*

Request:
```json
{
  "to": "broker@example.com",
  "subject": "Insurance Upload Request",
  "body": "Please upload insurance for..."
}
```

Response:
```json
{
  "ok": true,
  "messageId": "msg-1234567890"
}
```

### File Upload
**POST** `/integrations/upload-file` *(requires auth)*

Response:
```json
{
  "url": "https://storage.example.com/file-1234567890.pdf"
}
```

### Adobe Sign Integration

#### Upload Transient Document
**POST** `/integrations/adobe/transientDocument` *(requires auth)*

Response:
```json
{
  "transientDocumentId": "transient-1234567890"
}
```

#### Create Agreement
**POST** `/integrations/adobe/agreement` *(requires auth)*

Request:
```json
{
  "name": "Hold Harmless Agreement",
  "transientDocumentId": "transient-1234567890"
}
```

Response:
```json
{
  "agreementId": "agr-1234567890",
  "name": "Hold Harmless Agreement",
  "status": "DRAFT",
  "transientDocumentId": "transient-1234567890"
}
```

#### Get Signing URL
**GET** `/integrations/adobe/agreement/:agreementId/url` *(requires auth)*

Response:
```json
{
  "url": "https://secure.adobesign.com/sign/agr-1234567890"
}
```

---

## Frontend API Client

The frontend uses a custom `compliantClient.js` that provides a clean interface:

```javascript
import { compliant } from './api/compliantClient';

// Authentication
const { accessToken, user } = await compliant.auth.login({ username, password });
const currentUser = await compliant.auth.me();

// Entity operations
const projects = await compliant.entities.Project.list();
const activeProjects = await compliant.entities.Project.filter({ status: 'active' });
const newProject = await compliant.entities.Project.create({ /* data */ });
const updated = await compliant.entities.Project.update(id, { /* data */ });
await compliant.entities.Project.delete(id);

// All available entities:
compliant.entities.Contractor
compliant.entities.Project
compliant.entities.ProjectSubcontractor
compliant.entities.InsuranceDocument
compliant.entities.SubInsuranceRequirement
compliant.entities.StateRequirement
compliant.entities.Trade
compliant.entities.InsuranceProgram
compliant.entities.GeneratedCOI
compliant.entities.Broker
compliant.entities.BrokerUploadRequest
compliant.entities.User
compliant.entities.Subscription
compliant.entities.PolicyDocument
compliant.entities.COIDocument
compliant.entities.ComplianceCheck
compliant.entities.ProgramTemplate
compliant.entities.Portal
compliant.entities.Message
```

---

## Workflow Examples

### Creating a New General Contractor

1. **Create Contractor:**
```javascript
const gc = await compliant.entities.Contractor.create({
  company_name: "NewBuild Construction",
  contractor_type: "general_contractor",
  contact_person: "Jane Doe",
  email: "jane@newbuild.com",
  phone: "212-555-1234",
  address: "456 Construction Ave",
  city: "New York",
  state: "NY",
  zip_code: "10001",
  license_number: "NYC-GC-99999",
  status: "active",
  admin_id: "1"
});
```

### Creating a New Project

1. **Create Project:**
```javascript
const project = await compliant.entities.Project.create({
  project_name: "Downtown Office Tower",
  gc_id: "gc-001",
  gc_name: "BuildCorp Construction",
  gc_address: "100 Wall Street, New York, NY 10005",
  address: "789 Business Blvd",
  city: "New York",
  state: "NY",
  zip_code: "10002",
  project_type: "Commercial",
  start_date: "2024-06-01",
  estimated_completion: "2025-12-31",
  budget: 35000000,
  status: "active",
  program_id: "program-001",
  owner_entity: "Downtown Properties LLC",
  additional_insured_entities: ["Downtown Holdings", "City Bank"],
  needs_admin_setup: false
});
```

### Adding a Subcontractor to a Project

1. **Check if subcontractor exists:**
```javascript
const existingSubs = await compliant.entities.Contractor.filter({
  company_name: "ABC Plumbing LLC",
  contractor_type: "subcontractor"
});
```

2. **Create if doesn't exist:**
```javascript
if (existingSubs.length === 0) {
  await compliant.entities.Contractor.create({
    company_name: "ABC Plumbing LLC",
    contractor_type: "subcontractor",
    // ... other fields
  });
}
```

3. **Add to project:**
```javascript
const projectSub = await compliant.entities.ProjectSubcontractor.create({
  project_id: "proj-001",
  project_name: "Downtown Office Tower",
  subcontractor_id: "sub-001",
  subcontractor_name: "ABC Plumbing LLC",
  gc_id: "gc-001",
  program_id: "program-001",
  trade_type: "Plumbing",
  trade_types: ["Plumbing", "Fire Protection"],
  contact_email: "service@abcplumbing.com",
  contact_phone: "718-555-0100",
  compliance_status: "pending_broker"
});
```

### Checking Compliance

1. **Get requirements for project:**
```javascript
const requirements = await compliant.entities.SubInsuranceRequirement.filter({
  program_id: project.program_id
});
```

2. **Get subcontractor's documents:**
```javascript
const documents = await compliant.entities.InsuranceDocument.filter({
  subcontractor_name: "ABC Plumbing LLC",
  gc_id: project.gc_id
});
```

3. **Check if all requirements are met by comparing document coverage to requirements**

---

## Error Responses

All endpoints return standard error responses:

**401 Unauthorized:**
```json
{
  "error": "Invalid credentials"
}
```

**403 Forbidden:**
```json
{
  "error": "Access denied"
}
```

**404 Not Found:**
```json
{
  "error": "Entity Project not found"
}
```

---

## Development Notes

- **Storage:** Currently using in-memory storage. Data resets on server restart. For production, migrate to PostgreSQL or MongoDB.
- **File Storage:** File URLs are currently mocked. Integrate with S3/Azure Blob Storage for production.
- **Email:** Email endpoints return mock responses. Configure SendGrid/AWS SES for production.
- **Adobe Sign:** Adobe integration endpoints are stubs. Configure Adobe Sign API credentials for production.
- **Authentication:** JWT tokens expire in 1 hour. Refresh tokens expire in 7 days.

---

## Next Steps for Production

1. **Database Integration:**
   - Set up PostgreSQL or MongoDB
   - Create database migrations
   - Update entity endpoints to use database

2. **File Storage:**
   - Configure S3 or Azure Blob Storage
   - Implement file upload/download endpoints
   - Add file validation and scanning

3. **Email Service:**
   - Configure SendGrid or AWS SES
   - Create email templates
   - Add email tracking

4. **Adobe Sign:**
   - Register Adobe Sign API credentials
   - Implement full signing workflow
   - Add webhook handlers for status updates

5. **Security:**
   - Add rate limiting
   - Implement CORS properly for production domains
   - Add input validation and sanitization
   - Implement role-based access control (RBAC)
   - Add audit logging

6. **Monitoring:**
   - Add error tracking (Sentry)
   - Add performance monitoring (New Relic/DataDog)
   - Add logging (Winston/Bunyan)
