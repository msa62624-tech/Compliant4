/**
 * Enhanced Entity Endpoints with Versioning, Auditing, and Archiving
 * Add these endpoints to backend/server.js
 */

// =======================
// VERSIONING ENDPOINTS
// =======================

/**
 * Get document version history
 * GET /entities/:entityName/:id/versions
 */
app.get('/entities/:entityName/:id/versions', authenticateToken, (req, res) => {
  try {
    const { entityName, id } = req.params;
    
    if (!entities[entityName]) {
      return sendError(res, 404, `Entity ${entityName} not found`);
    }

    const item = entities[entityName]?.find(e => e.id === id);
    if (!item) {
      return sendError(res, 404, `${entityName} with id '${id}' not found`);
    }

    const versions = item.versions || [];
    const history = versions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(v => ({
        versionNumber: v.versionNumber,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        changesSummary: v.changes,
        id: v.id
      }));

    res.json({
      success: true,
      data: {
        id,
        currentVersion: item.version || 1,
        history
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    sendError(res, 500, 'Failed to fetch version history');
  }
});

/**
 * Get specific version details
 * GET /entities/:entityName/:id/versions/:versionId
 */
app.get('/entities/:entityName/:id/versions/:versionId', authenticateToken, (req, res) => {
  try {
    const { entityName, id, versionId } = req.params;
    
    const item = entities[entityName]?.find(e => e.id === id);
    if (!item) {
      return sendError(res, 404, `${entityName} with id '${id}' not found`);
    }

    const version = item.versions?.find(v => v.id === versionId);
    if (!version) {
      return sendError(res, 404, 'Version not found');
    }

    res.json({
      success: true,
      data: version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    sendError(res, 500, 'Failed to fetch version');
  }
});

/**
 * Restore to previous version
 * POST /entities/:entityName/:id/versions/:versionId/restore
 */
app.post('/entities/:entityName/:id/versions/:versionId/restore', authenticateToken, (req, res) => {
  try {
    const { entityName, id, versionId } = req.params;
    
    const entity = entities[entityName];
    if (!entity) {
      return sendError(res, 404, `Entity ${entityName} not found`);
    }

    const itemIndex = entity.findIndex(e => e.id === id);
    if (itemIndex === -1) {
      return sendError(res, 404, `${entityName} with id '${id}' not found`);
    }

    const item = entity[itemIndex];
    const version = item.versions?.find(v => v.id === versionId);
    if (!version) {
      return sendError(res, 404, 'Version not found');
    }

    // Create new version before restoring
    const newVersion = {
      id: `version-${Date.now()}`,
      versionNumber: (item.version || 1) + 1,
      createdAt: new Date().toISOString(),
      createdBy: req.user.username,
      changes: 'Restored from version ' + version.versionNumber,
      snapshot: { ...item }
    };

    // Restore the old version
    const restoredItem = {
      ...version.snapshot,
      version: newVersion.versionNumber,
      restoredAt: new Date().toISOString(),
      restoredBy: req.user.username,
      restoredFromVersion: version.versionNumber,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.username,
      versions: [...(item.versions || []), newVersion]
    };

    entity[itemIndex] = restoredItem;
    saveData();

    // Log audit trail
    auditLog({
      action: 'RESTORE_VERSION',
      entityName,
      itemId: id,
      fromVersion: version.versionNumber,
      toVersion: newVersion.versionNumber,
      userId: req.user.username,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Restored to version ${version.versionNumber}`,
      data: restoredItem,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    sendError(res, 500, 'Failed to restore version');
  }
});

// =======================
// AUDIT TRAIL ENDPOINTS
// =======================

/**
 * Get audit logs
 * GET /audit-logs?action=&userId=&dateFrom=&dateTo=&limit=100&offset=0
 */
app.get('/audit-logs', authenticateToken, (req, res) => {
  try {
    const { action, userId, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
    
    let logs = auditLogs || [];

    // Filter by action
    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    // Filter by user
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    // Filter by date range
    if (dateFrom) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(dateTo));
    }

    // Sort by date descending
    logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const total = logs.length;
    const paginatedLogs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    sendError(res, 500, 'Failed to fetch audit logs');
  }
});

/**
 * Get audit report
 * GET /audit-logs/report?dateFrom=&dateTo=
 */
app.get('/audit-logs/report', authenticateToken, (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let logs = auditLogs || [];

    // Filter by date range
    if (dateFrom) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(dateTo));
    }

    // Generate report
    const report = {
      totalActions: logs.length,
      actionsByType: {},
      userActivity: {},
      successRate: 0,
      dateRange: {}
    };

    logs.forEach(log => {
      report.actionsByType[log.action] = (report.actionsByType[log.action] || 0) + 1;
      report.userActivity[log.userId] = (report.userActivity[log.userId] || 0) + 1;
    });

    const successful = logs.filter(log => log.status === 'success').length;
    report.successRate = logs.length > 0 ? (successful / logs.length) * 100 : 0;

    if (logs.length > 0) {
      const dates = logs.map(log => new Date(log.timestamp));
      report.dateRange = {
        from: new Date(Math.min(...dates)).toISOString(),
        to: new Date(Math.max(...dates)).toISOString()
      };
    }

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    sendError(res, 500, 'Failed to generate audit report');
  }
});

// =======================
// ARCHIVE ENDPOINTS
// =======================

/**
 * Archive entity
 * POST /entities/:entityName/:id/archive
 */
app.post('/entities/:entityName/:id/archive', 
  authenticateToken,
  [body('reason').optional().isString()],
  handleValidationErrors,
  (req, res) => {
    try {
      const { entityName, id } = req.params;
      const { reason = '' } = req.body;

      const entity = entities[entityName];
      if (!entity) {
        return sendError(res, 404, `Entity ${entityName} not found`);
      }

      const itemIndex = entity.findIndex(e => e.id === id);
      if (itemIndex === -1) {
        return sendError(res, 404, `${entityName} with id '${id}' not found`);
      }

      const item = entity[itemIndex];
      item.isArchived = true;
      item.archivedAt = new Date().toISOString();
      item.archivedBy = req.user.username;
      item.archivedReason = reason;
      item.status = 'archived';

      entity[itemIndex] = item;
      saveData();

      // Log audit trail
      auditLog({
        action: 'ARCHIVE',
        entityName,
        itemId: id,
        userId: req.user.username,
        reason,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `${entityName} archived successfully`,
        data: item,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error archiving entity:', error);
      sendError(res, 500, 'Failed to archive entity');
    }
  }
);

/**
 * Unarchive entity
 * POST /entities/:entityName/:id/unarchive
 */
app.post('/entities/:entityName/:id/unarchive', authenticateToken, (req, res) => {
  try {
    const { entityName, id } = req.params;

    const entity = entities[entityName];
    if (!entity) {
      return sendError(res, 404, `Entity ${entityName} not found`);
    }

    const itemIndex = entity.findIndex(e => e.id === id);
    if (itemIndex === -1) {
      return sendError(res, 404, `${entityName} with id '${id}' not found`);
    }

    const item = entity[itemIndex];
    item.isArchived = false;
    item.archivedAt = null;
    item.archivedBy = null;
    item.archivedReason = null;
    item.status = 'active';

    entity[itemIndex] = item;
    saveData();

    // Log audit trail
    auditLog({
      action: 'UNARCHIVE',
      entityName,
      itemId: id,
      userId: req.user.username,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `${entityName} unarchived successfully`,
      data: item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error unarchiving entity:', error);
    sendError(res, 500, 'Failed to unarchive entity');
  }
});

/**
 * Get archived items
 * GET /entities/:entityName/archived?limit=50&offset=0
 */
app.get('/entities/:entityName/archived', authenticateToken, (req, res) => {
  try {
    const { entityName } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!entities[entityName]) {
      return sendError(res, 404, `Entity ${entityName} not found`);
    }

    const entity = entities[entityName];
    const archived = entity.filter(item => item.isArchived);

    // Pagination
    const total = archived.length;
    const items = archived.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching archived items:', error);
    sendError(res, 500, 'Failed to fetch archived items');
  }
});

// =======================
// SEARCH & FILTER ENDPOINTS
// =======================

/**
 * Advanced search across all fields
 * POST /search?entityName=&query=&filters={}
 */
app.post('/search', authenticateToken, (req, res) => {
  try {
    const { entityName, query = '', filters = {}, page = 1, pageSize = 20 } = req.body;

    if (!entityName || !entities[entityName]) {
      return sendError(res, 400, 'Valid entityName is required');
    }

    let results = entities[entityName];

    // Full-text search
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(item => {
        return Object.values(item).some(value => 
          String(value).toLowerCase().includes(lowerQuery)
        );
      });
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        results = results.filter(item => item[key] === value);
      }
    });

    // Pagination
    const total = results.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    res.json({
      success: true,
      data: paginatedResults,
      pagination: {
        total,
        pageSize,
        page,
        pages: Math.ceil(total / pageSize)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching:', error);
    sendError(res, 500, 'Search failed');
  }
});

// =======================
// BULK OPERATIONS ENDPOINTS
// =======================

/**
 * Bulk update entities
 * PATCH /bulk/update/:entityName
 */
app.patch('/bulk/update/:entityName',
  authenticateToken,
  [body('ids').isArray().notEmpty()],
  handleValidationErrors,
  (req, res) => {
    try {
      const { entityName } = req.params;
      const { ids = [], updates = {} } = req.body;

      const entity = entities[entityName];
      if (!entity) {
        return sendError(res, 404, `Entity ${entityName} not found`);
      }

      const results = [];
      ids.forEach(id => {
        const itemIndex = entity.findIndex(e => e.id === id);
        if (itemIndex !== -1) {
          const item = entity[itemIndex];
          const updated = {
            ...item,
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.username
          };
          entity[itemIndex] = updated;
          results.push({ id, success: true });
        } else {
          results.push({ id, success: false, error: 'Item not found' });
        }
      });

      saveData();

      // Log audit trail
      auditLog({
        action: 'BULK_UPDATE',
        entityName,
        itemIds: ids,
        updateCount: results.filter(r => r.success).length,
        userId: req.user.username,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Updated ${results.filter(r => r.success).length} of ${ids.length} items`,
        data: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in bulk update:', error);
      sendError(res, 500, 'Bulk update failed');
    }
  }
);

/**
 * Bulk delete entities
 * DELETE /bulk/delete/:entityName
 */
app.delete('/bulk/delete/:entityName',
  authenticateToken,
  [body('ids').isArray().notEmpty()],
  handleValidationErrors,
  (req, res) => {
    try {
      const { entityName } = req.params;
      const { ids = [] } = req.body;

      const entity = entities[entityName];
      if (!entity) {
        return sendError(res, 404, `Entity ${entityName} not found`);
      }

      const results = [];
      const beforeCount = entity.length;

      ids.forEach(id => {
        const itemIndex = entity.findIndex(e => e.id === id);
        if (itemIndex !== -1) {
          entity.splice(itemIndex, 1);
          results.push({ id, success: true });
        } else {
          results.push({ id, success: false, error: 'Item not found' });
        }
      });

      const afterCount = entity.length;
      saveData();

      // Log audit trail
      auditLog({
        action: 'BULK_DELETE',
        entityName,
        itemIds: ids,
        deleteCount: beforeCount - afterCount,
        userId: req.user.username,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Deleted ${beforeCount - afterCount} of ${ids.length} items`,
        data: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in bulk delete:', error);
      sendError(res, 500, 'Bulk delete failed');
    }
  }
);

// =======================
// REPORTING ENDPOINTS
// =======================

/**
 * Get compliance report
 * GET /reports/compliance
 */
app.get('/reports/compliance', authenticateToken, (req, res) => {
  try {
    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.username,
      summary: {},
      details: {}
    };

    // Count entities by type and status
    Object.entries(entities).forEach(([entityName, items]) => {
      report.summary[entityName] = {
        total: items.length,
        active: items.filter(i => i.status === 'active').length,
        archived: items.filter(i => i.isArchived).length,
        pending: items.filter(i => i.status?.includes('pending')).length
      };
    });

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    sendError(res, 500, 'Failed to generate report');
  }
});

/**
 * Get activity report
 * GET /reports/activity?dateFrom=&dateTo=
 */
app.get('/reports/activity', authenticateToken, (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let logs = auditLogs || [];

    if (dateFrom) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(dateTo));
    }

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.username,
      period: { from: dateFrom, to: dateTo },
      totalActions: logs.length,
      actionsByType: {},
      userActivity: {}
    };

    logs.forEach(log => {
      report.actionsByType[log.action] = (report.actionsByType[log.action] || 0) + 1;
      report.userActivity[log.userId] = (report.userActivity[log.userId] || 0) + 1;
    });

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating activity report:', error);
    sendError(res, 500, 'Failed to generate report');
  }
});

// =======================
// HELPER FUNCTIONS
// =======================

// Audit logging function
function auditLog(entry) {
  if (!auditLogs) auditLogs = [];
  auditLogs.push({
    id: `audit-${Date.now()}`,
    ...entry,
    status: 'success'
  });
  // Keep last 10000 logs
  if (auditLogs.length > 10000) {
    auditLogs = auditLogs.slice(-10000);
  }
}

// Audit logs storage
let auditLogs = [];
