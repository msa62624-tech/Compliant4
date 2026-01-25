# ACORD 25 Quick Reference Card

## ⚡ Quick Start

### Generate Sample COI
```javascript
import AdobePDFService from './backend/integrations/adobe-pdf-service.js';

const adobePDF = new AdobePDFService();
const result = await adobePDF.generateSampleCOI(
  { insured: { name: 'ABC Plumbing LLC' } },
  UPLOADS_DIR
);
```

### Use Template Data
```javascript
import { generateCOIData } from './backend/data/acord25Template.js';

const coiData = generateCOIData({
  insured: { name: 'Custom Company' },
  includeUmbrella: true
});
```

---

## 📋 Files & Locations

| File | Purpose |
|:---|:---|
| `backend/data/acord25Template.js` | Template definition & helper function |
| `backend/integrations/adobe-pdf-service.js` | PDF generation with timeout protection |
| `docs/ACORD25_TEMPLATE_GUIDE.md` | Complete usage guide |
| `docs/ACORD25_FORM_REFERENCE.md` | Visual form layout & state requirements |
| `ACORD25_IMPLEMENTATION.md` | Implementation summary |
| `ACORD25_SUMMARY.txt` | Comprehensive overview |

---

## 🏢 Standard Coverage Limits

| Coverage | Each Occurrence | Aggregate | Notes |
|:---|---:|---:|:---|
| **General Liability** | $1,000,000 | $2,000,000 | + Additional Insured |
| **Auto Liability** | $1,000,000 | Combined Single | + Hired/Non-owned |
| **Workers Comp** | Statutory | $1,000,000 EL | All employees |
| **Umbrella** | $5,000,000 | $5,000,000 | $10K retention |
| **Professional** | $1,000,000 | $2,000,000 | Optional |
| **Pollution** | $1,000,000 | $2,000,000 | Optional |

---

## 🎯 Template Override Keys

```javascript
generateCOIData({
  // Company information
  producer: { name, email, phone, address },
  insured: { name, address, city, state, zipCode },
  certificateHolder: { name, address },
  
  // Coverage customization
  generalLiability: { policyNumber, limits: { ... } },
  automobile: { policyNumber, limits: { ... } },
  workersCompensation: { policyNumber, limits: { ... } },
  umbrella: { policyNumber, limits: { ... } },
  
  // Optional coverages
  includeUmbrella: true,
  includeProfessional: true,
  includePollution: true,
  
  // Metadata
  isSample: true
})
```

---

## ✅ New Methods in AdobePDFService

### `generateSampleCOI(overrides, uploadDir)`
Generate sample ACORD 25 COI PDFs
- **Returns**: `{ success, coiData, filename, generatedAt, message }`
- **Timeout**: 30 seconds

### `getACORD25Template()`
Get the template reference
- **Returns**: `acord25Template` object

### `generateCOIDataFromTemplate(overrides)`
Generate COI data without PDF
- **Returns**: Complete COI data object

### `generateCOIPDF(coiData, uploadDir)` ⭐ Enhanced
- **NEW**: 30-second timeout safeguard
- **NEW**: Improved error handlers
- **Prevents**: System hanging on PDF generation

---

## 🔧 Sample Data Included

**Producer**: ABC Insurance Brokers LLC (Sarah Williams)
**Insured**: Sample Construction Company LLC  
**Certificate Holder**: ABC Development Company
**Insurers**: 6 sample insurance companies (A-F)

---

## 🚀 Key Features

✅ **ACORD 25 Compliant** - Official 2016/03 format  
✅ **Timeout Protection** - 30-second safety limit  
✅ **State-Specific** - NY, NJ, CT, PA requirements  
✅ **Flexible** - Easy customization via overrides  
✅ **Professional Defaults** - Sample data ready to use  
✅ **Error Handling** - Graceful failure messages  

---

## 🐛 Troubleshooting

**Q: PDF generation hangs?**  
A: Timeout will fail after 30 seconds with error message.

**Q: Custom data not appearing?**  
A: Check override key names match template structure.

**Q: Missing endorsements?**  
A: Standard endorsements auto-included. Modify template for custom ones.

---

## 📞 Integration Points

- `POST /admin/generate-coi` - Uses template for consistency
- `ProjectDetails.jsx` - Sample COI preview with template
- `COIReview.jsx` - Template for validation
- `BrokerPortal.jsx` - Reference template during review

---

## 📖 Documentation

- **ACORD25_TEMPLATE_GUIDE.md** - Full API & usage guide
- **ACORD25_FORM_REFERENCE.md** - Visual form & state requirements
- **ACORD25_IMPLEMENTATION.md** - Technical summary
- **ACORD25_SUMMARY.txt** - Comprehensive overview

---

**Version**: ACORD 25 (2016/03)  
**Status**: Ready for use  
**Created**: January 25, 2026
