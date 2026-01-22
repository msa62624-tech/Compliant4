# INsuretrack Data Model

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INSURETRACK DATA MODEL                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────────┐
│     User     │         │  Contractor  │         │ InsuranceProgram │
│              │         │              │         │                  │
│ - id         │         │ - id         │         │ - id             │
│ - username   │         │ - company    │         │ - name           │
│ - email      │◀────────│ - type (GC/  │         │ - description    │
│ - role       │admin_id │   Sub)       │         │ - is_active      │
│              │         │ - status     │         │                  │
└──────────────┘         │              │         └────────┬─────────┘
                         └──────┬───────┘                  │
                                │                          │
                                │gc_id                     │program_id
                                │                          │
                         ┌──────▼───────┐                 │
                         │   Project    │◀────────────────┘
                         │              │
                         │ - id         │
                         │ - name       │
                         │ - address    │
                         │ - state      │
                         │ - budget     │
                         │ - owner      │
                         │ - additional │
                         │   insured[]  │
                         └──────┬───────┘
                                │
                                │project_id
                                │
                    ┌───────────▼────────────┐
                    │ ProjectSubcontractor   │
                    │                        │
                    │ - id                   │
                    │ - project_id          │
                    │ - subcontractor_id    │
                    │ - trade_types[]       │
                    │ - compliance_status   │
                    └───────┬────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼─────┐  ┌──────▼──────┐  ┌───▼──────────┐
    │ Generated   │  │  Insurance  │  │ BrokerUpload │
    │    COI      │  │  Document   │  │   Request    │
    │             │  │             │  │              │
    │ - id        │  │ - id        │  │ - id         │
    │ - pdf_url   │  │ - type      │  │ - status     │
    │ - status    │  │ - policy_no │  │ - broker_id  │
    │ - coverage  │  │ - coverage  │  │              │
    └─────────────┘  └─────────────┘  └──────────────┘


┌────────────────────────────────────────────────────────────────────┐
│                    INSURANCE REQUIREMENTS                          │
└────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐         ┌──────────────────┐
    │      Trade      │         │  StateRequirement│
    │                 │         │                  │
    │ - id            │         │ - id             │
    │ - trade_name    │         │ - state          │
    │ - category      │         │ - insurance_type │
    │ - is_active     │         │ - minimum_amount │
    └────────┬────────┘         └──────────────────┘
             │
             │trade_name
             │
    ┌────────▼──────────────┐
    │ SubInsuranceRequirement│
    │                       │
    │ - id                  │
    │ - program_id          │
    │ - trade_name          │
    │ - insurance_type      │
    │ - tier (standard,     │
    │   elevated, high_risk)│
    │ - GL amounts          │
    │ - WC amounts          │
    │ - Auto amounts        │
    │ - Umbrella amounts    │
    └───────────────────────┘

---

## Entity Descriptions

### 1. User
**Purpose:** System users (admins, consultants)

**Key Fields:**
- `role`: super_admin, admin, user
- `admin_id`: Used to assign GCs to specific admins

**Relationships:**
- Manages multiple Contractors via `admin_id`

### 2. Contractor
**Purpose:** Both General Contractors and Subcontractors

**Key Fields:**
- `contractor_type`: "general_contractor" or "subcontractor"
- `status`: "active" or "inactive"
- `admin_id`: Links to managing User (for GCs only)

**Relationships:**
- Managed by User (if GC)
- Has many Projects (if GC)
- Participates in many ProjectSubcontractors (if Sub)

### 3. Project
**Purpose:** Construction projects managed by General Contractors

**Key Fields:**
- `gc_id`: Links to Contractor (type: general_contractor)
- `program_id`: Links to InsuranceProgram
- `owner_entity`: Property owner (additional insured)
- `additional_insured_entities`: Array of entities requiring AI status
- `needs_admin_setup`: Boolean flag for admin configuration

**Relationships:**
- Belongs to one Contractor (GC)
- Has one InsuranceProgram
- Has many ProjectSubcontractors

### 4. ProjectSubcontractor
**Purpose:** Links Subcontractor to Project with trade assignments

**Key Fields:**
- `project_id`: Links to Project
- `subcontractor_id`: Links to Contractor (type: subcontractor)
- `trade_types`: Array of trade names
- `compliance_status`: compliant, pending_broker, non_compliant, etc.

