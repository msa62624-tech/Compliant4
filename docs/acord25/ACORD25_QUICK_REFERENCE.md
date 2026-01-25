````markdown
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

... (trimmed for archive)

````
