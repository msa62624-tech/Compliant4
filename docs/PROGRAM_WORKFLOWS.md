# Program Workflows Documentation

## Overview

INsuretrack implements sophisticated workflows for managing insurance compliance throughout the construction project lifecycle. This document details the complete workflows for all user roles, from initial subcontractor onboarding through final COI approval and work authorization.

---

## Table of Contents

1. [First-Time Subcontractor Workflow](#first-time-subcontractor-workflow)
2. [Returning Subcontractor Workflow](#returning-subcontractor-workflow)
3. [Role-Specific Workflows](#role-specific-workflows)
4. [COI Approval Workflow](#coi-approval-workflow)
5. [Notification Flow](#notification-flow)
6. [Program Management](#program-management)

---

## Workflow Types

The system implements **two primary workflows** based on whether the subcontractor has previously submitted insurance documents:

| Workflow Type | Trigger | Key Difference | Timeline |
|--------------|---------|----------------|----------|
| **First-Time** | Subcontractor has no prior insurance on file | Requires full policy document upload | 5-10 business days |
| **Returning** | Subcontractor has existing policies on file | Uses existing policies, faster approval | 2-3 business days |

---

## First-Time Subcontractor Workflow

### Overview
When a subcontractor is added to their **first project** or has **no insurance on file**, they must go through the full insurance setup process.

### Complete Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIRST-TIME WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: GC Adds Subcontractor to Project
   ↓
Step 2: System Identifies First-Time Status
   ↓
Step 3: Subcontractor Receives Onboarding Email
   ↓
Step 4: Subcontractor Assigns/Contacts Broker
   ↓
Step 5: Broker Uploads Full Insurance Package
   ↓
Step 6: Admin Reviews Insurance Documents
   ↓
Step 7: System Generates COI for Project
   ↓
Step 8: Admin Approves COI
   ↓
Step 9: Hold Harmless Agreement Generated
   ↓
Step 10: Subcontractor Signs Agreement
   ↓
Step 11: GC Countersigns Agreement
   ↓
Step 12: Work Approved - Subcontractor Can Proceed
```

---

### Step 1: GC Adds Subcontractor to Project

**Who:** General Contractor  
**Where:** GC Dashboard → Projects → Add Subcontractor

**Actions:**
1. Log into GC Portal
2. Navigate to specific project
3. Click "Add Subcontractor"
4. Fill in form:
   - Company name
   - Contact email
   - Phone number
   - Trade(s) they'll perform (e.g., Electrical, Plumbing)
   - Estimated contract value (optional)
5. Submit

**System Actions:**
- Creates `ProjectSubcontractor` record linking sub to project
- Checks if subcontractor has prior insurance submissions
- Identifies as "First-Time" workflow
- Triggers onboarding notification

---

### Step 2: System Identifies First-Time Status

**Automatic Check:**
```javascript
const status = await isFirstTimeSubcontractor(subcontractorId, projectId);
// Returns:
// {
//   isFirstTime: true,
//   previousSubmissions: 0,
//   hasActiveInsurance: false
// }
```

**Criteria for First-Time:**
- No prior COI uploads (`first_coi_uploaded` = false)
- No broker signature on file
- No active/approved COIs in system
- No policy documents uploaded

**Result:**
- System sets workflow type to "FIRST_TIME"
- Generates appropriate email template
- Sets required actions for broker and subcontractor

---

### Step 3: Subcontractor Receives Onboarding Email

**To:** Subcontractor email (from GC form)  
**Subject:** "Welcome to [Project Name] - Insurance Setup Required"

**Email Content:**
```
Dear [Subcontractor Company],

Welcome! You've been added to the [Project Name] project.

🏗️ PROJECT DETAILS:
• Project: [Project Name]
• Location: [Address]
• General Contractor: [GC Company Name]
• Your Trade(s): [Trades]

📋 FIRST TIME SETUP REQUIRED:

This is your first project submission. Your broker will need to upload 
your insurance documents to get you approved.

REQUIRED DOCUMENTS:
✅ ACORD 25 Certificate Form
✅ General Liability (GL) Policy
✅ Workers' Compensation (WC) Policy  
✅ Auto Liability Policy
✅ Excess/Umbrella Policy (if required for your trade)

📝 NEXT STEPS:

1. Contact your insurance broker
2. Your broker will upload your policies
3. Admin reviews and approves
4. You receive approval notification
5. Sign Hold Harmless Agreement
6. Work can begin!

🔗 ACCESS YOUR PORTAL:
[Link to Subcontractor Dashboard]

Need help? Reply to this email or contact your GC.

Best regards,
The INsuretrack Team
```

---

### Step 4: Subcontractor Assigns/Contacts Broker

**Who:** Subcontractor  
**Where:** Subcontractor Portal or Direct Contact

**Options:**

**Option A: Assign Broker via Portal**
1. Log into Subcontractor Dashboard
2. Go to Project → Insurance tab
3. Click "Assign Broker" or "Select Broker"
4. Search for broker by name or email
5. Send broker assignment request
6. Broker receives notification with portal access

**Option B: Contact Broker Directly**
1. Email or call insurance broker
2. Provide project details and GC contact
3. Broker logs into Broker Portal independently
4. Broker finds subcontractor client in system

**Broker Receives:**
- Email: "New Insurance Upload Request"
- Portal link to Broker Dashboard
- List of required documents
- Project insurance requirements
- Deadline for submission

---

### Step 5: Broker Uploads Full Insurance Package

**Who:** Insurance Broker  
**Where:** Broker Portal → Clients → [Subcontractor] → Upload Documents

**Required Documents:**

| Document | Required | Notes |
|----------|----------|-------|
| ACORD 25 Certificate | ✅ Yes | Current certificate form |
| General Liability Policy | ✅ Yes | Full policy with declarations |
| Workers' Compensation Policy | ✅ Yes | State-specific coverage |
| Auto Liability Policy | ✅ Yes | Including Hired & Non-Owned |
| Umbrella/Excess Policy | ⚠️ Depends on trade | Required for Tier 2 & 3 trades |
| Additional Endorsements | ⚠️ As needed | CG2010, CG2037, etc. |

**Upload Process:**
1. Broker logs into Broker Portal
2. Selects subcontractor client
3. Navigates to document upload section
4. For each policy:
   - Click "Upload [Policy Type]"
   - Select PDF file
   - Add policy effective dates
   - Add policy number
   - Add insurance carrier name
5. Review all uploads
6. Click "Submit for Review"
7. System validates all required docs present

**System Actions:**
- Stores documents in secure storage
- Links documents to subcontractor master record
- Creates `PolicyDocument` records
- Updates `Contractor.master_insurance_data`
- Notifies admin of pending review
- Sets subcontractor status to "Documents Uploaded - Pending Review"

---

### Step 6: Admin Reviews Insurance Documents

**Who:** Admin/Compliance Team  
**Where:** Admin Dashboard → Pending Reviews

**Review Checklist:**

✅ **Document Completeness**
- All required documents uploaded
- Documents are legible and complete
- No pages missing

✅ **Coverage Dates**
- Policies are currently active
- Effective dates cover project period
- No lapses in coverage

✅ **Coverage Amounts**
- GL limits meet or exceed requirements (by trade tier)
- WC limits are adequate
- Auto limits meet minimums
- Umbrella coverage (if required)

✅ **Required Endorsements**
- CG2010 (Additional Insured) present
- CG2037 (Primary & Non-Contributory) present
- Waiver of Subrogation included
- All project additional insureds named

✅ **Insurance Carrier**
- Carrier is admitted in project state
- Carrier has adequate AM Best rating (typically A- or better)
- No excluded carriers

**Actions:**
1. Download and review each policy document
2. Check against project requirements
3. Verify trade-specific requirements met
4. If issues found:
   - Document deficiencies
   - Send deficiency notification to broker
   - Request corrected documents
5. If all requirements met:
   - Click "Approve Insurance Documents"
   - Proceed to COI generation

---

### Step 7: System Generates COI for Project

**Trigger:** Admin approves insurance documents

**Automatic Process:**
```javascript
const coi = await generateCOI({
  subcontractor_id: sub.id,
  project_id: project.id,
  gc_id: project.gc_id,
  insurance_data: approvedDocuments,
  requirements: projectRequirements,
  status: 'pending_review'
});
```

**COI Contains:**
- Subcontractor information
- Project details (name, location, dates)
- GC information
- Project Owner information
- All Additional Insureds
- Coverage limits for each policy type
- Policy numbers and carriers
- Effective dates
- Required endorsements
- Links to source policy documents

**System Actions:**
- Creates `GeneratedCOI` record
- Populates with insurance data from uploaded policies
- Applies project-specific requirements
- Sets status to `pending_review`
- Moves to final admin approval queue

---

### Step 8: Admin Approves COI

**Who:** Admin  
**Where:** Admin Dashboard → COI Review

**Review Process:**
1. Open generated COI
2. Verify all fields populated correctly
3. Check compliance against requirements
4. Review any compliance issues flagged
5. Verify all required endorsements listed
6. Check certificate formatting

**Approval Actions:**
- Click "Approve COI"
- System updates COI status to `approved`
- Triggers hold harmless agreement generation
- Sends notifications to all parties

**Post-Approval:**
- COI is now official record
- Subcontractor can download from portal
- GC can view in project dashboard
- Moves to Hold Harmless workflow

---

### Step 9: Hold Harmless Agreement Generated

**Automatic Process:**

See [Hold Harmless Workflow](./HOLD_HARMLESS_WORKFLOW.md) for complete details.

**Summary:**
- System generates customized Hold Harmless template
- Includes project details, parties, and indemnification language
- Stored as `hold_harmless_template_url`
- Status set to `pending_signature`
- Subcontractor notified to download, sign, and upload

---

### Step 10-12: Signature and Final Approval

See [Hold Harmless Workflow](./HOLD_HARMLESS_WORKFLOW.md) for complete signature process.

**Summary:**
- Step 10: Subcontractor downloads, signs, uploads agreement
- Step 11: GC reviews and countersigns
- Step 12: All parties notified - work approved

**Final Status:**
- Insurance: ✅ Approved
- COI: ✅ Active
- Hold Harmless: ✅ Signed
- Work Authorization: ✅ Granted

---

## Returning Subcontractor Workflow

### Overview
When a subcontractor has **previously submitted insurance** and has **active policies on file**, they can skip the full document upload and move directly to COI generation.

### Complete Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   RETURNING WORKFLOW                            │
└─────────────────────────────────────────────────────────────────┘

Step 1: GC Adds Subcontractor to New Project
   ↓
Step 2: System Identifies Returning Status
   ↓
Step 3: System Auto-Generates COI from Existing Policies
   ↓
Step 4: Broker Reviews and Signs COI
   ↓
Step 5: Admin Reviews COI
   ↓
Step 6: Admin Approves COI
   ↓
Step 7: Hold Harmless Agreement Generated
   ↓
Step 8: Subcontractor Signs Agreement
   ↓
Step 9: GC Countersigns Agreement
   ↓
Step 10: Work Approved - Subcontractor Can Proceed
```

---

### Key Differences from First-Time

| Step | First-Time | Returning |
|------|-----------|-----------|
| **Document Upload** | ✅ Required | ❌ Not Required (uses existing) |
| **Policy Review** | Full review of all policies | Quick verification only |
| **Timeline** | 5-10 business days | 2-3 business days |
| **Broker Action** | Upload full policy set | Review and sign COI only |
| **Admin Review** | Review policies + COI | Review COI only |

---

### Step 2: System Identifies Returning Status

**Automatic Check:**
```javascript
const status = await isFirstTimeSubcontractor(subcontractorId, projectId);
// Returns:
// {
//   isFirstTime: false,
//   previousSubmissions: 3,
//   hasActiveInsurance: true
// }
```

**Criteria for Returning:**
- ✅ Has prior COI uploads (`previousSubmissions > 0`)
- ✅ Has broker-signed documents on file
- ✅ Has active/approved COI in system
- ✅ Insurance policies are still valid (not expired)

**Email to Subcontractor:**
```
Subject: "Welcome Back to [Project Name]"

Dear [Subcontractor Company],

Welcome back! Your insurance is already on file.

🏗️ PROJECT DETAILS:
• Project: [Project Name]
• Location: [Address]
• General Contractor: [GC Company Name]
• Your Trade(s): [Trades]

✅ FASTER APPROVAL PROCESS:

Since you've worked with us before, we'll use your existing 
insurance policies on file. This means faster approval!

📝 NEXT STEPS:

1. ✅ Your insurance is on file (no upload needed)
2. Your broker will review and sign the certificate
3. Admin reviews COI
4. You receive approval notification
5. Sign Hold Harmless Agreement
6. Work can begin!

Estimated Timeline: 2-3 business days

🔗 ACCESS YOUR PORTAL:
[Link to Subcontractor Dashboard]

Best regards,
The INsuretrack Team
```

---

### Step 3: Auto-Generate COI from Existing Policies

**System Process:**
```javascript
// Retrieve existing insurance data
const masterInsurance = await getMasterInsuranceData(subcontractor.id);

// Generate COI using existing policies
const coi = await generateCOIFromMaster({
  subcontractor_id: sub.id,
  project_id: project.id,
  gc_id: project.gc_id,
  master_insurance: masterInsurance,
  requirements: projectRequirements,
  status: 'pending_broker_signature'
});
```

**What's Reused:**
- GL policy details (limits, carrier, policy number)
- WC policy details
- Auto policy details
- Umbrella policy details (if applicable)
- Insurance broker contact
- Endorsement documentation

**What's Updated:**
- Project name and address
- GC information
- Project Owner
- Additional Insureds (project-specific)
- Certificate effective dates
- Certificate holder information

**Status:** Set to `pending_broker_signature`

**Notification:** Broker receives email to review and sign

---

### Step 4: Broker Reviews and Signs COI

**Who:** Insurance Broker  
**Where:** Broker Portal → Certificates → Pending Signature

**Process:**
1. Broker receives email notification
2. Logs into Broker Portal
3. Reviews generated COI
4. Verifies:
   - Policy numbers match current policies
   - Coverage limits are accurate
   - Effective dates are correct
   - Project details are accurate
5. If changes needed:
   - Requests corrections from admin
   - Or uploads updated policy if coverage changed
6. If accurate:
   - Clicks "Sign Certificate"
   - Adds broker signature (digital or uploaded stamp)
   - Submits for admin approval

**System Actions:**
- Updates `broker_signature_url` with signature
- Updates `broker_signature_date`
- Changes status to `pending_review`
- Notifies admin for final review

**Timeline:** Typically 1-2 business days

---

### Steps 5-10: Admin Review and Signature Process

**Same as First-Time Workflow:**
- Admin reviews COI (faster, since policies already vetted)
- Admin approves COI
- Hold Harmless agreement generated
- Subcontractor signs
- GC countersigns
- Work approved

**Key Advantage:** No policy review needed, faster turnaround

---

## Role-Specific Workflows

### Subcontractor Daily Workflow

```
Morning Routine:
1. Log into Subcontractor Portal
2. Check Dashboard for notifications
3. Review project status updates
4. Check for pending actions

Pending Actions Dashboard Shows:
📄 COIs Pending Upload
✍️ Hold Harmless Agreements Pending Signature
📅 Expiring Insurance (< 30 days)
⚠️ Compliance Issues
💬 New Messages from GC/Broker/Admin

When COI Needs Attention:
1. Click notification → Opens COI details
2. Review status and next action required
3. Take appropriate action:
   - Upload documents (if broker hasn't)
   - Contact broker (if stuck)
   - Sign hold harmless
   - Respond to compliance issue
4. Verify action completed
5. Check for confirmation email

Weekly Tasks:
• Review all project statuses
• Verify insurance expiration dates
• Update contact information if changed
• Check for new project assignments
• Follow up on pending items
```

---

### General Contractor (GC) Workflow

```
Project Setup:
1. Create new project in GC Portal
2. Fill in project details:
   - Name, location, dates
   - Owner information
   - Additional Insureds
   - Insurance requirements (by trade)
3. Add subcontractors:
   - For each sub: company, email, trades
   - System triggers appropriate workflow
4. Monitor subcontractor compliance

Daily Monitoring:
1. Log into GC Dashboard
2. Review compliance summary:
   - Approved subs (✅)
   - Pending insurance (⏳)
   - Compliance issues (⚠️)
   - Expiring policies (📅)
3. Review pending hold harmless signatures
4. Sign agreements as they come in

When Hold Harmless Needs Signature:
1. Click notification
2. Review subcontractor-signed agreement
3. Verify project details
4. Click "Sign Hold Harmless"
5. Confirm signature
6. Receive confirmation email

Reporting:
• Weekly: Review project compliance status
• Monthly: Run compliance reports
• Quarterly: Review all subcontractor insurance
• As-Needed: Respond to expiration alerts
```

---

### Broker Workflow

```
Client Onboarding (First-Time):
1. Receive notification: "New client needs insurance upload"
2. Log into Broker Portal
3. Navigate to client
4. Gather all required policy documents
5. Upload each policy with details:
   - Policy PDF
   - Policy number
   - Carrier
   - Effective dates
   - Coverage amounts
6. Submit for review
7. Respond to any deficiency notices
8. Update documents as needed

Returning Client (Existing Policies):
1. Receive notification: "Certificate ready for signature"
2. Log into Broker Portal
3. Review generated COI
4. Verify accuracy against current policies
5. Sign certificate
6. Submit for admin approval

Ongoing Management:
• Monitor client policy expirations
• Update policies when renewed
• Respond to coverage increase requests
• Handle compliance issues
• Answer admin questions about coverage
```

---

### Admin Workflow

```
Daily Review Queue:
1. Log into Admin Dashboard
2. Navigate to "Pending Reviews"
3. Review queue shows:
   📄 New policy uploads (First-Time subs)
   📋 COIs pending approval
   ⚠️ Compliance issues
   💬 Messages requiring response

Processing First-Time Upload:
1. Click on pending review
2. Download all policy documents
3. Review each policy:
   - Coverage amounts
   - Endorsements
   - Effective dates
   - Carrier information
4. Check against project requirements
5. If issues:
   - Document deficiencies
   - Send deficiency notice to broker
   - Set status to "Deficient - Resubmit Required"
6. If approved:
   - Click "Approve Documents"
   - System generates COI
   - Move to COI approval queue

Approving COI:
1. Review generated COI
2. Verify all data accurate
3. Check compliance engine results
4. Review any flagged issues
5. Make final determination
6. Click "Approve COI"
7. System generates hold harmless template
8. Monitor signature process

Monitoring & Reporting:
• Dashboard shows real-time compliance stats
• Set up alerts for expiring policies
• Run compliance reports
• Track deficiency resolution times
• Monitor broker performance
```

---

## COI Approval Workflow

### Detailed COI Review Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    COI APPROVAL WORKFLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. COI Generated (Auto or Manual)
   ↓
2. Compliance Engine Analyzes COI
   ├─ General Liability Check
   ├─ Workers' Compensation Check
   ├─ Auto Liability Check
   ├─ Umbrella/Excess Check (if required)
   ├─ Endorsement Verification
   ├─ Additional Insured Verification
   └─ Coverage Period Check
   ↓
3. Compliance Result Generated
   ├─ ✅ Compliant → Status: "Pending Admin Review"
   └─ ⚠️ Issues Found → Status: "Deficient"
   ↓
4. Admin Reviews
   ├─ If Compliant:
   │   ├─ Verify accuracy
   │   └─ Approve → Status: "Approved"
   └─ If Deficient:
       ├─ Review issues
       ├─ Determine if major or minor
       ├─ If Major: Reject → Notify Broker
       └─ If Minor: Request Clarification
   ↓
5. Post-Approval
   ├─ Generate Hold Harmless Agreement
   ├─ Notify All Parties
   ├─ Update Project Compliance Status
   └─ Begin Signature Workflow
```

---

### Compliance Checks Performed

#### General Liability Requirements

**Minimum Coverage:**
- Each Occurrence: $1M - $3M (depends on trade tier)
- General Aggregate: $2M - $6M
- Products/Completed Ops: $1M - $3M

**Required Endorsements:**
- ✅ CG2010 - Additional Insured (ISO CG 20 10)
- ✅ CG2037 - Primary & Non-Contributory
- ✅ Waiver of Subrogation
- ✅ Blanket Basis (for all additional insureds)

**Project-Specific:**
- ✅ No exclusion for project area
- ✅ No condo limitation (for condo projects)
- ✅ All additional insureds named

#### Workers' Compensation Requirements

**Minimum Coverage:**
- Each Accident: $1M
- Disease - Policy Limit: $1M
- Disease - Each Employee: $1M

**Required Endorsements:**
- ✅ Waiver of Subrogation
- ✅ Waiver of Excess (if applicable)

#### Auto Liability Requirements

**Minimum Coverage:**
- Combined Single Limit: $1M

**Required Coverage Types:**
- ✅ Owned Autos
- ✅ Hired Autos
- ✅ Non-Owned Autos

#### Umbrella/Excess Requirements (Tier 2 & 3 Trades)

**Minimum Coverage:**
- Tier 2: $2M each occurrence / aggregate
- Tier 3: $3M each occurrence / aggregate

**Required Features:**
- ✅ "Follow Form" - follows GL on all exclusions
- ✅ Same additional insured endorsements
- ✅ Waiver of Subrogation

---

### Compliance Issue Resolution

**Common Issues and Solutions:**

| Issue | Category | Resolution | Timeline |
|-------|----------|------------|----------|
| Coverage amount too low | Major | Request policy increase | 5-10 days |
| Missing CG2010 endorsement | Major | Add endorsement to policy | 3-5 days |
| Additional insured not named | Major | Issue endorsement naming them | 2-3 days |
| Policy expired | Critical | Renew policy immediately | 1 day |
| Waiver of Subrogation missing | Major | Add endorsement | 2-3 days |
| Condo exclusion present | Major (condo projects) | Remove exclusion | 5-7 days |
| Hired/Non-Owned Auto missing | Moderate | Add to policy | 3-5 days |
| Umbrella not "follow form" | Major (Tier 2/3) | Modify policy language | 5-7 days |

**Resolution Process:**
1. Admin identifies issue via compliance engine
2. Admin documents specific deficiency
3. System sends deficiency notice to broker
4. Broker works with carrier to resolve
5. Updated documents uploaded
6. Admin re-reviews
7. If resolved → Approve
8. If not resolved → Escalate or reject

---

## Notification Flow

### Complete Notification Matrix

| Trigger Event | Recipient | Subject | Key Info | Portal Link |
|---------------|-----------|---------|----------|-------------|
| Sub added to project (First-Time) | Subcontractor | "Welcome - Insurance Setup Required" | Required docs, timeline | Subcontractor Dashboard |
| Sub added to project (Returning) | Subcontractor | "Welcome Back" | Faster process, timeline | Subcontractor Dashboard |
| Broker assigned | Broker | "New Insurance Upload Request" | Client name, required docs | Broker Portal → Client |
| Documents uploaded | Admin | "New Policy Documents - Review Required" | Sub name, project | Admin → Pending Reviews |
| Documents approved | Broker, Sub | "Insurance Approved - COI Generated" | Next steps | Respective portals |
| COI pending signature | Broker | "Certificate Ready for Signature" | COI details | Broker → Certificates |
| COI signed by broker | Admin | "COI Ready for Final Review" | Sub name, project | Admin → COI Review |
| COI approved | All parties | "COI Approved" | Work authorization pending | Respective portals |
| Hold Harmless generated | Subcontractor | "Sign Hold Harmless Agreement Required" | Download, sign, upload | Sub → Projects → COI |
| Hold Harmless signed by sub | GC | "Hold Harmless Ready for Review" | Sub name, view agreement | GC → Project → Signatures |
| Hold Harmless signed by GC | All parties | "Work Approved - Fully Compliant" | Work can proceed | Respective portals |
| Insurance expiring (30 days) | Sub, Broker | "Insurance Expiring Soon" | Renewal required | Sub/Broker portals |
| Insurance expired | Sub, Broker, GC, Admin | "URGENT: Insurance Expired" | Work stoppage | All portals |
| Compliance issue found | Sub, Broker | "Insurance Deficiency - Action Required" | Specific issues, deadline | Sub/Broker portals |

---

### Notification Content Examples

**First-Time Subcontractor Welcome:**
```
Subject: Welcome to [Project Name] - Insurance Setup Required

Dear [Company],

You've been added to [Project Name].

REQUIRED DOCUMENTS:
✅ ACORD 25 Certificate
✅ GL Policy
✅ WC Policy
✅ Auto Policy
✅ Umbrella (if required)

NEXT STEPS:
1. Contact your broker
2. Broker uploads documents
3. Admin reviews
4. You receive approval
5. Sign Hold Harmless
6. Work begins!

Timeline: 5-10 business days

Portal: [Link]
```

**Returning Subcontractor Welcome:**
```
Subject: Welcome Back to [Project Name]

Dear [Company],

You're back! Insurance on file = faster approval.

✅ Your insurance is already on file
⏱️ Estimated approval: 2-3 business days

NEXT STEPS:
1. Broker reviews certificate
2. Admin approves
3. You sign Hold Harmless
4. Work begins!

Portal: [Link]
```

**Deficiency Notice:**
```
Subject: Insurance Deficiency - Action Required

Dear [Broker],

The insurance submitted for [Subcontractor] on [Project] 
has deficiencies that must be corrected.

ISSUES FOUND:
❌ GL Coverage: $500K (Required: $1M)
❌ Missing CG2010 Endorsement
❌ Additional Insured not named: [Owner Name]

REQUIRED ACTIONS:
1. Increase GL coverage to minimum $1M
2. Add CG2010 endorsement
3. Add [Owner Name] as Additional Insured
4. Re-upload updated documents

DEADLINE: [Date - typically 5 business days]

Portal: [Link to re-upload]

Contact admin if questions: [Email]
```

---

## Program Management

### Insurance Programs

Insurance Programs are templates that define standard insurance requirements for specific types of projects or GCs.

**Benefits:**
- Standardize requirements across similar projects
- Include custom hold harmless templates
- Faster project setup
- Consistent compliance standards

### Creating an Insurance Program

**Who:** Admin  
**Where:** Admin Dashboard → Insurance Programs

**Process:**
1. Click "Create New Program"
2. Fill in program details:
   - Name (e.g., "NYC High-Rise Standard")
   - Description
   - Active status
3. Define Requirements by Tier:
   - **Tier 1** (General trades):
     - GL limits
     - WC limits
     - Auto limits
     - Endorsements
   - **Tier 2** (Specialty trades):
     - Increased limits
     - Additional requirements
   - **Tier 3** (High-risk trades):
     - Maximum limits
     - Strictest requirements
4. Upload Hold Harmless Template (optional):
   - Custom agreement document
   - Will be used for all projects using this program
5. Assign applicable trades to each tier
6. Save program

### Applying Program to Projects

**Method 1: During Project Creation**
1. Create new project
2. Select "Use Insurance Program"
3. Choose program from dropdown
4. Requirements auto-populate
5. Customize if needed

**Method 2: Add to Existing Project**
1. Edit project
2. Set `program_id` field
3. Requirements update automatically

### Program Templates

**Example: "NYC Commercial Construction"**
```json
{
  "name": "NYC Commercial Construction",
  "description": "Standard requirements for commercial projects in NYC",
  "tiers": {
    "tier1": {
      "trades": ["carpentry", "electrical", "plumbing", "hvac"],
      "gl_each_occurrence": 1000000,
      "gl_aggregate": 2000000,
      "wc_each_accident": 1000000,
      "auto_csl": 1000000,
      "umbrella_required": false
    },
    "tier2": {
      "trades": ["roofing", "excavation"],
      "gl_each_occurrence": 2000000,
      "gl_aggregate": 5000000,
      "wc_each_accident": 1000000,
      "auto_csl": 1000000,
      "umbrella_required": true,
      "umbrella_minimum": 2000000
    },
    "tier3": {
      "trades": ["crane", "scaffolding"],
      "gl_each_occurrence": 3000000,
      "gl_aggregate": 6000000,
      "wc_each_accident": 1000000,
      "auto_csl": 1000000,
      "umbrella_required": true,
      "umbrella_minimum": 3000000
    }
  },
  "hold_harmless_template_url": "https://storage.../nyc-template.pdf",
  "endorsements_required": [
    "CG2010",
    "CG2037",
    "Waiver of Subrogation"
  ]
}
```

---

## Workflow Timing Summary

### Expected Timelines

| Workflow Stage | First-Time | Returning | Critical Path |
|----------------|-----------|-----------|---------------|
| Sub added to project | Instant | Instant | - |
| Broker receives notification | < 5 min | < 5 min | - |
| Broker uploads/signs | 1-3 days | 4-12 hours | ⚠️ Broker action |
| Admin reviews documents | 1-2 days | N/A | ⚠️ Admin action |
| Admin reviews COI | 4-8 hours | 4-8 hours | ⚠️ Admin action |
| Hold Harmless generated | Instant | Instant | - |
| Sub signs Hold Harmless | 1-2 days | 1-2 days | ⚠️ Sub action |
| GC signs Hold Harmless | 1-2 days | 1-2 days | ⚠️ GC action |
| **TOTAL TIME** | **5-10 days** | **2-3 days** | - |

### Bottleneck Identification

**Common Delays:**
1. ⏰ **Broker Upload Delay** (First-Time) - Broker hasn't uploaded documents
   - **Solution:** Automated reminder emails at 3, 5, 7 days
   
2. ⏰ **Document Deficiencies** - Insurance doesn't meet requirements
   - **Solution:** Clear deficiency notices, specific instructions
   
3. ⏰ **Admin Review Backlog** - Too many pending reviews
   - **Solution:** Prioritize by project start date, add reviewers
   
4. ⏰ **Hold Harmless Signature Delay** - Sub/GC not signing promptly
   - **Solution:** Reminder emails, escalation after 5 days

---

## Best Practices

### For Admins
✅ Review documents within 24 hours of submission  
✅ Provide specific, actionable deficiency notices  
✅ Prioritize by project start date  
✅ Set up automated reminders  
✅ Maintain insurance program templates  
✅ Monitor average approval times  

### For GCs
✅ Add subcontractors early in project planning  
✅ Sign Hold Harmless agreements within 2 days  
✅ Keep project requirements up-to-date  
✅ Monitor compliance dashboard weekly  
✅ Communicate deadlines clearly to subs  

### For Subcontractors
✅ Contact broker immediately when added to project  
✅ Keep insurance policies current  
✅ Sign agreements within 3 days  
✅ Update contact information  
✅ Monitor expiration dates  

### For Brokers
✅ Upload documents within 2 days of request  
✅ Ensure all endorsements included  
✅ Verify coverage amounts before uploading  
✅ Respond to deficiency notices within 24 hours  
✅ Keep client policies organized  
✅ Set up policy renewal reminders  

---

## Related Documentation

- [Hold Harmless Workflow](./HOLD_HARMLESS_WORKFLOW.md) - Complete hold harmless process
- [Insurance Requirements System](./INSURANCE_REQUIREMENTS_SYSTEM.md) - Detailed requirements and compliance
- [API Documentation](./API_DOCUMENTATION.md) - Technical API reference
- [Data Model](./DATA_MODEL.md) - Database schema and relationships

---

*Last Updated: January 2026*
