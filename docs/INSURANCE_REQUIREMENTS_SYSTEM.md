# Complete Insurance Requirements & COI Approval System

## Overview

This comprehensive system implements:
1. **Insurance Requirements Engine** - Tiered requirements by trade with project-specific modifications
2. **Project Requirements Document Management** - Upload and view trade-specific documentation
3. **COI Validation & Compliance** - Automatic checking of requirements vs. submitted COI
4. **Admin Approval Dashboard** - Centralized COI review and approval interface
5. **Notification Portal Links** - Every notification includes direct portal section links
6. **Trade Selection Enhancement** - Precise trade selection for accurate requirement determination

---

## Part 1: Insurance Requirements Engine

### File: `insuranceRequirements.js`

#### 1.1 Universal Requirements (All Projects)

Every project requires these base requirements regardless of trade:

**General Liability:**
- CG2010 (Additional Insured - ISO CG 20 10)
- CG2037 (Primary & Non-Contributory)
- Blanket basis endorsements
- Minimum $1M each occurrence / $2M aggregate
- Minimum $1M products/completed operations
- Waiver of Subrogation required
- All additional insureds named (from project setup)
- No exclusion for project area
- **For Condo Projects**: No condo limitation

**Umbrella/Excess:**
- Same additional insured endorsements
- Waiver of Subrogation required
- **Must be "follow form"** - follows GL on all exclusions and additional insureds
- Minimum $1M each occurrence / $2M aggregate

**Workers' Compensation:**
- Waiver of Subrogation required
- Waiver of Excess required (excess follow form)
- Minimum $1M each accident

**Auto Liability:**
- Must include Hired & Non-Owned Auto
- Minimum $1M Combined Single Limit

#### 1.2 Trade-Specific Requirements

Requirements escalate by tier:

**Tier 1 - General Construction** (Carpentry, Electrical, Plumbing, HVAC)
- GL: $1M/$2M
- WC: $1M
- Auto: $1M
- Umbrella: Not required

**Tier 2 - Specialty Trades** (Roofing, Excavation)
- GL: $2M/$5M (50% increase)
- WC: $1M
- Auto: $1M
- **Umbrella: $2M minimum** (newly required)

**Tier 3 - High-Risk Trades** (Crane Operators, Scaffolding)
- GL: $3M/$6M (200% increase)
- WC: $1M
- Auto: $1M
- **Umbrella: $3M minimum** (newly required)

#### 1.3 Project-Specific Modifiers

**Condo Projects:**
- Add `noCondoLimitation: true` - cannot exclude condos
- Same endorsements apply

**High-Rise Projects:**
- Multiply all minimum limits by 1.5x

#### 1.4 Usage Example

```javascript
import { validateCOICompliance, getRequirementDescription } from "@/insuranceRequirements";

// Validate COI against requirements
const result = await validateCOICompliance(
  coiData,           // GeneratedCOI object
  projectData,       // Project object
  subTrades          // ['carpentry', 'electrical']
);

if (result.compliant) {
  // COI meets all requirements
} else {
  // Handle issues
  console.log(result.issues);  // Array of specific problems
}

// Get human-readable requirements
const description = getRequirementDescription(null, project, trades);
console.log(description);  // Display to user
```

---

## Part 2: COI Upload & Approval Notifications

### File: `coiNotifications.js`

#### 2.1 Notification Types

**Admin COI Uploaded:**
```javascript
await notifyAdminCOIUploaded(coi, subcontractor, project);
```
- Notifies admin/compliance team when COI uploaded
- Includes compliance validation results
- Link to COI Review dashboard
- Creates Message record for tracking

**Sub COI Approved:**
```javascript
await notifySubCOIApproved(coi, subcontractor, project);
```
- Notifies subcontractor their COI approved
- Confirms they can work on project
- Links to sub dashboard

**GC COI Ready:**
```javascript
await notifyGCCOIApprovedReady(coi, subcontractor, project);
```
- Notifies GC that insurance is approved
- Subcontractor cleared to work

**COI Deficiencies:**
```javascript
await notifyCOIDeficiencies(coi, subcontractor, project, deficiencies);
```
- Notifies broker and sub of issues
- Lists specific problems and required fixes
- Includes resubmit link

**Broker COI Review:**
```javascript
await notifyBrokerCOIReview(coi, subcontractor, project);
```
- Notifies broker to review/sign certificate
- Includes certificate details
- Links to broker portal

