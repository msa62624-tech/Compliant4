# Hold Harmless Agreement Workflow

## Overview

The Hold Harmless Agreement is a critical legal protection mechanism in the INsuretrack system that ensures subcontractors formally agree to defend, indemnify, and hold harmless the General Contractor (GC), Project Owner, and Additional Insureds from claims, damages, losses, and expenses arising from the subcontractor's work on a construction project.

---

## What is a Hold Harmless Agreement?

A Hold Harmless Agreement (also called an Indemnification Agreement) is a legal document where:

- **The Subcontractor agrees to:**
  - Defend the GC and Project Owner from legal claims
  - Indemnify (compensate) them for losses
  - Hold them harmless (not hold them responsible) for damages arising from the subcontractor's work

- **Protects:**
  - General Contractor
  - Project Owner
  - Additional Insured parties (architects, property managers, etc.)
  - Building management companies

---

## Hold Harmless Status Lifecycle

The system tracks hold harmless agreements through a multi-step signature workflow:

```
┌─────────────────────┐
│ pending_signature   │ → Agreement generated, awaiting subcontractor signature
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   signed_by_sub     │ → Subcontractor has signed and uploaded agreement
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│pending_gc_signature │ → GC needs to review and countersign
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│      signed         │ → Fully executed (both parties signed)
└─────────────────────┘
```

### Status Descriptions

| Status | Description | Next Action Required |
|--------|-------------|---------------------|
| `pending_signature` | Agreement generated and ready for subcontractor | Subcontractor must download, sign, and upload |
| `signed_by_sub` | Subcontractor has signed and uploaded | GC must review and countersign |
| `pending_gc_signature` | Awaiting GC signature | GC must sign the agreement |
| `signed` | Fully executed agreement | Work can proceed - no further action needed |

---

## Step-by-Step Workflow

### Step 1: Agreement Generation (Admin)

**When:** After a COI (Certificate of Insurance) is approved

**Who:** Admin/System automatically

**What happens:**
1. Admin approves the COI in the COI Review dashboard
2. System checks if an Insurance Program has a hold harmless template
3. If program template exists → uses that template
4. If no program template → uses default system template
5. Template is populated with:
   - Project name and address
   - GC company name
   - Project Owner name
   - Additional Insured parties
   - Subcontractor name and trade
   - Effective dates
6. Generated agreement is stored as `hold_harmless_template_url`
7. Status set to `pending_signature`
8. **Subcontractor is notified via email**

**Email Notification Includes:**
- Link to download the hold harmless template
- Instructions on signing and uploading
- Portal link to subcontractor dashboard

---

### Step 2: Subcontractor Signs Agreement

**When:** After receiving notification

**Who:** Subcontractor

**Portal Location:** Subcontractor Dashboard → Projects tab → View COI Details

**What to do:**
1. Log into Subcontractor Portal
2. Navigate to the project
3. Click on COI details
4. Download the Hold Harmless Agreement template
5. **Print and physically sign** the agreement (or use digital signature tool)
6. **Scan or photograph** the signed document
7. **Upload** the signed copy via the portal
8. System updates:
   - `hold_harmless_sub_signed_url` → uploaded file URL
   - `hold_harmless_sub_signed_date` → current timestamp
   - `hold_harmless_status` → `signed_by_sub`
9. **GC is notified via email** to review and countersign

**Email to GC Includes:**
- Subcontractor name and trade
- Project name
- Link to view signed agreement
- Portal link to GC project view

---

### Step 3: GC Reviews and Countersigns

**When:** After receiving notification that subcontractor signed

**Who:** General Contractor

**Portal Location:** GC Dashboard → Projects → Project Details → Pending Hold Harmless Signatures

**What to do:**
1. Log into GC Portal
2. Navigate to the project
3. Review the **Pending Hold Harmless Signatures** section
4. Click to view the subcontractor-signed agreement
5. **Verify** the agreement is properly signed
6. Click **"Sign Hold Harmless Agreement"** button
7. Confirm signature action
8. System updates:
   - `hold_harmless_gc_signed_date` → current timestamp
   - `hold_harmless_status` → `signed`
9. **All parties notified:**
   - Subcontractor → work approved, can proceed
   - Admin → agreement fully executed
   - Broker → agreement completed

