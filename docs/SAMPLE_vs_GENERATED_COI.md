# Sample COI vs Generated COI

## Overview
The system handles **two different types** of Certificates of Insurance (COIs):

### Sample COI
**Purpose:** ACORD 25 (2016/03) template showing coverage structure requirements for this specific job

**Format:** Professional ACORD 25 form (exactly as online) with:
- ✅ **Job location** (project address)
- ✅ **Certificate holder** (General Contractor name)
- ✅ **Additional insureds** (all entities required for this project)
- ✅ **Required coverage types** (GL, WC, Umbrella, Auto as applicable)
- ✅ **Required coverage limits** (amounts from program requirements for this specific trade)
- ❌ **All data fields blank:** Broker/producer info, policy numbers, dates, carriers, named insured

**When sent:** In broker notification emails when subcontractor is added to project (including repeats)

**Who generates:** Backend email service (`generateSampleCOIPDF`) using project + program data

**Data used:**
- `project_name` - Project name
- `projectAddress` - "123 Main St, Brooklyn, NY 11201"
- `gc_name` - Certificate holder name
- `trade` - Trade type for this job (determines coverage requirements)
- `additional_insureds` - List of entities that must be covered
- Program requirements - Coverage limits for this specific trade

---

### Generated COI
**Purpose:** Actual certificate - a **regenerated version of the uploaded COI** with job-specific fields updated

**Format:** ACORD 25 (2016/03) form populated with actual insurance data

**Content (from original uploaded COI/policies):**
- ✅ **Broker/producer information** (name, contact, company) - FROM ORIGINAL
- ✅ **Policy carrier names** - FROM ORIGINAL
- ✅ **Policy numbers** - FROM ORIGINAL  
- ✅ **Effective and expiration dates** - FROM ORIGINAL
- ✅ **Coverage limits** - FROM ORIGINAL
- ✅ **Description of operations** - FROM ORIGINAL
- 🔄 **Job location** - UPDATED to this project
- 🔄 **Certificate holder** - UPDATED to this GC
- 🔄 **Additional insureds** - UPDATED to include project entities
- ❌ **Named insured stays same** - Keeps original subcontractor name

**When created:** After broker uploads actual COI PDF or policies

