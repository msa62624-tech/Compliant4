import { AlertCircle, Search, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ErrorResponse {
  response?: {
    status?: number;
  };
  message?: string;
}

interface ErrorHandlerResult {
  message: string;
  type: 'warning' | 'error';
}

interface SortConfig {
  key?: string;
  direction?: 'asc' | 'desc';
}

interface BulkOperationResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface ApiClient {
  update: (_id: string, _updates: Record<string, any>) => Promise<any>;
  delete: (_id: string) => Promise<void>;
}

interface ExportColumn {
  label: string;
  key?: string;
  accessor?: (_item: any) => any;
}

interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

interface ErrorAlertProps {
  error: ErrorHandlerResult | null;
  onDismiss?: () => void;
}

interface SearchBarProps {
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface BulkAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'outline' | 'default' | 'destructive';
  disabled?: boolean;
}

interface BulkActionsToolbarProps {
  selectedCount?: number;
  onSelectAll?: () => void;
  onClearSelection: () => void;
  actions?: BulkAction[];
}

/**
 * Enhanced Dashboard Utilities
 * Provides search, filtering, bulk operations, and error handling
 */

export const DashboardErrorHandler = {
  handle: (error: ErrorResponse, context: string = ''): ErrorHandlerResult => {
    console.error(`Dashboard Error (${context}):`, error);
    
    if (error.response?.status === 401) {
      return { message: 'Your session has expired. Please log in again.', type: 'warning' };
    }
    if (error.response?.status === 403) {
      return { message: 'You do not have permission to perform this action.', type: 'error' };
    }
    if (error.response?.status === 404) {
      return { message: 'The requested resource was not found.', type: 'error' };
    }
    if (error.response?.status === 429) {
      return { message: 'Too many requests. Please wait a moment and try again.', type: 'warning' };
    }
    if (error.response?.status && error.response.status >= 500) {
      return { message: 'Server error. Please try again later.', type: 'error' };
    }
    if (error.message === 'Network Error') {
      return { message: 'Network connection error. Please check your internet.', type: 'error' };
    }
    
    return { 
      message: error.message || 'An unexpected error occurred. Please try again.',
      type: 'error'
    };
  }
};

export const SearchFilterUtils = {
  /**
   * Search across multiple fields
   */
  search: (items: any[] = [], query: string = '', searchFields: string[] = []): any[] => {
    if (!query.trim()) return items;
    
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      searchFields.some(field => {
        const value = field.split('.').reduce((obj: any, key) => obj?.[key], item);
        return String(value).toLowerCase().includes(lowerQuery);
      })
    );
  },

  /**
   * Filter items by multiple criteria
   */
  filter: (items: any[] = [], filters: Record<string, any> = {}): any[] => {
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        if (Array.isArray(value)) {
          return value.includes(item[key]);
        }
        return item[key] === value;
      });
    });
  },

  /**
   * Sort items with multi-column support
   */
  sort: (items: any[] = [], sortConfig: SortConfig = {}): any[] => {
    const { key, direction = 'asc' } = sortConfig;
    if (!key) return items;

    return [...items].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return direction === 'asc' ? comparison : -comparison;
    });
  },

  /**
   * Paginate items
   */
  paginate: (items: any[] = [], page: number = 1, pageSize: number = 10): any[] => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }
};

export const BulkOperationsUtils = {
  /**
   * Select/deselect items
   */
  toggleSelection: (selected: Set<string> = new Set(), id: string, isSelected: boolean): Set<string> => {
    const newSelected = new Set(selected);
    if (isSelected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    return newSelected;
  },

  /**
   * Select all items
   */
  selectAll: (items: any[] = []): Set<string> => {
    return new Set(items.map(item => item.id));
  },

  /**
   * Deselect all items
   */
  deselectAll: (): Set<string> => {
    return new Set();
  },

  /**
   * Bulk operations
   */
  bulkUpdate: async (ids: string[] = [], updates: Record<string, any> = {}, apiClient: ApiClient): Promise<BulkOperationResult[]> => {
    const results: BulkOperationResult[] = [];
    for (const id of ids) {
      try {
        const result = await apiClient.update(id, updates);
        results.push({ id, success: true, data: result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id, success: false, error: errorMessage });
      }
    }
    return results;
  },

  bulkDelete: async (ids: string[] = [], apiClient: ApiClient): Promise<BulkOperationResult[]> => {
    const results: BulkOperationResult[] = [];
    for (const id of ids) {
      try {
        await apiClient.delete(id);
        results.push({ id, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id, success: false, error: errorMessage });
      }
    }
    return results;
  }
};

export const ExportUtils = {
  /**
   * Export to CSV
   */
  toCSV: (items: any[] = [], columns: ExportColumn[] = []): string => {
    const headers = columns.map(col => col.label).join(',');
    const rows = items.map(item =>
      columns.map(col => {
        const value = col.accessor ? col.accessor(item) : item[col.key!];
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    return [headers, ...rows].join('\n');
  },

  /**
   * Export to JSON
   */
  toJSON: (items: any[] = []): string => {
    return JSON.stringify(items, null, 2);
  },

  /**
   * Download file
   */
  download: (content: string, filename: string, mimeType: string = 'text/plain'): void => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
};

export const PerformanceUtils = {
  /**
   * Virtualize large lists
   */
  getVisibleRange: (scrollTop: number = 0, itemHeight: number = 40, containerHeight: number = 400): VisibleRange => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return {
      startIndex: Math.max(0, startIndex - 1),
      endIndex: startIndex + visibleCount + 1
    };
  },

  /**
   * Debounce function calls
   */
  debounce: <T extends (..._args: any[]) => any>(func: T, delay: number = 300): ((..._args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * Memoize expensive computations
   */
  memoize: <T extends (..._args: any[]) => any>(fn: T): ((..._args: Parameters<T>) => ReturnType<T>) => {
    const cache = new Map<string, ReturnType<T>>();
    return (...args: Parameters<T>): ReturnType<T> => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  }
};

export const ReportingUtils = {
  /**
   * Generate summary statistics
   */
  generateSummary: (_items: any[] = [], metrics: Record<string, (_items: any[]) => any> = {}): Record<string, any> => {
    return {
      totalCount: _items.length,
      ...Object.entries(metrics).reduce((acc, [key, fn]) => {
        acc[key] = fn(_items);
        return acc;
      }, {} as Record<string, any>)
    };
  },

  /**
   * Group items by field
   */
  groupBy: (items: any[] = [], field: string): Record<string, any[]> => {
    return items.reduce((groups, item) => {
      const key = item[field];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }
};

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps): JSX.Element {
  if (!error) return null;

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">{error.message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search...', disabled = false }: SearchBarProps): JSX.Element {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-10"
      />
    </div>
  );
}

export function BulkActionsToolbar({ selectedCount = 0, onSelectAll: _onSelectAll, onClearSelection, actions = [] }: BulkActionsToolbarProps): JSX.Element {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-red-600" />
        <span className="text-sm font-medium text-blue-900">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
        <button
          onClick={onClearSelection}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default SearchFilterUtils;
