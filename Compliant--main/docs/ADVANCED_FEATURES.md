# Advanced Features Documentation

## Overview

This document describes the comprehensive feature enhancements implemented for INsuretrack, including search/filtering, bulk operations, reporting, versioning, audit trails, and archiving.

---

## 1. Search & Filtering

### User-Friendly Error Handling

All dashboard operations now provide clear, actionable error messages:

```javascript
// Example error handling
const error = DashboardErrorHandler.handle(error, 'fetchData');
// Returns:
// {
//   message: "Clear message for user",
//   type: "error|warning"
// }
```

#### HTTP Status Mapping
- **401**: Session expired - ask user to log in again
- **403**: Permission denied - inform user they can't perform this action
- **404**: Resource not found - indicate what was missing
- **429**: Rate limited - ask user to wait
- **500+**: Server error - suggest retry or contact support

### Search Implementation

```javascript
// Search across multiple fields
SearchFilterUtils.search(items, 'query', ['name', 'email', 'company_name']);

// Returns items matching the query in any of those fields
```

### Filtering & Sorting

```javascript
// Apply multiple filters
const filtered = SearchFilterUtils.filter(items, {
  status: 'active',
  type: ['type1', 'type2'],
  region: 'NY'
});

// Sort items
const sorted = SearchFilterUtils.sort(items, {
  key: 'name',
  direction: 'asc'
});

// Paginate
const page = SearchFilterUtils.paginate(items, 2, 20); // page 2, 20 items
```

---

## 2. Bulk Operations

### Selection Management

```javascript
// Toggle single item
const selected = BulkOperationsUtils.toggleSelection(
  selectedSet,
  'item-id',
  true // isSelected
);

// Select all
const allSelected = BulkOperationsUtils.selectAll(items);

// Deselect all
const none = BulkOperationsUtils.deselectAll();
```

### Bulk Update/Delete

```javascript
// Bulk update multiple items
const results = await BulkOperationsUtils.bulkUpdate(
  ['id1', 'id2', 'id3'],
  { status: 'archived' },
  apiClient
);

// Returns:
// [
//   { id: 'id1', success: true, data: {...} },
//   { id: 'id2', success: true, data: {...} },
//   { id: 'id3', success: false, error: 'Not found' }
// ]
```

### Backend Endpoints

**Bulk Update:**
```
PATCH /bulk/update/:entityName
Body: {
  ids: ['id1', 'id2'],
  updates: { status: 'archived', flag: true }
}
```

**Bulk Delete:**
```
DELETE /bulk/delete/:entityName
Body: {
  ids: ['id1', 'id2']
}
```

---

## 3. Document Versioning

### How It Works

Every time a document is updated, the system creates an automatic version snapshot.

```javascript
// Create a version
const version = DocumentVersioning.createVersion(
  document,
  userId,
  'Updated insurance coverage'
);

// Get version history (newest first)
const history = DocumentVersioning.getHistory(versions);

// Restore to previous version
const restored = DocumentVersioning.restoreVersion(version, userId);

// Compare two versions
const changes = DocumentVersioning.compareVersions(version1, version2);
// Returns: [
//   { field: 'status', oldValue: 'pending', newValue: 'approved' },
//   { field: 'date_updated', oldValue: '2025-01-01', newValue: '2025-01-14' }
// ]
```

### Backend Endpoints

**Get Version History:**
```
GET /entities/GeneratedCOI/coi-123/versions
Response: {
  currentVersion: 5,
  history: [
    { versionNumber: 5, createdAt: '...', createdBy: 'admin', changesSummary: '...' },
    { versionNumber: 4, createdAt: '...', createdBy: 'broker', changesSummary: '...' }
  ]
}
```

**Get Specific Version:**
```
GET /entities/GeneratedCOI/coi-123/versions/version-1234567890
```

**Restore to Previous Version:**
```
POST /entities/GeneratedCOI/coi-123/versions/version-1234567890/restore
```

---

## 4. Audit Trails

### What Gets Logged

Every significant action is logged with:
- **Action Type**: CREATE, UPDATE, DELETE, RESTORE_VERSION, ARCHIVE, BULK_UPDATE, etc.
- **User**: Who performed the action
- **Timestamp**: When it happened
- **Details**: What was changed
- **Status**: Success or failure
- **IP Address**: Where the action came from

### Backend Endpoints

**Get Audit Logs:**
```
GET /audit-logs?action=UPDATE&userId=admin&dateFrom=2025-01-01&dateTo=2025-01-14&limit=100&offset=0

Response: {
  data: [
    {
      id: 'audit-1234567890',
      action: 'UPDATE',
      userId: 'admin',
      timestamp: '2025-01-14T06:00:00Z',
      details: 'Updated status to approved',
      status: 'success'
    }
  ],
  pagination: { total: 245, pages: 3, limit: 100 }
}
```

**Get Audit Report:**
```
GET /audit-logs/report?dateFrom=2025-01-01&dateTo=2025-01-14

Response: {
  totalActions: 1250,
  actionsByType: {
    UPDATE: 450,
    CREATE: 320,
    DELETE: 85,
    RESTORE_VERSION: 12
  },
  userActivity: {
    'admin': 450,
    'broker-1': 320,
    'contractor-2': 85
  },
  successRate: 98.5
}
```

---

## 5. Archiving & Folders

### Archive Management