**How created:**
1. **Broker uploads original ACORD 25 COI + individual policies**
2. **System extracts all data** (broker, carriers, policy #s, dates, limits, operations description)
3. **System stores extracted data** in GeneratedCOI record
4. **System regenerates COI PDF** with:
   - All original insurance data preserved
   - Job location updated
   - Certificate holder updated
   - Additional insureds updated
5. **Admin reviews** for accuracy and completeness
6. **System confirms** all required additional insureds are listed
7. **Work can proceed**

---

### Generated COI
**Purpose:** Regenerated version of the broker's uploaded COI with updated job details only

**Content (from original uploaded COI):**
- ✅ **Broker/producer information** (name, contact, company) - from original
- ✅ **Policy carrier details** (insurance company name) - from original
- ✅ **Policy numbers** (GL, WC, Umbrella, Auto) - from original
- ✅ **Effective and expiration dates** (policy period) - from original
- ✅ **Coverage amounts** (actual policy limits) - from original
- ✅ **All checked boxes** (endorsements, coverage types) - exactly as uploaded
- ✅ **Description of operations** - from original
- ✅ **Manually entered policies** - preserved from original

**Updated job fields (changed per project):**
- 🔄 **Job location** (project address) - updated
- 🔄 **Certificate holder** (GC/project owner) - updated per project
- 🔄 **Additional insureds** (entities that must be covered) - updated per project

**When created:** After broker uploads actual COI PDF

**How populated:**
1. **Broker uploads ACORD 25** → System extracts producer/insured/carrier/numbers/dates/checkboxes via OCR/PDF parsing
2. **All data stored** → Policy data, limits, dates, checked endorsements, description of operations
3. **Regenerated on demand** → When used for a new project, regenerate ACORD 25 keeping all original data but updating job location, certificate holder, and additional insureds
4. **Manually entered policies included** → Any GL, WC, Umbrella, Auto policies entered manually are preserved in the record

---

## Key Differences

| Aspect | Sample COI | Generated COI |
|--------|-----------|---------------|
| **Purpose** | Project template (blank form) | Regeneration of original upload |
| **Form Type** | ACORD 25 (2016/03) | ACORD 25 (2016/03) |
| **GL Section** | Per Occurrence ☒, Per Project ☒ | Per Occurrence ☒, Per Project ☒ |
| **Broker Info** | Blank (template) | From original uploaded COI |
| **Policy Carriers** | Blank (template) | From original uploaded COI |
| **Policy Numbers** | Blank (MM/DD/YYYY placeholders) | From original uploaded COI |
| **Effective Dates** | Blank (MM/DD/YYYY) | From original uploaded COI |
| **Expiration Dates** | Blank (MM/DD/YYYY) | From original uploaded COI |
| **Coverage Limits** | From program requirements | From original uploaded COI |
| **Checked Boxes/Endorsements** | Standard coverage types | Exactly as uploaded |
| **Description of Operations** | Generic (from program) | From original uploaded COI |
| **Manually Entered Policies** | N/A | Preserved |
| **Certificate Holder** | Blank (template) | GC - updated per project |
| **Additional Insureds** | From program (template) | Updated per project, preserved original policy endorsements |
| **Job Location** | Blank (template) | Updated per project |
| **How Used** | Email to broker showing requirements | Regenerated for each project use |
| **Policy Numbers** | Blank | From uploaded COI |
| **Dates** | Blank | From uploaded COI |
| **Coverage Limits** | From program (required) | From uploaded COI (actual) |
| **Named Insured** | Blank | Original subcontractor (unchanged) |
| **Job Location** | Project address (pre-filled) | Updated to this project |
| **Certificate Holder** | GC name (pre-filled) | Updated to this GC |
| **Additional Insureds** | From project (pre-filled) | Updated to project entities |
| **Description of Operations** | Blank | From uploaded COI |
| **Format** | Professional ACORD 25 2016 | Professional ACORD 25 2016 |
| **PDF Type** | Generated by system | Regenerated from uploaded original |
| **Used For** | Broker reference/requirement | Legal binding certificate of coverage |

---

## Technical Implementation

### Sample COI Generation
```javascript
const generateSampleCOIPDF = async (data = {}) => {
  // data contains:
  // - project_name, projectAddress (job location)
  // - gc_name (certificate holder)
  // - additional_insureds (from project)
  // - program requirements (coverage limits for this trade)
  
  // Generates professional ACORD 25 (2016/03) with:
  // - Job location populated
  // - Certificate holder populated
  // - Additional insureds populated
  // - Coverage types & limits from program
  // - BLANK: Producer (broker), Insured, Policy#, Dates, Carriers
}
```

### Generated COI Creation (from uploaded COI)
```javascript
// When broker uploads original ACORD 25 COI:
// 1. Extract all data via OCR/PDF parsing
// 2. Store in GeneratedCOI record
// 3. Regenerate with job-specific fields updated

const generatedCOI = {
  // FROM ORIGINAL UPLOAD (unchanged)
  broker_name,          // ← From producer box
  broker_email,         // ← From producer info
  broker_contact,       // ← From producer info
  insured_name,         // ← From insured box (subcontractor)
  gl_policy_number,     // ← From GL section
  gl_effective_date,    // ← From GL section
  gl_expiration_date,   // ← From GL section
  gl_limit_occurrence,  // ← From GL section
  gl_limit_aggregate,   // ← From GL section
  carrier_gl,           // ← From GL section
  auto_policy_number,   // ← From auto section
  auto_effective_date,  // ← From auto section
  auto_expiration_date, // ← From auto section
  auto_limit,           // ← From auto section
  carrier_auto,         // ← From auto section
  wc_policy_number,     // ← From WC section
  wc_effective_date,    // ← From WC section
  wc_expiration_date,   // ← From WC section
  wc_limit_accident,    // ← From WC section
  carrier_wc,           // ← From WC section
  umbrella_policy_number, // ← From umbrella section
  umbrella_effective_date,  // ← From umbrella section
  umbrella_expiration_date, // ← From umbrella section
  umbrella_limit,       // ← From umbrella section
  carrier_umbrella,     // ← From umbrella section
  description_of_operations, // ← From COI description box
  
  // UPDATED FOR THIS PROJECT
  job_location,         // ← Updated to this project address
  certificate_holder,   // ← Updated to this GC name
  additional_insureds   // ← Updated to include project entities
}
```

---

## NYC Property Lookup Integration

When a GC enters a project address:

1. **Geoclient** resolves address → BBL (block/lot), BIN, borough
2. **ACRIS Deeds (Socrata)** → Owner entity (grantee from latest deed)
3. **DOB Job Filings (Socrata)** → Structure type & unit count from **latest GC permit**
   - Uses `job_type` field for structure type
   - Uses `dwelling_units` field for unit count

**Sample output:**
```json
{
  "address": "123 Main St, Brooklyn, NY 11201",
  "city": "Brooklyn",
  "state": "NY",
  "zip_code": "11201",
  "block_number": "00123",
  "lot_number": "0045",
  "bin": "1012345",
  "height_stories": 8,
  "project_type": "New Building Construction",
  "unit_count": 45,
  "owner_entity": "123 Main Street LLC",
  "additional_insured_entities": []
}
```

The system then uses these values (owner_entity, unit_count, etc.) to populate the project record and Sample COI.

---

## Data Flow

```
PROJECT SETUP
    ↓
[GC enters address]
    ↓
NYC Geoclient + DOBNow lookup
    ↓
Auto-populate: owner_entity, unit_count, structure_type
    ↓
[GC adds subcontractor to project]
    ↓
System generates Sample COI
    ↓
Broker gets email with Sample COI (template only)
    ↓
[Broker uploads actual COI PDF + policies]
    ↓
System extracts broker info, policy #s, dates
    ↓
Creates GeneratedCOI record with all policy details
    ↓
[Admin reviews and approves]
    ↓
Work can proceed
```

---

## Notes

- **Sample COI is not a legal document** — it's a requirement reference
- **Generated COI becomes the legal binding certificate** — includes all actual policy info
- **Broker uploads are required** — system cannot generate valid COIs without actual policy documents
- **OCR extraction may need manual review** — complex policy documents may require admin corrections
