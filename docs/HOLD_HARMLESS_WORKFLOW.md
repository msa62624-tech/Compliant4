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

**When:** After a COI (Certificate of Insurance) and insurance policies are approved

**Who:** Admin/System automatically

**What happens:**
1. Admin approves the COI and insurance policies in the COI Review dashboard
2. System retrieves the hold harmless template from the Insurance Program (template was uploaded during program creation)
3. System automatically populates the template with:
   - Project address (from project files)
   - Additional Insured parties (from project files)
   - GC entity information (from GC entity record)
   - Owner entity information (from Owner entity record)
   - Subcontractor name and trade
   - Effective dates
4. Generated agreement is stored in the system
5. Status set to `pending_signature`
6. **Subcontractor is notified via email**

**Email Notification Includes:**
- Portal link to digitally sign the agreement
- Instructions for completing signature within portal
- No download required - all done within the system

---

### Step 2: Subcontractor Signs Agreement (Digital Signature)

**When:** After receiving notification

**Who:** Subcontractor

**Portal Location:** Subcontractor Dashboard → Projects tab → View COI Details → Sign Agreement

**What to do:**
1. Log into Subcontractor Portal
2. Navigate to the project
3. Click on COI details
4. Click "Sign Hold Harmless Agreement" button
5. Review the pre-populated agreement on screen:
   - Address (auto-filled)
   - Additional insureds (auto-filled)
   - GC information (auto-filled)
   - Owner information (auto-filled)
6. **Complete signature form within portal:**
   - Enter full legal name of entity (company name)
   - Enter signature date
   - Add digital signature (type name or draw signature)
7. Click "Submit Signature"
8. System updates:
   - Saves signed agreement with signature embedded
   - `hold_harmless_sub_signed_date` → entered date
   - `hold_harmless_status` → `signed_by_sub`
9. **GC is notified via email** to digitally sign

**Email to GC Includes:**
- Subcontractor name and trade
- Project name
- Link to digitally sign agreement
- Portal link to GC project view

**Important:** No download/upload required - all signing done within the portal using digital signature

---

### Step 3: GC Reviews and Countersigns (Digital Signature)

**When:** After receiving notification that subcontractor signed

**Who:** General Contractor

**Portal Location:** GC Dashboard → Projects → Project Details → Pending Hold Harmless Signatures

**What to do:**
1. Log into GC Portal
2. Navigate to the project
3. Review the **Pending Hold Harmless Signatures** section
4. Click to view the subcontractor-signed agreement
5. **Verify** the subcontractor's signature and information
6. Click **"Sign Hold Harmless Agreement"** button
7. **Complete signature form within portal:**
   - Enter full legal name of entity (GC company name)
   - Enter signature date
   - Add digital signature (type name or draw signature)
8. Click "Submit Signature"
9. System updates:
   - Saves fully signed agreement with both signatures
   - `hold_harmless_gc_signed_date` → entered date
   - `hold_harmless_status` → `signed`
   - **Project marked as compliant**
10. **All parties notified:**
    - Subcontractor → work approved, can proceed
    - Admin → agreement fully executed, project compliant
    - Broker → agreement completed

**Email to All Parties Includes:**
- Confirmation of full execution
- Project marked compliant
- Work can now proceed
- Links to view final signed agreement

**Important:** No download/upload required - all signing done within the portal using digital signature

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
- ✅ Log into Subcontractor Portal when notified
- ✅ Review the pre-populated agreement
- ✅ Enter full legal entity name
- ✅ Add digital signature within portal
- ✅ Enter signature date
- ✅ Submit signature (no download/upload needed)
- ⏱️ Complete within specified timeframe (typically 3-5 business days)

### General Contractor (GC)
- ✅ Review subcontractor-signed agreement in portal
- ✅ Verify all information is correct
- ✅ Enter full legal entity name
- ✅ Add digital signature within portal
- ✅ Enter signature date
- ✅ Submit signature (no download/upload needed)
- ⏱️ Review and sign within 2-3 business days of receiving notification

### Admin
- ✅ Upload hold harmless template when creating Insurance Program
- ✅ Approve COI and insurance policies to trigger agreement generation
- ✅ System auto-populates templates with project data
- ✅ Monitor signature progress on dashboard
- ✅ Track compliance status
- ✅ Send reminders if signatures are delayed
- ✅ Verify project marked compliant after both signatures

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

**Insurance Programs MUST include a hold harmless template uploaded during program creation:**

```javascript
{
  "id": "prog-001",
  "name": "NYC Construction Standard",
  "description": "Standard insurance program for NYC projects",
  
  // Hold Harmless Template (uploaded when program is created)
  "hold_harmless_template_url": "https://storage.../custom-template.pdf",
  "hold_harmless_template_name": "NYC Custom Hold Harmless Template.pdf",
  
  // When this program is used and COI is approved, this template is automatically:
  // 1. Retrieved from the program
  // 2. Populated with project address, GC entity, owner entity, additional insureds
  // 3. Sent for digital signature
  "is_active": true
}
```