**All Stakeholders Notification:**
```javascript
await notifyAllStakeholdersCOIApproved(coi, subcontractor, project);
```
- Sends to Sub, GC, and Broker simultaneously
- Confirms approval to all parties

#### 2.2 Notification Portal Links

Every notification includes these portal links:

**For Subcontractors:**
- `/subcontractor-dashboard?id=[subId]&section=certificates`
- `/subcontractor-dashboard?id=[subId]&section=projects&projectId=[projectId]`

**For Brokers:**
- `/broker-dashboard?email=[email]&section=certificates`
- `/broker-dashboard?email=[email]&coiId=[coiId]`

**For Admins:**
- `/admin-dashboard?section=PendingReviews`
- `/COIReview?id=[coiId]`

---

## Part 3: Project Requirements Document Management

### File: `ProjectRequirementsManager.jsx`

#### 3.1 Admin Uploads Requirements

```jsx
<ProjectRequirementsManager projectId={projectId} projectName={projectName} />
```

**Features:**
- Upload PDF/DOC files for each tier
- Associate with specific trades (optional)
- Add descriptions and context
- Organize by Tier 1, 2, 3

**Workflow:**
1. Admin selects tier (1, 2, or 3)
2. Selects applicable trades (or leaves blank for all)
3. Uploads document (PDF, DOC, DOCX, TXT)
4. System stores with metadata
5. Available for subcontractors to download

#### 3.2 Tier Organization

**Tier 1 - General Construction**
- Carpentry, Electrical, Plumbing, HVAC
- "General Construction Trades"

**Tier 2 - Specialty Trades**
- Roofing, Excavation
- "Specialty Trades"

**Tier 3 - High-Risk Trades**
- Crane Operators, Scaffolding
- "High-Risk Trades"

#### 3.3 Database Structure

```javascript
ProjectInsuranceRequirement {
  project_id,           // Link to project
  requirement_tier,     // 1, 2, or 3
  applicable_trades,    // ['carpentry', 'electrical'] or []
  document_name,        // "Tier 1 Requirements"
  document_description, // "Detailed requirements for..."
  document_url,         // S3 or storage URL
  document_type,        // 'application/pdf'
  is_active,           // boolean
  created_at,
  updated_at
}
```

---

## Part 4: Project Requirements Viewer

### File: `ProjectRequirementsViewer.jsx`

#### 4.1 Subcontractor Views Requirements

```jsx
<ProjectRequirementsViewer 
  projectId={projectId} 
  selectedTrades={['carpentry', 'electrical']}
/>
```

**Features:**
- Filter by selected trades
- Download/preview documents
- View tier descriptions
- See requirements text

**Workflow:**
1. Subcontractor selects trades they perform
2. System shows applicable requirements
3. Can preview/download documents
4. Can share link with broker
5. Broker uses to prepare compliant COI

---

## Part 5: COI Compliance Validator

### File: `insuranceRequirements.js` - `validateCOICompliance()`

#### 5.1 What Gets Checked

**Policy Limits:**
- GL each occurrence
- GL general aggregate
- GL products/completed ops
- Umbrella each occurrence
- Umbrella aggregate
- WC each accident
- Auto combined single limit

**Endorsements:**
- CG2010 present on GL
- CG2037 present on GL
- Same endorsements on Umbrella

**Waivers:**
- Waiver of Subrogation on GL
- Waiver of Subrogation on Umbrella
- Waiver of Subrogation on WC
- Waiver of Excess on WC

**Additional Insureds:**
- Required on GL
- All project insureds named
- All project insureds on Umbrella

**Follow Form:**
- Umbrella marked follow form
- Follows GL exclusions
- Follows GL additional insureds

**Exclusions:**
- No project area exclusion
- No condo exclusion (if condo project)

**Expiration Dates:**
- Not expired
- Not expiring within 30 days

#### 5.2 Compliance Result Object

```javascript
{
  compliant: boolean,           // true if all requirements met
  issues: [                     // Errors that block approval
    {
      type: 'GL_LIMIT_INSUFFICIENT',
      field: 'Each Occurrence',
      required: 1000000,
      provided: 500000,
      severity: 'error'
    },
    // ... more issues
  ],
  warnings: [                   // Warnings that don't block
    {
      type: 'POLICY_EXPIRING_SOON',
      field: 'GL Expiration',
      expirationDate: '2025-02-15',
      daysUntilExpiry: 28,
      severity: 'warning'
    }
  ],
  requirementsApplied: {        // Full requirements used for validation
    gl: {...},
    umbrella: {...},
    wc: {...},
    auto: {...}
  }
}
```