**Relationships:**
- Belongs to one Project
- Belongs to one Contractor (Sub)
- Has many GeneratedCOIs
- Has many InsuranceDocuments
- Has many BrokerUploadRequests

### 5. InsuranceDocument
**Purpose:** Insurance documents uploaded by contractors

**Key Fields:**
- `insurance_type`: general_liability, workers_compensation, auto_liability, etc.
- `approval_status`: pending, approved, rejected
- `expiry_date`: Coverage end date

**Relationships:**
- Belongs to one Contractor
- Belongs to one Project
- Links to ProjectSubcontractor

### 6. GeneratedCOI
**Purpose:** System-generated Certificates of Insurance

**Key Fields:**
- `project_sub_id`: Links to ProjectSubcontractor
- `hold_harmless_status`: pending_signature, signed_by_sub, signed
- Coverage fields: GL, WC, Auto, Umbrella amounts

**Relationships:**
- Belongs to one ProjectSubcontractor
- Belongs to one Project

### 7. InsuranceProgram
**Purpose:** Program templates defining insurance requirements

**Key Fields:**
- `name`: Program name (e.g., "Standard Commercial Program")
- `is_active`: Boolean

**Relationships:**
- Has many Projects
- Has many SubInsuranceRequirements

### 8. SubInsuranceRequirement
**Purpose:** Trade-specific insurance requirements within a program

**Key Fields:**
- `program_id`: Links to InsuranceProgram
- `trade_name`: Links to Trade
- `insurance_type`: Type of insurance (GL, WC, Auto, Umbrella)
- `tier`: standard, elevated, high_risk
- Coverage amounts: GL, WC, Auto, Umbrella limits

**Relationships:**
- Belongs to one InsuranceProgram
- References one Trade

### 9. Trade
**Purpose:** Available construction trades

**Key Fields:**
- `trade_name`: Name (e.g., "Plumbing", "Electrical")
- `category`: Mechanical, Electrical, Structural, etc.
- `requires_professional_liability`: Boolean
- `requires_pollution_liability`: Boolean

**Relationships:**
- Referenced by SubInsuranceRequirements
- Referenced by ProjectSubcontractors

### 10. StateRequirement
**Purpose:** State-specific insurance mandates

**Key Fields:**
- `state`: Two-letter state code
- `insurance_type`: Type of insurance
- `minimum_coverage`: Minimum amount required

**Relationships:**
- Referenced by Projects (via state field)

### 11. BrokerUploadRequest
**Purpose:** Requests sent to brokers for insurance uploads

**Key Fields:**
- `project_sub_id`: Links to ProjectSubcontractor
- `broker_id`: Links to Broker
- `status`: pending, completed, rejected

**Relationships:**
- Belongs to one ProjectSubcontractor
- Belongs to one Broker

### 12. Broker
**Purpose:** Insurance broker companies

**Key Fields:**
- `company_name`: Broker company name
- `status`: active, inactive

**Relationships:**
- Has many BrokerUploadRequests

---

## Workflow: Adding Subcontractor to Project

```
1. User selects Project
   └─> Loads Project entity with program_id

2. User adds Subcontractor
   ├─> Checks if Contractor exists (type: subcontractor)
   │   ├─> If not: Creates new Contractor
   │   └─> If yes: Uses existing Contractor
   │
   └─> Creates ProjectSubcontractor
       ├─> Links to Project (project_id)
       ├─> Links to Contractor (subcontractor_id)
       ├─> Assigns trade_types (e.g., ["Plumbing", "Fire Protection"])
       └─> Sets compliance_status = "pending_broker"

3. System loads requirements
   ├─> Queries SubInsuranceRequirement
   │   ├─> Filters by program_id (from Project)
   │   └─> Filters by trade_types (from ProjectSubcontractor)
   │
   └─> Returns requirements grouped by insurance_type
       ├─> General Liability: $1M/$2M
       ├─> Workers Comp: $1M
       ├─> Auto Liability: $1M
       └─> Umbrella: $5M (if required)

4. User can then:
   ├─> Upload insurance documents
   ├─> Request from broker
   └─> Generate COI template
```

---

## Compliance Calculation Logic

