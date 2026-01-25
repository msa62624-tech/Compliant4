This file has been moved to `docs/acord25/ACORD25_DOCUMENTATION_INDEX.md`.
Please review the documentation index in the `docs/acord25/` folder.
- [ ] No syntax errors
  ```bash
  node -c backend/data/acord25Template.js
  node -c backend/integrations/adobe-pdf-service.js
  ```

- [ ] Methods available
  ```javascript
  const adobePDF = new AdobePDFService();
  adobePDF.generateSampleCOI()     // ✓ Available
  adobePDF.getACORD25Template()    // ✓ Available
  adobePDF.generateCOIDataFromTemplate() // ✓ Available
  ```

- [ ] Template exports working
  ```javascript
  import { generateCOIData } from './backend/data/acord25Template.js';
  generateCOIData({})  // ✓ Works
  ```

- [ ] Timeout protection active
  - 30-second timeout in place
  - Stream error handlers added
  - Document error handlers added

---

## 🆘 Troubleshooting

### "Module not found" error
**Check**: Import path matches file location
```javascript
// ✓ Correct
import { generateCOIData } from './backend/data/acord25Template.js';

// ✗ Wrong
import { generateCOIData } from './backend/acord25Template.js';
```

### "generateCOIData is not a function"
**Check**: You're importing the function, not the object
```javascript
// ✓ Correct
import { generateCOIData } from './backend/data/acord25Template.js';

// ✗ Wrong
import acord25Template from './backend/data/acord25Template.js';
```

### Custom data not appearing in PDF
**Check**: Override keys match template structure
```javascript
// ✓ Correct key
{ generalLiability: { policyNumber: 'GL-123' } }

// ✗ Wrong key
{ GL: { policyNumber: 'GL-123' } }
```

### PDF generation timeout
**Result**: Should now fail gracefully after 30 seconds with clear error
**Solution**: Check backend logs for specific PDF generation issues

---

## 📞 Support

- **Quick Questions?** Check [ACORD25_QUICK_REFERENCE.md](ACORD25_QUICK_REFERENCE.md)
- **Need Examples?** See [docs/ACORD25_TEMPLATE_GUIDE.md](docs/ACORD25_TEMPLATE_GUIDE.md)
- **Form Layout Help?** Review [docs/ACORD25_FORM_REFERENCE.md](docs/ACORD25_FORM_REFERENCE.md)
- **State Requirements?** Check [docs/ACORD25_FORM_REFERENCE.md](docs/ACORD25_FORM_REFERENCE.md) or [ACORD25_SUMMARY.txt](ACORD25_SUMMARY.txt)
- **Technical Details?** See [ACORD25_IMPLEMENTATION.md](ACORD25_IMPLEMENTATION.md)

---

## 🎉 Conclusion

You now have:
- ✅ Complete ACORD 25 template system
- ✅ Fixed COI generation hanging issue
- ✅ Professional sample data
- ✅ Flexible customization
- ✅ Comprehensive documentation
- ✅ State-specific requirements
- ✅ Ready to deploy

**Status**: Complete and verified  
**Quality**: Production-ready  
**Documentation**: Comprehensive  

---

**Last Updated**: January 25, 2026  
**Version**: ACORD 25 (2016/03)  
**Status**: ✅ COMPLETE