---

## Part 6: Admin COI Approval Dashboard

### File: `AdminCOIApprovalDashboard.jsx`

#### 6.1 Features

**Overview Stats:**
- Pending Review count
- Approved count
- Needs Correction count
- Total COIs

**Filter Tabs:**
- Pending Review (needs action)
- Approved (done)
- Needs Correction (resubmitted)
- All

**For Each COI:**
- Company name
- Project name
- Trade types
- Insurance limits
- Upload date
- Quick approve button

**Detail Panel:**
- Full compliance check
- Issue list with details
- Approve button (only if compliant)
- Request Corrections button
- Shows specific deficiencies

#### 6.2 Admin Workflow

1. Open Admin Dashboard
2. View "Pending Review" tab
3. Click COI to expand details
4. Review compliance status
5. Either:
   - **Approve** - if compliant
   - **Request Corrections** - if issues found
6. System sends appropriate notifications

#### 6.3 Approval Process

```javascript
// User clicks Approve
await approveMutation.mutate(coiId);

// Behind the scenes:
// 1. Update GeneratedCOI.status = 'active'
// 2. Set approved_at timestamp
// 3. Notify all stakeholders
// 4. Refresh dashboard
```

#### 6.4 Portal Links in Dashboard

```javascript
const links = notificationLinks.getAdminCOIReviewLink(coi.id);
// /COIReview?id=[coiId]

const projectLink = notificationLinks.getAdminProjectLink(project.id);
// /ProjectDetails?id=[projectId]

const pendingLink = notificationLinks.getAdminPendingReviewsLink();
// /admin-dashboard?section=PendingReviews
```

---

## Part 7: Notification Link Builder

### File: `notificationLinkBuilder.js`

#### 7.1 Purpose

Every notification should include direct links to portal sections so recipients can take action immediately without searching.

#### 7.2 Link Types

**Subcontractor Portal:**
```javascript
notificationLinks.getSubDashboardLink(subId);
// /subcontractor-dashboard?id=[subId]

notificationLinks.getSubProjectLink(subId, projectId);
// /subcontractor-dashboard?id=[subId]&section=projects&projectId=[projectId]

notificationLinks.getSubCertificatesLink(subId);
// /subcontractor-dashboard?id=[subId]&section=certificates
```

**Broker Portal:**
```javascript
notificationLinks.getBrokerDashboardLink(brokerEmail);
// /broker-dashboard?email=[email]

notificationLinks.getBrokerCertificatesLink(brokerEmail);
// /broker-dashboard?email=[email]&section=certificates

notificationLinks.getBrokerUploadLink(subId);
// /BrokerUpload?subId=[subId]
```

**Admin Portal:**
```javascript
notificationLinks.getAdminPendingReviewsLink();
// /admin-dashboard?section=PendingReviews

notificationLinks.getAdminCOIReviewLink(coiId);
// /COIReview?id=[coiId]

notificationLinks.getAdminProjectLink(projectId);
// /ProjectDetails?id=[projectId]
```

#### 7.3 Usage in Notifications

```javascript
import { notificationLinks } from "@/notificationLinkBuilder";

const dashboardLink = notificationLinks.getSubDashboardLink(subId);
const certLink = notificationLinks.getSubCertificatesLink(subId);

const emailBody = `
Please review your certificates.

View Dashboard: ${dashboardLink}
View Certificates: ${certLink}
`;

await compliant.integrations.Core.SendEmail({
  to: email,
  subject: 'Action Required',
  body: emailBody
});
```

---

## Part 8: Enhanced Trade Selection

### File: `TradeSelectionComponent.jsx`

#### 8.1 Features

**Tier-Based Display:**
- Tier 1: General Construction
- Tier 2: Specialty Trades
- Tier 3: High-Risk Trades

**For Each Tier:**
- Clear description
- Base insurance requirements
- Checkboxes for trades
- Selected count

**Validation:**
- Ensures at least one trade selected
- Can be set to single or multiple selection

**Visual Aids:**
- Color-coded by tier
- Icons showing tier level
- Requirements displayed inline

