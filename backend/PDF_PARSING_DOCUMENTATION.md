# PDF Parsing Documentation

## Overview

The insurance program PDF parsing logic in `backend/server.js` extracts tier-based insurance requirements from program PDFs using a three-pattern fallback approach. This document explains the parsing logic, its assumptions, and limitations.

## Core Functions

### 1. `parseDollarAmounts(blockText)`

Extracts dollar amounts from text blocks.

**Pattern:** `/\$([0-9,]+)/g`

**Features:**
- Handles comma-separated numbers (e.g., `$1,000,000`)
- Handles numbers without commas (e.g., `$1000000`)
- Returns an array of integers

**Edge Cases Handled:**
- Null/undefined input returns empty array
- Text without dollar signs returns empty array

### 2. `parseTierBasedRequirements(text)`

Main parsing function that uses three patterns in sequence (fallback approach).

#### Pattern 1: Tier/Trade Table Structure

**Regex:** `/(?:^|\n)\s*([a-z]+(?:\s+\d+)?)\s*[|\t]+\s*([^|\t\n]+?)\s*[|\t]+\s*([^|\t\n]*?)\s*[|\t]+\s*([^\n]+)/gim`

**Purpose:** Parses structured tier/trade tables with pipe (|) or tab separators

**Example Input:**
```
Tier | Trade | Scope | Insurance Limits | Notes
standard | Plumbing | — | $1,000,000 / $2,000,000 / $2,000,000 | —
high | Electrical | — | $2,000,000 / $3,000,000 / $3,000,000 | —
```

**Capture Groups:**
1. Tier name (e.g., "standard", "high", "premium")
2. Trade name (e.g., "Plumbing", "All Trades")
3. Scope description (optional)
4. Insurance limits (dollar amounts with any separators)

**Array Indexing Assumptions:**
```javascript
gl_each_occurrence:        dollars[0] || null  // Index 0
gl_general_aggregate:      dollars[1] || null  // Index 1
gl_products_completed_ops: dollars[2] || null  // Index 2
umbrella_each_occurrence:  dollars[3] || null  // Index 3
umbrella_aggregate:        dollars[4] || null  // Index 4
```

**Safety Features:**
- Bounds checking before array access: `(dollars.length > N ? dollars[N] : null)`
- Header row detection to skip table headers
- Null coalescing for missing values

**Separator Handling:**
- Primary: Pipe (|) and Tab (\t) for table structure
- Secondary: Slash (/), Dash (-), Comma (,) in dollar amounts section (handled by parseDollarAmounts)

#### Pattern 2: Prime Subcontractor Format (Legacy)

**Regex:** `/Prime\s+Subcontractor\s+[ABCD]([\s\S]{0,200})/i`

**Purpose:** Parses legacy "Prime Subcontractor" tier format

**Example Input:**
```
Prime Subcontractor A - Tower crane operations
Required Coverage: $5,000,000 / $10,000,000 / $10,000,000 / $25,000,000
```

**Tier Labels:**
- A: Tower crane operations
- B: All non-tower cranes
- C: Standard construction trades
- D: All other trades

**Array Indexing Assumptions (Different from Pattern 1):**

Pattern 2 uses a different dollar amount ordering with explicit fallback logic:

```javascript
// GL Each Occurrence - direct mapping
gl_each_occurrence: (dollars.length > 0 ? dollars[0] : null)

// Umbrella Each Occurrence - direct mapping
umbrella_each_occurrence: (dollars.length > 1 ? dollars[1] : null)

// GL General Aggregate - prefer index 2, fallback to 1
let glAggregate = null;
if (dollars.length > 2) {
  glAggregate = dollars[2];
} else if (dollars.length > 1) {
  glAggregate = dollars[1];
}

// GL Products/Completed Ops - prefer index 4, fallback to 2
let glProductsOps = null;
if (dollars.length > 4) {
  glProductsOps = dollars[4];
} else if (dollars.length > 2) {
  glProductsOps = dollars[2];
}

// Umbrella Aggregate - prefer index 3, fallback to 1
let umbrellaAggregate = null;
if (dollars.length > 3) {
  umbrellaAggregate = dollars[3];
} else if (dollars.length > 1) {
  umbrellaAggregate = dollars[1];
}
```

**⚠️ Important Note:** Pattern 2 has a different dollar amount ordering than Pattern 1. This assumes the legacy format lists umbrella coverage earlier in the sequence.