```javascript
// Archive a document
const archived = ArchiveSystem.archive(document, 'Superseded by v2');

// Unarchive a document
const unarchived = ArchiveSystem.unarchive(document);

// Create a folder
const folder = ArchiveSystem.createFolder('2024 Insurance', parentFolderId);

// Move document to folder
const moved = ArchiveSystem.moveToFolder(document, folderId);

// Build folder tree
const tree = ArchiveSystem.buildFolderTree(folders, documents);
// Returns: {
//   documents: [docs in root],
//   folders: [
//     { name: 'folder1', documents: [...], children: [...] },
//     { name: 'folder2', documents: [...], children: [...] }
//   ]
// }
```

### Backend Endpoints

**Archive Document:**
```
POST /entities/GeneratedCOI/coi-123/archive
Body: { reason: 'Expired' }
```

**Unarchive Document:**
```
POST /entities/GeneratedCOI/coi-123/unarchive
```

**Get Archived Items:**
```
GET /entities/GeneratedCOI/archived?limit=50&offset=0
```

---

## 6. Reporting & Analytics

### Compliance Report

Generates summary of all documents by status, expiry status, and pending items:

```
GET /reports/compliance

Response: {
  summary: {
    GeneratedCOI: { total: 150, active: 140, archived: 10, pending: 5 },
    InsuranceDocument: { total: 200, active: 190, archived: 10, pending: 0 }
  }
}
```

### Activity Report

Shows activity patterns over a time period:

```
GET /reports/activity?dateFrom=2025-01-01&dateTo=2025-01-14

Response: {
  period: { from: '2025-01-01', to: '2025-01-14' },
  totalActions: 1250,
  actionsByType: { UPDATE: 450, CREATE: 320, DELETE: 85 },
  userActivity: { admin: 450, broker-1: 320, contractor-2: 85 }
}
```

---

## 7. Performance Optimizations

### Virtualization for Large Datasets

For lists with thousands of items:

```javascript
// Get visible range for virtualization
const { startIndex, endIndex } = PerformanceUtils.getVisibleRange(
  scrollTop,
  itemHeight,
  containerHeight
);

// Only render visible items
const visibleItems = items.slice(startIndex, endIndex);
```

### Debouncing

Prevent excessive API calls during search:

```javascript
const debouncedSearch = PerformanceUtils.debounce(
  (query) => performSearch(query),
  300 // Wait 300ms after user stops typing
);
```

### Memoization

Cache expensive computations:

```javascript
const memoizedCalculation = PerformanceUtils.memoize((data) => {
  // Expensive computation
  return result;
});

// Second call with same args returns cached result
memoizedCalculation(data); // Uses cache
```

---

## 8. Advanced Search API

### Full-Text Search

```
POST /search
Body: {
  entityName: 'GeneratedCOI',
  query: 'John Smith',
  filters: { status: 'active', type: 'GL' },
  page: 1,
  pageSize: 20
}

Response: {
  data: [{ id: 'coi-1', name: 'John Smith...', ... }],
  pagination: { total: 5, page: 1, pages: 1 }
}
```

---

## 9. UI Components

### Error Alert Component

```jsx
<ErrorAlert 
  error={{ message: 'Failed to load data' }}
  onDismiss={() => setError(null)}
/>
```

### Search Bar Component

```jsx
<SearchBar 
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search COIs..."
/>
```

### Bulk Actions Toolbar Component

```jsx
<BulkActionsToolbar 
  selectedCount={3}
  onSelectAll={handleSelectAll}
  onClearSelection={handleClearSelection}
  actions={[
    { 
      id: 'archive', 
      label: 'Archive', 
      onClick: handleArchiveSelected,
      variant: 'outline'
    },
    { 
      id: 'delete', 
      label: 'Delete', 
      onClick: handleDeleteSelected,
      variant: 'destructive'
    }
  ]}
/>
```

---

## 10. Integration Guide

### Enable Versioning in Frontend

```jsx
import { DocumentVersioning } from '@/utils/advancedFeatures';

// Before updating a document
const version = DocumentVersioning.createVersion(
  currentDocument,
  userId,
  'Updated coverage details'
);

// Send update to backend
await updateDocument(documentId, updatedData);
```

### Add Audit Logging

```javascript
import { AuditTrail } from '@/utils/advancedFeatures';

const logEntry = AuditTrail.log('UPDATE', {
  userId: user.id,
  description: 'Updated insurance policy',
  status: 'success',
  changedFields: ['coverage_amount', 'expiry_date']
});
```

### Use Archive System

```javascript
// Archive with reason
const archived = await archiveDocument(docId, 'Expired');

// Later, restore if needed
const restored = await restoreDocument(docId);
```

---

## 11. Best Practices

1. **Always log significant actions** - Create audit trails for compliance
2. **Use bulk operations** - More efficient than individual updates
3. **Implement versioning** - Allow users to see history and restore
4. **Archive instead of delete** - Preserve data for compliance
5. **Regular backups** - Keep audit logs and versions safe
6. **Performance first** - Use pagination and virtualization for large datasets
7. **Clear error messages** - Help users understand what went wrong
8. **Secure audit logs** - Restrict access to audit trails

---

## 12. Future Enhancements

- [ ] Advanced filtering UI with saved filters
- [ ] Export to PDF/Excel for reports
- [ ] Scheduled report delivery via email
- [ ] Full-text search index optimization
- [ ] Document comparison view
- [ ] Change notification system
- [ ] Compliance workflow automation
- [ ] Advanced analytics dashboard