#### 8.2 Usage

```jsx
import TradeSelectionComponent from "@/TradeSelectionComponent";

<TradeSelectionComponent
  selectedTrades={trades}
  onTradesChange={setTrades}
  required={true}
  multipleSelectionAllowed={true}
/>
```

#### 8.3 Example Trades

**Tier 1:**
- Carpentry ($1M GL/$2M Agg)
- Electrical ($1M GL/$2M Agg)
- Plumbing ($1M GL/$2M Agg)
- HVAC ($1M GL/$2M Agg)

**Tier 2:**
- Roofing ($2M GL/$5M Agg + $2M Umbrella)
- Excavation ($2M GL/$5M Agg + $2M Umbrella)

**Tier 3:**
- Crane Operator ($3M GL/$6M Agg + $3M Umbrella)
- Scaffold ($3M GL/$6M Agg + $3M Umbrella)

---

## Implementation Checklist

### Phase 1: Foundation (Completed)
- ✅ Create `insuranceRequirements.js`
- ✅ Create `coiNotifications.js`
- ✅ Create `notificationLinkBuilder.js`
- ✅ Create `insuranceRequirements.js` export functions

### Phase 2: Components (Completed)
- ✅ Create `ProjectRequirementsManager.jsx`
- ✅ Create `ProjectRequirementsViewer.jsx`
- ✅ Create `AdminCOIApprovalDashboard.jsx`
- ✅ Create `TradeSelectionComponent.jsx`

### Phase 3: Integration (Required)
- [ ] Update SubcontractorsManagement.jsx to use TradeSelectionComponent
- [ ] Update ProjectDetails.jsx to use ProjectRequirementsManager
- [ ] Update COIReview.jsx to call validateCOICompliance
- [ ] Update BrokerDashboard.jsx to show compliance status
- [ ] Update AdminDashboard.jsx to include COI approval dashboard
- [ ] Update SubcontractorDashboard.jsx to show ProjectRequirementsViewer

### Phase 4: Testing
- [ ] Test trade selection properly sets requirements
- [ ] Test admin COI approval workflow
- [ ] Test compliance validation catches all issues
- [ ] Test notifications include correct portal links
- [ ] Test project requirements visible to subs
- [ ] Test tier-specific limits enforced

### Phase 5: Documentation
- [ ] User guide for subcontractors
- [ ] Admin guide for COI approval
- [ ] Broker guide for compliance
- [ ] Training materials for each role

---

## Database Schema Changes

### New Entity: `ProjectInsuranceRequirement`

```javascript
{
  id: string (UUID),
  project_id: string,           // FK: Project.id
  requirement_tier: number,     // 1, 2, or 3
  applicable_trades: string[],  // ['carpentry', 'electrical'] or []
  document_name: string,
  document_description: string,
  document_url: string,         // S3 or cloud storage URL
  document_type: string,        // 'application/pdf'
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp,
  created_by: string           // admin user ID
}
```

### Enhanced: `GeneratedCOI`

Add these fields:
```javascript
compliance_status: 'compliant' | 'issues' | 'pending_review',
compliance_issues: [],          // Array of issue objects
approved_by: string,            // Admin user ID
approved_at: timestamp,
rejected_at: timestamp,
deficiencies: [],               // Array of deficiency objects
requirement_tier: number        // Tier of sub who generated this
```

---

## Notification Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              COI APPROVAL NOTIFICATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

1. SUB UPLOADS COI
   └─ Triggers: notifyAdminCOIUploaded()
      └─ Email to admin@insuretrack.com
      └─ Portal link: /admin-dashboard?section=PendingReviews
      └─ Creates Message record

2. ADMIN REVIEWS IN DASHBOARD
   └─ AdminCOIApprovalDashboard opens
   └─ Calls validateCOICompliance()
   └─ Shows issues or approves

3a. IF COMPLIANT → APPROVE
    └─ Admin clicks "Approve"
    └─ Triggers: notifyAllStakeholdersCOIApproved()
       ├─ Sub: notifySubCOIApproved()
       │  └─ Email: /subcontractor-dashboard?id=[id]&section=certificates
       ├─ GC: notifyGCCOIApprovedReady()
       │  └─ Email: /ProjectDetails?id=[id]&section=subcontractors
       └─ Broker: notifyBrokerCOIReview()
          └─ Email: /broker-dashboard?email=[email]