**Email to All Parties Includes:**
- Confirmation of full execution
- Work can now proceed
- Links to view final signed agreement

---

### Step 4: Work Can Proceed

**When:** After GC signs (status = `signed`)

**Who:** All parties

**What happens:**
- Subcontractor is fully approved to work on project
- Insurance compliance is complete
- Hold harmless protection is in place
- Work can begin on the construction project

---

## Role Responsibilities

### Subcontractor
- ✅ Download hold harmless template from portal
- ✅ Sign the agreement (physically or digitally)
- ✅ Upload signed copy to portal
- ✅ Verify upload was successful
- ⏱️ Complete within specified timeframe (typically 3-5 business days)

### General Contractor (GC)
- ✅ Review subcontractor-signed agreement
- ✅ Verify all information is correct
- ✅ Countersign the agreement via portal
- ✅ Approve work to proceed
- ⏱️ Review and sign within 2-3 business days of receiving notification

### Admin
- ✅ Generate hold harmless templates during COI approval
- ✅ Verify templates are properly populated
- ✅ Monitor signature progress
- ✅ Track compliance dashboard
- ✅ Send reminders if signatures are delayed

### Broker
- ℹ️ Receives notification when agreement is fully executed
- ℹ️ Can view agreement status for their clients
- ℹ️ No signature required from broker

---

## Technical Implementation

### Database Fields (GeneratedCOI Entity)

```javascript
{
  // Hold Harmless Template
  "hold_harmless_template_url": "https://storage.../template-abc123.pdf",
  "hold_harmless_template_name": "Hold Harmless - BuildCorp - Project XYZ.pdf",
  
  // Status Tracking
  "hold_harmless_status": "signed_by_sub",  // pending_signature | signed_by_sub | pending_gc_signature | signed
  
  // Subcontractor Signature
  "hold_harmless_sub_signed_url": "https://storage.../signed-sub-abc123.pdf",
  "hold_harmless_sub_signed_date": "2026-01-20T15:30:00.000Z",
  
  // GC Signature
  "hold_harmless_gc_signed_date": "2026-01-21T10:15:00.000Z",
  
  // Related entities
  "project_id": "proj-001",
  "subcontractor_id": "sub-001",
  "gc_id": "gc-001"
}
```

### Program Template Configuration (InsuranceProgram Entity)

Insurance Programs can include custom hold harmless templates:

```javascript
{
  "id": "prog-001",
  "name": "NYC Construction Standard",
  "description": "Standard insurance program for NYC projects",
  
  // Hold Harmless Template
  "hold_harmless_template_url": "https://storage.../custom-template.pdf",
  "hold_harmless_template_name": "NYC Custom Hold Harmless Template.pdf",
  
  // When this program is used, this template is automatically applied
  "is_active": true
}
```

### File Upload Process

**Subcontractor Upload:**
```javascript
// From SubcontractorPortal.jsx
const handleFileUpload = async (file, type) => {
  if (type === 'hold_harmless') {
    const uploadResult = await uploadFile(file, 'hold-harmless');
    
    await updateCOI({
      hold_harmless_sub_signed_url: uploadResult.file_url,
      hold_harmless_sub_signed_date: new Date().toISOString(),
      hold_harmless_status: 'signed_by_sub'
    });
    
    // Notify GC
    await sendNotificationToGC(coi, 'hold_harmless_signed');
  }
};
```

**GC Countersign:**
```javascript
// From GCProjectView.jsx
const handleSignHoldHarmless = async (coiId) => {
  await updateCOI({
    hold_harmless_status: 'signed',
    hold_harmless_gc_signed_date: new Date().toISOString()
  });
  
  // Notify all parties
  await sendNotificationToAllParties(coi, 'hold_harmless_complete');
};
```

---

## Notifications Summary

### Email 1: Subcontractor - "Sign Hold Harmless Agreement Required"
**Sent when:** COI approved and hold harmless template generated  
**To:** Subcontractor  
**Content:**
- Your COI has been approved
- Hold Harmless Agreement is required before work can proceed
- Download template link
- Instructions on signing and uploading
- Portal link to upload signed copy