```
For each ProjectSubcontractor:

1. Get all trade_types assigned
   └─> ["Plumbing", "Fire Protection"]

2. Get requirements for each trade
   └─> Query SubInsuranceRequirement
       ├─> Filter by program_id
       ├─> Filter by trade_name IN trade_types
       └─> Group by insurance_type

3. For each insurance_type, use HIGHEST tier
   └─> If Plumbing requires $1M GL and Fire Protection requires $2M GL
       └─> Compliance requires $2M GL

4. Get subcontractor's insurance documents
   └─> Query InsuranceDocument
       ├─> Filter by subcontractor_name
       └─> Filter by gc_id

5. Compare documents to requirements
   ├─> Check coverage amounts
   ├─> Check expiration dates
   ├─> Check endorsements (AI, WOS, P&NC)
   └─> Determine compliance_status:
       ├─> compliant: All requirements met
       ├─> pending_broker: No docs, broker request sent
       ├─> non_compliant: Missing or insufficient coverage
       ├─> expiring_soon: Coverage expires within 30 days
       └─> pending_hold_harmless: COI generated, awaiting signature
```

---

## Insurance Types Supported

1. **General Liability (GL)**
   - Each Occurrence
   - General Aggregate
   - Products/Completed Operations Aggregate
   - Personal & Advertising Injury
   - Damage to Rented Premises
   - Medical Expense

2. **Workers Compensation (WC)**
   - Each Accident
   - Disease - Policy Limit
   - Disease - Each Employee

3. **Auto Liability**
   - Combined Single Limit
   - Or: Bodily Injury + Property Damage

4. **Umbrella Policy**
   - Each Occurrence
   - Aggregate

5. **Professional Liability** (trade-specific)
   - Per Claim
   - Aggregate

6. **Pollution Liability** (trade-specific)
   - Per Claim
   - Aggregate

7. **Builders Risk** (project-specific)
   - Total Project Value

---

## Requirement Tiers

Projects can specify different requirement tiers for different risk levels:

### Standard Tier
- General Liability: $1M / $2M
- Workers Comp: $1M / $1M / $1M
- Auto Liability: $1M CSL
- Umbrella: Optional or $5M

### Elevated Tier
- General Liability: $2M / $4M
- Workers Comp: $1M / $1M / $1M
- Auto Liability: $1M CSL
- Umbrella: Required $5M

### High Risk Tier
- General Liability: $5M / $5M
- Workers Comp: $1M / $1M / $1M
- Auto Liability: $2M CSL
- Umbrella: Required $10M
- Professional Liability: May be required
- Pollution Liability: May be required

---

## Additional Insured Logic

```
For each Project:
  ├─> Certificate Holder: GC (always)
  │
  └─> Additional Insured (all must be listed):
      ├─> GC (General Contractor)
      ├─> Owner Entity (from project.owner_entity)
      └─> Additional Entities (from project.additional_insured_entities[])
          ├─> Property owners
          ├─> Lenders
          ├─> Management companies
          └─> Adjacent property owners

Required Endorsements:
  ├─> Additional Insured for ongoing and completed operations
  ├─> Primary and Non-Contributory (P&NC)
  ├─> Waiver of Subrogation (WOS)
  └─> Blanket AI with privity is NOT acceptable
```

---

## State-Specific Requirements

Some states have specific insurance mandates that override or supplement program requirements:

Example: New York
- Workers Compensation: Statutory (required by state law)
- Minimum coverage: $1,000,000
- Must show NY on certificate

Example: California
- Workers Compensation: Statutory
- Additional requirements for certain trades
- Special earthquake coverage may be required

**Priority:** State Requirements > Program Requirements

---

## Future Enhancements

### Phase 1 (Current):
- ✅ In-memory storage
- ✅ Manual document upload
- ✅ Basic compliance checking
- ✅ COI template generation

### Phase 2 (Near-term):
- 🔲 PostgreSQL/MongoDB integration
- 🔲 Automated document parsing (OCR + LLM)
- 🔲 Automated compliance calculations
- 🔲 Email notifications for expiring coverage
- 🔲 Real Adobe Sign integration

### Phase 3 (Long-term):
- 🔲 Integration with insurance carriers' APIs
- 🔲 Real-time policy verification
- 🔲 Automated certificate issuance
- 🔲 Advanced analytics and reporting
- 🔲 Mobile app for field access
