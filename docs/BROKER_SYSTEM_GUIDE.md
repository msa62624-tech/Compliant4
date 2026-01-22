# Broker Management System - Quick Reference

## How Broker Info is Organized

### Single Broker (All Policies)
When one broker manages all insurance policies for a subcontractor:

```
Subcontractor: ABC Construction
├─ Broker: John Smith (john@abc-brokers.com)
   ├─ GL Policy Upload
   ├─ Umbrella Policy Upload
   ├─ Auto Policy Upload
   ├─ WC Policy Upload
   └─ John signs once for all
```

**How it works:**
1. Subcontractor provides broker details in BrokerUpload form
2. Broker receives link to BrokerUploadCOI page
3. Broker info shown ONCE at top
4. All 4 policy upload fields displayed
5. All 4 signature fields displayed
6. One signature covers all policies

---

### Multiple Brokers (Different Policies)

When different brokers handle different policies:

```
Subcontractor: ABC Construction
├─ Policy: GL → Broker A (alice@abc-brokers.com)
│  ├─ GL Policy Upload (only)
│  └─ GL Signature (only)
│
├─ Policy: Umbrella → Broker A (alice@abc-brokers.com)
│  ├─ Umbrella Policy Upload (only)
│  └─ Umbrella Signature (only)
│
├─ Policy: Auto → Broker B (bob@xyz-brokers.com)
│  ├─ Auto Policy Upload (only)
│  └─ Auto Signature (only)
│
└─ Policy: WC → Broker C (carol@wc-brokers.com)
   ├─ WC Policy Upload (only)
   └─ WC Signature (only)
```

**How it works:**
1. Subcontractor checks "Assign different brokers to specific policy types?"
2. Fills in separate email for each policy (GL, Umbrella, Auto, WC)
3. Each broker gets their own unique link
4. When Broker A logs in:
   - Sees their name/email at top
   - Only sees GL and Umbrella upload fields
   - Only sees GL and Umbrella signature fields
5. When Broker B logs in:
   - Sees their name/email at top
   - Only sees Auto upload field
   - Only sees Auto signature field
6. When Broker C logs in:
   - Sees their name/email at top
   - Only sees WC upload field
   - Only sees WC signature field

---

## Database Fields

### Contractor Table
```
broker_name              // Main broker name
broker_email             // Main broker email
broker_phone             // Main broker phone
broker_company           // Main broker company
broker_type              // 'global' or 'per-policy'
```

### GeneratedCOI Table
```
// Main broker (always)
broker_name
broker_email
broker_phone
broker_company

// Policy-specific brokers (optional - only if using per-policy mode)
broker_gl_name
broker_gl_email
broker_gl_phone

broker_auto_name
broker_auto_email
broker_auto_phone

broker_umbrella_name
broker_umbrella_email
broker_umbrella_phone

broker_wc_name
broker_wc_email
broker_wc_phone
```

---

## Workflow: Setting Up Brokers

### Step 1: Subcontractor Provides Broker Info

**Global Mode (One Broker):**
```
BrokerUpload Form
├─ Broker Name: John Smith
├─ Broker Email: john@abc-brokers.com
├─ Broker Phone: (555) 123-4567
└─ Broker Company: ABC Insurance Brokers
```

**Per-Policy Mode (Multiple Brokers):**
```
BrokerUpload Form
├─ Primary Broker
│  ├─ Broker Name: John Smith
│  ├─ Broker Email: john@abc-brokers.com
│  └─ ...
│
└─ ☑ Assign different brokers to specific policy types?
   ├─ General Liability
   │  ├─ Name: John Smith
   │  └─ Email: john@abc-brokers.com
   │
   ├─ Umbrella/Excess
   │  ├─ Name: John Smith
   │  └─ Email: john@abc-brokers.com
   │
   ├─ Auto Liability
   │  ├─ Name: Bob Jones
   │  └─ Email: bob@xyz-brokers.com
   │
   └─ Workers Compensation
      ├─ Name: Carol Lee
      └─ Email: carol@wc-brokers.com
```

### Step 2: Brokers Receive Upload Links

Each broker gets a customized link. The system determines what they see based on:
- Which policies they're assigned to
- The policies listed in the COI record

### Step 3: Broker Uploads Their Policies

**Broker A sees:**
```
STEP 2: Upload Your Policy Documents
Broker: John Smith (john@abc-brokers.com)

☐ General Liability Policy (Required)
☐ Umbrella/Excess Policy (Required)
```

**Broker B sees:**
```
STEP 2: Upload Your Policy Documents
Broker: Bob Jones (bob@xyz-brokers.com)

☐ Auto Liability Policy (Optional)
```

**Broker C sees:**
```
STEP 2: Upload Your Policy Documents
Broker: Carol Lee (carol@wc-brokers.com)

☐ Workers Compensation Policy (Optional)
```

### Step 4: Brokers Add Signatures

Same pattern - only shows signature fields for their assigned policies.

---

## Validation Rules

### Policy Upload (Step 2)
| Policy | Single Broker | Multi-Broker |
|--------|---------------|--------------|
| GL | Required | Required (if assigned) |
| Umbrella | Required | Required (if assigned) |
| Auto | Optional | Optional (if assigned) |
| WC | Optional | Optional (if assigned) |

### Signatures (Step 3)
- GL signature: Required (if broker manages GL)
- Umbrella signature: Required (if broker manages Umbrella)
- Auto signature: Optional (if broker manages Auto)
- WC signature: Optional (if broker manages WC)

---

## Code Examples

### Checking Which Policies a Broker Manages

```javascript
const currentBrokerPolicies = getPoliciesForBroker();
// Returns: ['gl', 'umbrella', 'auto', 'wc'] or subset

// Only render GL upload if broker manages GL
{currentBrokerPolicies.includes('gl') && (
  <Card>
    <h4>General Liability Policy</h4>
    {/* GL upload field */}
  </Card>
)}
```

### Handling Per-Policy Brokers

```javascript
// When per-policy brokers are configured
policyBrokers = {
  gl: { name: 'John Smith', email: 'john@abc.com', phone: '...' },
  auto: { name: 'Bob Jones', email: 'bob@xyz.com', phone: '...' },
  umbrella: { name: 'John Smith', email: 'john@abc.com', phone: '...' },
  wc: { name: 'Carol Lee', email: 'carol@wc.com', phone: '...' }
}

// The system sends separate links to each unique broker email
// Each broker's link loads only their assigned policies
```

---

## Admin Dashboard View

In admin dashboards, you can see:

```
Subcontractor: ABC Construction
Project: Main Office Renovation

Broker Assignment Type: Per-Policy

GL: John Smith (john@abc-brokers.com)
   Status: ✅ Signed
   Files: ✅ GL Policy uploaded

Umbrella: John Smith (john@abc-brokers.com)
   Status: ⏳ Pending signature
   Files: ✅ Umbrella Policy uploaded

Auto: Bob Jones (bob@xyz-brokers.com)
   Status: ⏳ Waiting for upload
   Files: ❌ Not uploaded

WC: Carol Lee (carol@wc-brokers.com)
   Status: ⏳ Waiting for upload
   Files: ❌ Not uploaded
```

---

## Key Benefits

✅ **No Redundancy** - Broker info shows once, not repeated
✅ **Reduced Confusion** - Users only see relevant fields
✅ **Cleaner UI** - Less cluttered forms
✅ **Flexible** - Works with 1 or multiple brokers
✅ **Scalable** - Easy to add more policies in future
✅ **Clear Workflow** - Each broker has focused task list