### Email 2: GC - "Hold Harmless Agreement Ready for Review"
**Sent when:** Subcontractor uploads signed agreement  
**To:** General Contractor  
**Content:**
- Subcontractor [Name] has signed the Hold Harmless Agreement
- Project: [Project Name]
- View signed agreement link
- Portal link to review and countersign
- Reminder of approval timeline

### Email 3: All Parties - "Hold Harmless Agreement Fully Executed"
**Sent when:** GC countersigns agreement  
**To:** Subcontractor, GC, Admin, Broker  
**Content:**
- Hold Harmless Agreement is fully executed
- Subcontractor cleared to work
- Both parties signed confirmation
- Subcontractor signed: [Date]
- GC signed: [Date]
- View final agreement link

---

## Troubleshooting

### Issue: Subcontractor can't find the agreement template

**Solution:**
1. Log into Subcontractor Portal
2. Go to Projects tab
3. Find the specific project
4. Click "View COI Details"
5. Look for "Hold Harmless Agreement" section
6. Click download button

### Issue: Upload button not appearing

**Check:**
- COI status must be `pending_signature` or `signed_by_sub`
- Template URL must exist in the COI record
- User must be logged in as the correct subcontractor
- Browser console for errors

### Issue: GC doesn't see pending signature

**Check:**
- Subcontractor must have uploaded signed copy first
- Status should be `signed_by_sub`
- GC must be logged into correct GC account
- Check GC Project View → Pending Hold Harmless Signatures section

### Issue: Template not generating automatically

**Check:**
1. COI must be approved first
2. Check if Insurance Program has custom template
3. Verify admin has permission to generate
4. Check browser console and backend logs
5. Verify `hold_harmless_template_url` is populated

---

## Best Practices

### For Admins
- ✅ Always verify template is generated after COI approval
- ✅ Monitor signature progress on compliance dashboard
- ✅ Send reminders if signatures delayed beyond 5 business days
- ✅ Keep custom templates updated for each Insurance Program
- ✅ Review template content quarterly for legal compliance

### For Subcontractors
- ✅ Sign agreements promptly (within 3 business days)
- ✅ Ensure signature is clear and legible
- ✅ Upload high-quality scans (not blurry photos)
- ✅ Verify upload was successful before logging out
- ✅ Keep a copy for your records

### For GCs
- ✅ Review and countersign within 2 business days
- ✅ Verify all project details are correct before signing
- ✅ Confirm subcontractor signature is valid
- ✅ Keep signed agreements on file for project duration
- ✅ Don't allow work to proceed without signed agreement

---

## Related Documentation

- [Program Workflows](./PROGRAM_WORKFLOWS.md) - Complete workflow documentation
- [API Documentation](./API_DOCUMENTATION.md) - API endpoints for hold harmless
- [Insurance Requirements System](./INSURANCE_REQUIREMENTS_SYSTEM.md) - COI approval process
- [Data Model](./DATA_MODEL.md) - Database schema

---

## API Endpoints

### Get COI with Hold Harmless Data
```bash
GET /entities/GeneratedCOI/:id
Authorization: Bearer <token>
```

### Update Hold Harmless Status (Subcontractor Upload)
```bash
PATCH /entities/GeneratedCOI/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "hold_harmless_sub_signed_url": "https://storage.../signed.pdf",
  "hold_harmless_sub_signed_date": "2026-01-20T15:30:00.000Z",
  "hold_harmless_status": "signed_by_sub"
}
```

### GC Countersign Agreement
```bash
PATCH /entities/GeneratedCOI/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "hold_harmless_status": "signed",
  "hold_harmless_gc_signed_date": "2026-01-21T10:15:00.000Z"
}
```

---

## Compliance Notes

⚠️ **Important Legal Considerations:**

1. **Not Legal Advice**: This documentation is for software workflow only. Consult with legal counsel for agreement content.

2. **State-Specific Requirements**: Some states have specific indemnification laws. Verify compliance with local regulations.

3. **Signature Requirements**: Check with legal team whether physical signatures, digital signatures, or e-signatures are acceptable in your jurisdiction.

4. **Record Retention**: Maintain signed agreements for the duration of the project plus statutory period (typically 7-10 years).

5. **Insurance Alignment**: Hold harmless agreements should align with insurance coverage requirements.

---

*Last Updated: January 2026*