**Safety Features:**
- Explicit if-else fallback logic (refactored from nested ternaries for maintainability)
- Clear variable assignments with inline comments
- Bounds checking for sparse arrays
- 200-character context window to capture amounts

**Maintainability Improvement (Current Version):**
The refactored code uses clear if-else blocks instead of nested ternary operators, making it easier to:
- Understand the fallback logic
- Debug parsing issues
- Modify fallback behavior
- Add additional conditions if needed

#### Pattern 3: General Tier Format

**Regex:** `/(?:tier[:\s]+)?([a-z]+(?:\s+\d+)?)[:\s]+([^\n]+?)[\s\n]+\$([0-9,]+)/gi`

**Purpose:** Fallback pattern for less structured formats

**Example Input:**
```
standard: Plumbing
$1,000,000 $2,000,000

premium: HVAC  
$3,000,000 $5,000,000
```

**Array Indexing Assumptions (Same as Pattern 1):**
```javascript
gl_each_occurrence:        dollars[0] || null
gl_general_aggregate:      dollars[1] || null
gl_products_completed_ops: dollars[2] || null
umbrella_each_occurrence:  dollars[3] || null
umbrella_aggregate:        dollars[4] || null
```

**Safety Features:**
- Context-based extraction (±50-200 characters)
- Flexible tier prefix matching (with/without "tier:")

### 3. `buildProgramFromText(text, pdfName)`

Builds a complete insurance program structure from parsed requirements.

**Features:**
- Unique ID generation with timestamp and counter
- Automatic baseline requirements (WC, Auto) if not present
- Default fallback structure if no patterns match

**Default Values Applied:**
- GL Each Occurrence: $1,000,000
- GL General Aggregate: $2,000,000
- GL Products/Completed Ops: $2,000,000
- WC Each Accident: $1,000,000
- Auto Combined Single Limit: $1,000,000

## Assumptions & Limitations

### Dollar Amount Ordering

**Critical Assumption:** The order of dollar amounts in the PDF text corresponds to specific insurance types.

**Pattern 1 & 3 Assumption:**
1. GL Each Occurrence
2. GL General Aggregate
3. GL Products/Completed Operations
4. Umbrella Each Occurrence
5. Umbrella Aggregate

**Pattern 2 Assumption (Different!):**
1. GL Each Occurrence
2. Umbrella Each Occurrence
3. GL General Aggregate
4. Umbrella Aggregate
5. GL Products/Completed Operations

**⚠️ Risk:** If PDFs use different orderings, amounts may be mapped incorrectly.

**Mitigation Strategies:**
1. Safe array bounds checking prevents crashes
2. Default fallback values ensure minimum coverage
3. Manual review is flagged with notes: "Parsed from program PDF; review and adjust as needed."

### PDF Format Variations

**Known Compatible Formats:**
- Table-based layouts with pipe (|) or tab separators
- "Prime Subcontractor" labeled tiers
- Simple key-value pairs with colons

**Potentially Incompatible Formats:**
- Multi-column layouts without clear separators
- Amounts in narrative paragraphs
- Non-standard tier naming conventions
- Images or scanned PDFs (requires OCR, not implemented)

### Text Extraction Dependencies

**Dependency:** `pdf-parse` library

**Limitation:** Quality depends on:
- PDF structure (native vs. scanned)
- Font encoding
- Table cell boundaries

## Testing

### Test Coverage

The test suite `backend/test-pdf-parsing.js` validates:

1. **parseDollarAmounts:**
   - Basic extraction
   - Various formats (with/without commas)
   - Edge cases (null, empty, no amounts)

2. **Pattern Matching:**
   - Pattern 1: Table structure parsing
   - Pattern 2: Prime Subcontractor format
   - Pattern 3: General format

3. **Safety Features:**
   - Header row detection
   - Array indexing bounds
   - Null/undefined handling
   - Sparse arrays

4. **Integration:**
   - Complete program building
   - Default structure generation
   - Unique ID generation

5. **Real-World Scenarios:**
   - Mixed separator types
   - Multi-tier documents
   - Various dollar amount patterns

### Running Tests

```bash
cd backend
node test-pdf-parsing.js
```

**Expected Output:** All 43 tests should pass

## Validation Requirements

### Before Production Use

1. **Test with Actual PDFs:**
   - Collect sample PDFs from real insurance programs
   - Run through parsing logic
   - Manually verify extracted amounts match source documents
   - Document any discrepancies

