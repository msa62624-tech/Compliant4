interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changes: string;
  snapshot: Record<string, any>;
  status: string;
}

interface RestoredDocument extends Record<string, any> {
  restoredAt: string;
  restoredBy: string;
  restoredFromVersion: number;
}

interface VersionChange {
  field: string;
  oldValue: any;
  newValue: any;
}

interface AuditLogDetails {
  userId?: string;
  ipAddress?: string;
  description?: string;
  status?: string;
  result?: any;
  changedFields?: string[];
}

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  userId?: string;
  ipAddress?: string;
  userAgent: string;
  details: string;
  status: string;
  result?: any;
  changedFields: string[];
}

interface AuditFilters {
  action?: string;
  userId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface AuditReport {
  totalActions: number;
  actionsByType: Record<string, number>;
  userActivity: Record<string, number>;
  successRate: number;
  dateRange: {
    from?: string;
    to?: string;
  };
}

interface ArchiveDocument extends Record<string, any> {
  status: string;
  archivedAt: string | null;
  archivedReason: string | null;
  isArchived: boolean;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  children: any[];
  itemCount: number;
  type: string;
}

interface DocumentWithFolder extends Record<string, any> {
  folderId?: string;
  movedAt?: string;
}

interface FolderTree {
  documents: any[];
  folders: any[];
}

interface ComplianceReport {
  totalDocuments: number;
  byStatus: Record<string, number>;
  expiringSoon: any[];
  expired: Array<{
    id: string;
    name: string;
    expiryDate: string;
    daysExpired: number;
  }>;
  pending: any[];
  generatedAt: string;
}

interface ActivityReport {
  period: {
    from?: string;
    to?: string;
  };
  activitiesByDay: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  generatedAt: string;
}

/**
 * Document Versioning System
 * Tracks changes and maintains version history
 */
export const DocumentVersioning = {
  /**
   * Create a new version of a document
   */
  createVersion: (document: Record<string, any>, userId: string, changesSummary: string): DocumentVersion => {
    return {
      id: `version-${Date.now()}`,
      documentId: document.id,
      versionNumber: (document.version || 0) + 1,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changes: changesSummary,
      snapshot: { ...document },
      status: 'active'
    };
  },

  /**
   * Get version history
   */
  getHistory: (versions: DocumentVersion[] = []): DocumentVersion[] => {
    return versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Restore document to previous version
   */
  restoreVersion: (version: DocumentVersion, restoredBy: string): RestoredDocument => {
    return {
      ...version.snapshot,
      restoredAt: new Date().toISOString(),
      restoredBy,
      restoredFromVersion: version.versionNumber
    };
  },

  /**
   * Compare two versions
   */
  compareVersions: (version1: DocumentVersion, version2: DocumentVersion): VersionChange[] => {
    const changes: VersionChange[] = [];
    const allKeys = new Set([
      ...Object.keys(version1.snapshot || {}),
      ...Object.keys(version2.snapshot || {})
    ]);

    allKeys.forEach(key => {
      const val1 = version1.snapshot?.[key];
      const val2 = version2.snapshot?.[key];
      if (val1 !== val2) {
        changes.push({
          field: key,
          oldValue: val1,
          newValue: val2
        });
      }
    });

    return changes;
  }
};

/**
 * Audit Trail System
 * Logs all significant actions
 */
export const AuditTrail = {
  /**
   * Log an action
   */
  log: (action: string, details: AuditLogDetails = {}): AuditLog => {
    return {
      id: `audit-${Date.now()}`,
      action,
      timestamp: new Date().toISOString(),
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: navigator.userAgent,
      details: details.description || '',
      status: details.status || 'success',
      result: details.result,
      changedFields: details.changedFields || []
    };
  },

  /**
   * Filter audit logs
   */
  filterLogs: (logs: AuditLog[] = [], filters: AuditFilters = {}): AuditLog[] => {
    return logs.filter(log => {
      if (filters.action && log.action !== filters.action) return false;
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.status && log.status !== filters.status) return false;
      if (filters.dateFrom && new Date(log.timestamp) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(log.timestamp) > new Date(filters.dateTo)) return false;
      return true;
    });
  },

  /**
   * Generate audit report
   */
  generateReport: (logs: AuditLog[] = []): AuditReport => {
    const report: AuditReport = {
      totalActions: logs.length,
      actionsByType: {},
      userActivity: {},
      successRate: 0,
      dateRange: {}
    };

    logs.forEach(log => {
      report.actionsByType[log.action] = (report.actionsByType[log.action] || 0) + 1;
      if (log.userId) {
        report.userActivity[log.userId] = (report.userActivity[log.userId] || 0) + 1;
      }
    });

    const successful = logs.filter(log => log.status === 'success').length;
    report.successRate = logs.length > 0 ? (successful / logs.length) * 100 : 0;

    if (logs.length > 0) {
      const dates = logs.map(log => new Date(log.timestamp).getTime());
      report.dateRange = {
        from: new Date(Math.min(...dates)).toISOString(),
        to: new Date(Math.max(...dates)).toISOString()
      };
    }

    return report;
  }
};

/**
 * Archive & Folder System
 */
export const ArchiveSystem = {
  /**
   * Archive a document
   */
  archive: (document: Record<string, any>, reason: string = ''): ArchiveDocument => {
    return {
      ...document,
      status: 'archived',
      archivedAt: new Date().toISOString(),
      archivedReason: reason,
      isArchived: true
    };
  },

  /**
   * Unarchive a document
   */
  unarchive: (document: Record<string, any>): ArchiveDocument => {
    return {
      ...document,
      status: 'active',
      archivedAt: null,
      archivedReason: null,
      isArchived: false
    };
  },

  /**
   * Create folder
   */
  createFolder: (name: string, parentId: string | null = null): Folder => {
    return {
      id: `folder-${Date.now()}`,
      name,
      parentId,
      createdAt: new Date().toISOString(),
      children: [],
      itemCount: 0,
      type: 'folder'
    };
  },

  /**
   * Move document to folder
   */
  moveToFolder: (document: Record<string, any>, folderId: string): DocumentWithFolder => {
    return {
      ...document,
      folderId,
      movedAt: new Date().toISOString()
    };
  },

  /**
   * Build folder tree
   */
  buildFolderTree: (folders: Folder[] = [], documents: any[] = []): FolderTree => {
    const docsByFolder: Record<string, any[]> = {};

    documents.forEach(doc => {
      const folderId = doc.folderId || 'root';
      if (!docsByFolder[folderId]) docsByFolder[folderId] = [];
      docsByFolder[folderId].push(doc);
    });

    const buildNode = (folderId: string): any => {
      const folder = folders.find(f => f.id === folderId);
      return {
        ...folder,
        documents: docsByFolder[folderId] || [],
        children: folders
          .filter(f => f.parentId === folderId)
          .map(f => buildNode(f.id))
      };
    };

    return {
      documents: docsByFolder.root || [],
      folders: folders
        .filter(f => !f.parentId)
        .map(f => buildNode(f.id))
    };
  }
};

/**
 * Enhanced Reporting System
 */
export const ReportingSystem = {
  /**
   * Generate compliance report
   */
  generateComplianceReport: (documents: Record<string, any[]> = {}): ComplianceReport => {
    const report: ComplianceReport = {
      totalDocuments: 0,
      byStatus: {},
      expiringSoon: [],
      expired: [],
      pending: [],
      generatedAt: new Date().toISOString()
    };

    const allDocs = Object.values(documents).flat();
    report.totalDocuments = allDocs.length;

    allDocs.forEach(doc => {
      report.byStatus[doc.status] = (report.byStatus[doc.status] || 0) + 1;

      if (doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          report.expired.push({
            id: doc.id,
            name: doc.name || 'Unknown',
            expiryDate: doc.expiry_date,
            daysExpired: Math.abs(daysUntilExpiry)
          });
        } else if (daysUntilExpiry <= 30) {
          report.expiringSoon.push({
            id: doc.id,
            name: doc.name || 'Unknown',
            expiryDate: doc.expiry_date,
            daysRemaining: daysUntilExpiry
          });
        }
      }

      if (doc.status === 'pending_review' || doc.status === 'awaiting_admin_review') {
        report.pending.push(doc);
      }
    });

    return report;
  },

  /**
   * Generate activity report
   */
  generateActivityReport: (auditLogs: AuditLog[] = []): ActivityReport => {
    const report: ActivityReport = {
      period: {},
      activitiesByDay: {},
      topUsers: [],
      topActions: [],
      generatedAt: new Date().toISOString()
    };

    if (auditLogs.length === 0) return report;

    const dates = auditLogs.map(log => new Date(log.timestamp).getTime());
    report.period = {
      from: new Date(Math.min(...dates)).toISOString(),
      to: new Date(Math.max(...dates)).toISOString()
    };

    auditLogs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      report.activitiesByDay[date] = (report.activitiesByDay[date] || 0) + 1;
    });

    const userCount: Record<string, number> = {};
    auditLogs.forEach(log => {
      if (log.userId) {
        userCount[log.userId] = (userCount[log.userId] || 0) + 1;
      }
    });
    report.topUsers = Object.entries(userCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({ userId, count }));

    const actionCount: Record<string, number> = {};
    auditLogs.forEach(log => {
      actionCount[log.action] = (actionCount[log.action] || 0) + 1;
    });
    report.topActions = Object.entries(actionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return report;
  }
};

export default {
  DocumentVersioning,
  AuditTrail,
  ArchiveSystem,
  ReportingSystem
};