**Template Upload Process:**
1. Admin creates new Insurance Program
2. Admin uploads hold harmless template document (PDF or DOC)
3. Template is stored with the program
4. When any project uses this program and COI is approved:
   - System retrieves this template
   - Auto-fills with project-specific data
   - Generates agreement ready for digital signature

### Digital Signature Process

**Subcontractor Digital Signature:**
```javascript
// From SubcontractorPortal.jsx
const handleDigitalSignature = async (signatureData) => {
  // signatureData includes:
  // - entityName: Full legal name of subcontractor company
  // - signatureDate: Date of signature
  // - signature: Digital signature (drawn or typed)
  
  // Save signature to agreement document
  const signedAgreement = await embedSignatureInDocument(
    coi.hold_harmless_template_url,
    signatureData,
    'subcontractor'
  );
  
  await updateCOI({
    hold_harmless_signed_document_url: signedAgreement.url,
    hold_harmless_sub_signed_date: signatureData.signatureDate,
    hold_harmless_sub_entity_name: signatureData.entityName,
    hold_harmless_status: 'signed_by_sub'
  });
  
  // Notify GC
  await sendNotificationToGC(coi, 'hold_harmless_signed_by_sub');
};
```

**GC Digital Countersignature:**
```javascript
// From GCProjectView.jsx
const handleGCDigitalSignature = async (coiId, signatureData) => {
  // signatureData includes:
  // - entityName: Full legal name of GC company
  // - signatureDate: Date of signature
  // - signature: Digital signature (drawn or typed)
  
  // Add GC signature to already-signed agreement
  const fullySignedAgreement = await embedSignatureInDocument(
    coi.hold_harmless_signed_document_url,
    signatureData,
    'gc'
  );
  
  await updateCOI({
    hold_harmless_final_document_url: fullySignedAgreement.url,
    hold_harmless_gc_signed_date: signatureData.signatureDate,
    hold_harmless_gc_entity_name: signatureData.entityName,
    hold_harmless_status: 'signed'
  });
  
  // Mark project as compliant
  await updateProject(coi.project_id, {
    compliance_status: 'compliant',
    hold_harmless_completed: true
  });
  
  // Notify all parties
  await sendNotificationToAllParties(coi, 'hold_harmless_complete_project_compliant');
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

### Issue: Subcontractor can't find the agreement to sign

**Solution:**
1. Log into Subcontractor Portal
2. Go to Projects tab
3. Find the specific project
4. Click "View COI Details"
5. Look for "Sign Hold Harmless Agreement" button
6. Click button to open digital signature form

### Issue: Sign button not appearing

**Check:**
- COI and insurance policies must be approved by admin
- Agreement must be generated (status = `pending_signature`)
- User must be logged in as the correct subcontractor
- Browser console for errors
- Check that Insurance Program has a template uploaded

### Issue: GC doesn't see pending signature

**Check:**
- Subcontractor must have uploaded signed copy first
- Status should be `signed_by_sub`
- GC must be logged into correct GC account
- Check GC Project View → Pending Hold Harmless Signatures section

### Issue: Agreement not generating automatically

**Check:**
1. COI **and insurance policies** must be approved by admin
2. Insurance Program MUST have a hold harmless template uploaded
3. Verify template exists at `program.hold_harmless_template_url`
4. Check that project data includes: address, GC entity, owner entity, additional insureds
5. Check browser console and backend logs
6. Verify agreement generation triggered after admin approval

---

## Best Practices

### For Admins
- ✅ Upload hold harmless template when creating each Insurance Program
- ✅ Verify template is generated after COI and policy approval
- ✅ Ensure all project data is complete (address, GC entity, owner entity, additional insureds)
- ✅ Monitor signature progress on compliance dashboard
- ✅ Send reminders if signatures delayed beyond 5 business days
- ✅ Keep program templates updated for legal compliance
- ✅ Verify project marked compliant after both signatures

### For Subcontractors
- ✅ Sign agreements digitally within portal (within 3 business days)
- ✅ Enter full legal entity name accurately
- ✅ Ensure digital signature is clear and legible
- ✅ Enter correct signature date
- ✅ Verify submission successful before logging out
- ✅ Download final signed copy for your records (optional)

### For GCs
- ✅ Review and digitally sign within 2 business days
- ✅ Verify all auto-populated details are correct
- ✅ Enter full legal entity name accurately
- ✅ Confirm subcontractor signature before signing
- ✅ Verify project marked compliant after signing
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