2. **Edge Cases to Test:**
   - PDFs with non-standard table layouts
   - Documents with multiple currency formats
   - Mixed tier naming conventions
   - Incomplete coverage information

3. **Manual Review Process:**
   - All auto-parsed programs should be flagged for review
   - Admin users must verify amounts before activation
   - Notes field contains: "Parsed from program PDF; review and adjust as needed."

### Production Safeguards

1. **Conservative Defaults:**
   - If parsing fails, system creates minimal default structure
   - Default amounts err on the side of higher coverage

2. **Audit Trail:**
   - Raw PDF text is stored in `rawText` field
   - Timestamp and creation date tracked
   - Original PDF can be re-processed if needed

3. **User Notifications:**
   - Console warnings when patterns don't match
   - Admin dashboard should highlight auto-parsed programs

## Recommendations

### Short-Term (Current Implementation)

✅ Use as-is for initial testing and validation
✅ Collect real PDF samples to validate patterns
✅ Document any new patterns discovered
✅ Manual review all auto-parsed programs before activation

### Medium-Term Improvements

🔄 Add ML-based table detection for better structure recognition
🔄 Support additional PDF formats based on real-world data
🔄 Add confidence scoring to parsed requirements
🔄 Implement pattern auto-detection instead of fallback sequence

### Long-Term Enhancements

🚀 Integrate OCR for scanned documents
🚀 Use LLM-based extraction for unstructured text
🚀 Add visual PDF layout analysis
🚀 Support multi-page complex programs

## Error Handling

### Graceful Degradation

The parsing logic follows a "fail-safe" approach:

1. **Pattern 1 fails** → Try Pattern 2
2. **Pattern 2 fails** → Try Pattern 3
3. **All patterns fail** → Create default structure
4. **No amounts found** → Apply conservative defaults
5. **Array out of bounds** → Return null, apply defaults

### User-Visible Errors

None. All parsing failures result in:
- Default structure creation
- Console warning logged
- Note added to requirement: "Default requirement - PDF parsing did not find specific tiers. Please review and update."

## Security Considerations

### Input Validation

- Text extraction limited to reasonable sizes
- Regex patterns use non-greedy matching
- No code execution from PDF content
- File path validation prevents traversal attacks

### Data Sanitization

- Dollar amounts parsed to integers only
- Tier/trade names trimmed and validated
- Scope descriptions capped at reasonable length

## Maintenance

### Adding New Patterns

To add a new parsing pattern:

1. Add pattern before the `if (tiers.size === 0)` check for Pattern 2
2. Follow the same structure: regex → capture → parseDollarAmounts → limits
3. Add corresponding test cases
4. Document array indexing assumptions
5. Update this documentation

### Debugging Parsing Issues

1. **Enable Debug Logging:**
   ```javascript
   console.log('Regex match:', match);
   console.log('Dollar amounts:', dollars);
   console.log('Limits object:', limits);
   ```

2. **Check Raw Text:**
   - Log the `rawText` field from program output
   - Verify text extraction quality
   - Look for hidden characters or encoding issues

3. **Test Patterns Independently:**
   - Use regex101.com to validate patterns
   - Test with isolated text samples
   - Verify capture groups

## Change Log

### Recent Updates

- **[Latest]** Refactored Pattern 2 nested ternary logic for maintainability
  - Replaced nested ternaries with clear if-else blocks
  - Added inline comments explaining fallback logic
  - No functional changes, only improved code structure
  - Updated tests to match new implementation
- **[Latest]** Added comprehensive real-world PDF validation tests (34 tests)
  - Validated regex patterns against realistic insurance program formats
  - Tested Hudson Yards, LaGuardia Airport, and One World Trade Center styles
  - Confirmed multi-separator support and edge case handling
  - All validation tests passing
- **[Current PR]** Added explicit bounds checking for array indexing
- **[Current PR]** Improved regex separator documentation
- **[Current PR]** Added comprehensive test suite (43 unit tests)
- **[Current PR]** Documented dollar amount ordering assumptions

## Support

For issues or questions about PDF parsing:

1. Review this documentation
2. Run test suites to verify core functionality:
   - `node test-pdf-parsing.js` (43 unit tests)
   - `node test-pdf-validation.js` (34 validation tests)
3. Check console logs for parsing warnings
4. File issue with sample PDF text (anonymized)