3b. IF ISSUES → REQUEST CORRECTIONS
    └─ Admin clicks "Request Corrections"
    └─ Triggers: notifyCOIDeficiencies()
       ├─ Broker: notifyCOIDeficiencies()
       │  └─ Email: /BrokerUpload?subId=[id]&coiId=[id]
       └─ Sub: notifyCOIDeficiencies()
          └─ Email: /subcontractor-dashboard?id=[id]&section=issues

4. BROKER RESUBMITS (if corrections needed)
   └─ Triggers: notifyAdminCOIUploaded() again
   └─ Cycle repeats from step 2

5. ALL APPROVED
   └─ Sub cleared to work
   └─ GC can proceed
   └─ Broker completed assignment
```

---

## Portal Links by Scenario

### When Sub Gets Assigned to Project

**Sub Receives Email:**
- "Added to Project - [Project Name]"
- Link: `/subcontractor-dashboard?id=[subId]&section=projects&projectId=[projectId]`
- Shows: Project details, requirements, broker contact

**Broker Receives Email:**
- "Certificate Required - [Sub] on [Project]"
- Link: `/broker-dashboard?email=[email]&section=certificates`
- Shows: All pending certificates

**GC Receives Email:**
- "Subcontractor Added - [Sub] on [Project]"
- Link: `/ProjectDetails?id=[projectId]&section=subcontractors`
- Shows: Sub status in project

### When COI Uploaded

**Admin Receives Email:**
- "COI Uploaded - Review Required: [Sub]"
- Link: `/COIReview?id=[coiId]`
- Shows: Compliance details, approve/reject options

### When COI Approved

**Sub Receives Email:**
- "Certificate Approved - [Project]"
- Link: `/subcontractor-dashboard?id=[subId]&section=active_projects`
- Shows: Project with approved status

**Broker Receives Email:**
- "Approval Confirmation - [Sub]"
- Link: `/broker-dashboard?email=[email]&section=certificates&coiId=[coiId]`
- Shows: Approved certificate details

**GC Receives Email:**
- "Insurance Approved - [Sub] Ready for [Project]"
- Link: `/ProjectDetails?id=[projectId]&section=subcontractors`
- Shows: Sub with approved status

---

## Best Practices

### For Admins
1. Always use the AdminCOIApprovalDashboard for reviews
2. Check compliance status before approving
3. Request corrections for ANY issues found
4. Use deficiencies form to specify exactly what needs fixing
5. Document all approvals/rejections

### For Brokers
1. Check project requirements BEFORE submitting COI
2. Download requirements document from sub portal
3. Ensure all endorsements present on policies
4. Double-check limits match trade tier
5. Verify all insureds named correctly

### For Subcontractors
1. Share project requirements document with broker
2. Don't start work until COI approved
3. Update broker immediately if policy expires
4. Request new requirements if project changes
5. Contact GC if have COI questions

### For GCs
1. Upload clear requirement documents for each tier
2. Be specific about additional insureds needed
3. Review broker list for qualified providers
4. Monitor subcontractor insurance status
5. Use portal to verify all insureds named

---

## Troubleshooting

### COI Won't Approve - Shows Issues
1. Check each issue in detail
2. Send specific corrections list to broker
3. Broker updates policies or submits new documents
4. Resubmit COI through broker portal

### Broker Not Receiving Email
1. Verify broker email in system is correct
2. Check email isn't in spam
3. Verify notification settings enabled
4. Try resending from admin dashboard

### Requirements Not Showing
1. Ensure documents uploaded to project
2. Verify subcontractor trades match tier
3. Check if document is marked active
4. Refresh browser cache

### Compliance Check Always Fails
1. Review specific error messages
2. Check if all required endorsements present
3. Verify insurance carrier has issued correctly
4. May need to request completely new policy

---

## Security Considerations

- Portal links include email/ID but don't grant access (auth still required)
- All COI data encrypted in transit and at rest
- Admin approval required for all policy changes
- Audit trail maintained for all approvals
- Message records stored for compliance
- Notifications don't include sensitive policy details

---

## Future Enhancements

- Real-time OCR scanning of uploaded COI documents
- Automatic policy limit extraction from ACORD forms
- Integration with carriers for automatic verification
- Webhook notifications to third-party systems
- Advanced analytics on compliance trends
- Insurance marketplace integration for broker recommendations
