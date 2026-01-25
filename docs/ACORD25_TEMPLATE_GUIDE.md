# ACORD 25 Sample COI Template Implementation

## Overview

The system now includes a comprehensive ACORD 25 (2016/03) Certificate of Liability Insurance template for generating both sample and actual COIs. This standardizes all COI generation across the platform.

## Files Created/Modified

### New Files
- **`/backend/data/acord25Template.js`** - Complete ACORD 25 template with sample data and helper functions

### Modified Files  
- **`/backend/integrations/adobe-pdf-service.js`** - Enhanced with template import and new methods

## Template Structure

### Core Components

The `acord25Template` object contains:

1. **Form Metadata**
   - `formVersion`: 'ACORD 25 (2016/03)'
   - `formTitle`: 'CERTIFICATE OF LIABILITY INSURANCE'

2. **Standard Text**
   - ACORD disclaimer text
   - Cancellation clause
   - Footer with copyright

3. **Sample Producer (Broker)**
   - Name: ABC Insurance Brokers LLC
   - Contact: Sarah Williams
   - Full address and contact details

4. **Sample Insured (Subcontractor)**
   - Name: Sample Construction Company LLC
   - Address and contact information

5. **Sample Insurance Companies**
   - 6 sample insurers (A-F) with NAIC codes and ratings

6. **Coverage Types** (with standard limits)
   - General Liability
   - Automobile Liability
   - Umbrella/Excess Liability
   - Workers Compensation
   - Professional Liability
   - Pollution Liability

7. **Endorsements**
   - CG 20 10 (Additional Insured - Owners, Lessees, Contractors)
   - CG 20 01 (Primary and Non-Contributory)
   - CG 24 04 (Waiver of Subrogation)
   - Auto and WC specific endorsements

8. **State Requirements**
   - NY, NJ, CT, PA specific insurance requirements

## Usage

### 1. Generate COI Data with Template Defaults

```javascript
import { generateCOIData } from './backend/data/acord25Template.js';

const coiData = generateCOIData();
// Returns complete COI object with template defaults
```

### 2. Generate COI with Custom Overrides

```javascript
const customCOI = generateCOIData({
  insured: {
    name: 'XYZ Electrical Services',
    address: '78 Electric Ave',
    city: 'Queens',
    state: 'NY',
    zipCode: '11375'
  },
  generalLiability: {
    policyNumber: 'GL-2026-999888',
    limits: {
      eachOccurrence: 1500000,
      generalAggregate: 3000000
    }
  },
  includeUmbrella: true,
  isSample: false
});
```

### 3. Generate Sample COI PDF

```javascript
const adobePDF = new AdobePDFService();

const result = await adobePDF.generateSampleCOI(
  {
    insured: { name: 'ABC Plumbing LLC' }
  },
  UPLOADS_DIR
);

// Returns:
// {
//   success: true,
//   coiData: {...},
//   filename: 'coi-...-....pdf',
//   generatedAt: '2026-01-25T...',
//   message: 'Sample COI generated successfully'
// }
```

### 4. Get Template for Reference

```javascript
const adobePDF = new AdobePDFService();
const template = adobePDF.getACORD25Template();
```

### 5. Generate COI Data Only (No PDF)

```javascript
const coiData = adobePDF.generateCOIDataFromTemplate({
  insured: { name: 'Client Name' }
});
```

## Integration with COI Generation Endpoints

The template is automatically used in:

1. **`POST /admin/generate-coi`** - System-generated COIs
2. **Sample COI displays** - In project details views
3. **Broker upload flows** - As reference template

## Standard Limits by Coverage Type

### General Liability
- Each Occurrence: $1,000,000
- General Aggregate: $2,000,000
- Products/Completed Ops: $2,000,000
- Medical Expense: $10,000
- Personal Adv. Injury: $1,000,000

### Automobile Liability
- Combined Single Limit: $1,000,000
- Hired Autos: Yes
- Non-Owned Autos: Yes

### Workers Compensation
- EL Each Accident: $1,000,000
- EL Disease Policy Limit: $1,000,000
- EL Disease Each Employee: $1,000,000

### Umbrella/Excess
- Each Occurrence: $5,000,000
- Aggregate: $5,000,000
- Retention: $10,000

### Professional Liability (if applicable)
- Each Claim: $1,000,000
- Aggregate: $2,000,000

### Pollution Liability (if applicable)
- Each Claim: $1,000,000
- Aggregate: $2,000,000

## Key Features

✅ **ACORD 25 Compliant** - Follows 2016/03 standard format
✅ **Flexible Template** - Easily customizable with overrides
✅ **Sample Data** - Professional default values for demo/sample COIs
✅ **State-Specific** - Includes state requirement guidelines
✅ **Endorsement Library** - Pre-configured standard endorsements
✅ **Timeout Protection** - PDF generation includes 30-second timeout safeguard
✅ **Error Handling** - Comprehensive error logging for troubleshooting

## Troubleshooting

### Issue: System hangs during COI creation
**Solution**: The timeout safeguard (30 seconds) will now fail gracefully with a clear error message instead of hanging indefinitely.

### Issue: Missing coverage types
**Solution**: Add coverage types to the `coverageTypes` object in the template and pass them via overrides.

### Issue: Custom limits not appearing
**Solution**: Ensure you're passing overrides as an object with matching property names (e.g., `generalLiability`, not `GL`).

## Future Enhancements

- [ ] Multi-page ACORD 25 with Additional Insured schedules
- [ ] Signature placeholders for broker/admin signing
- [ ] QR code for COI verification
- [ ] Automatic renewal date reminders
- [ ] Integration with insurance carrier APIs for live policy data
