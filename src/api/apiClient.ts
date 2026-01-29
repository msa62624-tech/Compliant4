/**
 * Enterprise-grade REST API Client
 * 
 * Features:
 * - Automatic token refresh on 401 errors
 * - Configurable request timeouts
 * - Retry logic with exponential backoff
 * - Structured error handling
 * - Request/response logging
 * - Correlation ID tracking
 */

import * as auth from '../auth';
import logger from '../utils/logger';

// Configuration constants
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Initial retry delay
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504]; // Retryable HTTP status codes

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  correlationId?: string;
}

interface FetchResult {
  response: Response;
  base: string;
}

interface ApiError extends Error {
  status?: number;
  statusText?: string;
  correlationId?: string;
  endpoint?: string;
  isTimeout?: boolean;
}

interface EntityConditions {
  [key: string]: string | number | boolean;
}

interface UploadFilePayload {
  file: File;
}

interface ExtractDataPayload {
  file_url: string;
  json_schema: Record<string, unknown>;
}

interface ParseProgramPDFPayload {
  pdf_base64: string;
  pdf_name: string;
  pdf_type: string;
}

interface BrokerSignCOIPayload {
  token: string;
}

interface GenerateCOIPayload {
  coi_id: string;
}

interface SignCOIPayload {
  coi_id: string;
  signature_url: string;
}

interface AnalyzePolicyPayload {
  coi_id: string;
  policy_documents: string[];
}

interface EntityAPI<T = unknown> {
  list: (_sortBy?: string) => Promise<T[]>;
  filter: (_conditions: EntityConditions) => Promise<T[]>;
  read: (_id: string) => Promise<T>;
  create: (_data: Partial<T>) => Promise<T>;
  update: (_id: string, _data: Partial<T>) => Promise<T>;
  delete: (_id: string) => Promise<void>;
}

// Use centralized auth module for consistent token management
export const getAuthHeader = (): Record<string, string> => auth.getAuthHeader();

// Build the API base URLs we should attempt, ordered by priority
const getApiBaseCandidates = (): string[] => {
  // Highest priority: explicit base URL from environment
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) {
    const cleanUrl = envBase.replace(/\/$/, '');
    logger.debug('Using configured API base URL', { url: cleanUrl });
    return [cleanUrl];
  }

  // Check for cached base URL from previous successful request
  const cachedBase = typeof window !== 'undefined' ? (window as Window & { __API_BASE_CACHE__?: string }).__API_BASE_CACHE__ : null;
  const bases: string[] = [];
  if (cachedBase) {
    logger.debug('Found cached API base URL', { url: cachedBase });
    bases.push(cachedBase);
  }

  // Determine ports to try based on configuration
  const preferredPort = String(import.meta.env.VITE_API_PORT || '3001');
  const portsToTry = [preferredPort];

  // Common fallback for Codespaces when primary port is occupied
  if (!portsToTry.includes('3002')) portsToTry.push('3002');

  // Ensure 3001 is present even if env overrides a different port
  if (!portsToTry.includes('3001')) portsToTry.push('3001');

  // Build URLs based on current location
  if (typeof window === 'undefined') {
    return bases.length > 0 ? bases : ['http://localhost:3001'];
  }

  const { protocol, host, origin } = window.location;

  const deriveBaseForPort = (port: string): string => {
    // GitHub Codespaces pattern
    const withPortMatch = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
    if (withPortMatch) {
      return `${protocol}//${withPortMatch[1]}-${port}${withPortMatch[3]}`;
    }

    // GitHub Codespaces pattern (alternative)
    if (host.endsWith('.github.dev') && !host.endsWith('.app.github.dev')) {
      return `${protocol}//${host.replace(/\.github\.dev$/, `-${port}.app.github.dev`)}`;
    }

    // Local development patterns
    const localDevPorts = ['5173', '5175', '5176'];
    for (const devPort of localDevPorts) {
      if (origin.includes(`:${devPort}`)) {
        return origin.replace(/:\d+$/, `:${port}`);
      }
    }

    // Default to localhost
    return `http://localhost:${port}`;
  };

  const derivedBases = portsToTry.map(deriveBaseForPort).filter(Boolean);
  const allBases = Array.from(new Set([...bases, ...derivedBases]));
  
  logger.debug('Generated API base candidates', { candidates: allBases });
  return allBases;
};

export const getApiBase = (): string => {
  const candidates = getApiBaseCandidates();
  return candidates[0] || 'http://localhost:3001';
};

/**
 * Sleep for specified duration
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (attempt: number, baseDelay: number = RETRY_DELAY_MS): number => {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
};

/**
 * Check if error/status is retryable
 */
const isRetryable = (errorOrStatus: Error | number): boolean => {
  // Network errors are retryable
  if (errorOrStatus instanceof Error) {
    const isNetworkError = errorOrStatus instanceof TypeError || 
                          errorOrStatus.name === 'TypeError' ||
                          errorOrStatus.name === 'AbortError' ||
                          errorOrStatus.name === 'TimeoutError';
    return isNetworkError;
  }
  
  // Check if HTTP status is retryable
  if (typeof errorOrStatus === 'number') {
    return RETRY_STATUS_CODES.includes(errorOrStatus);
  }
  
  return false;
};

// Fetch wrapper that retries across candidate bases on network/CORS failures
const fetchWithFallback = async (
  buildRequest: (base: string) => Promise<Response>,
  options: { retries?: number } = {}
): Promise<FetchResult> => {
  const bases = getApiBaseCandidates();
  const maxRetries = options.retries !== undefined ? options.retries : MAX_RETRIES;
  let lastError: Error | undefined;
  let attempt = 0;

  for (const base of bases) {
    attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        const startTime = performance.now();
        const response = await buildRequest(base);
        const duration = Math.round(performance.now() - startTime);
        
        // Log successful request
        logger.debug('API request successful', {
          base,
          attempt,
          duration,
          status: response.status
        });
        
        // Cache successful base URL
        if (typeof window !== 'undefined') {
          (window as Window & { __API_BASE_CACHE__?: string }).__API_BASE_CACHE__ = base;
        }
        
        return { response, base };
      } catch (err) {
        lastError = err;
        
        // Log failed attempt
        logger.warn('API request attempt failed', {
          base,
          attempt,
          maxRetries,
          error: err instanceof Error ? err.message : 'Unknown error',
          isRetryable: isRetryable(err)
        });
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryable(err)) {
          const delay = getRetryDelay(attempt);
          logger.debug('Retrying request after delay', { delay, attempt: attempt + 1 });
          await sleep(delay);
          attempt++;
          continue;
        }
        
        // If not retryable or max retries reached, try next base
        break;
      }
    }
  }

  logger.error('All API request attempts failed', {
    totalBases: bases.length,
    maxRetriesPerBase: maxRetries,
    lastError: lastError?.message
  });
  
  throw lastError || new Error('API unreachable after all retry attempts');
};

// Generic fetch wrapper with automatic token refresh and comprehensive error handling
const apiFetch = async <T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const retries = options.retries !== undefined ? options.retries : MAX_RETRIES;
  const correlationId = options.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.debug('API request initiated', {
    endpoint,
    method: options.method || 'GET',
    correlationId
  });

  try {
    const { response, base } = await fetchWithFallback(
      async (apiBase) => {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          // Get authentication header
          const authHeader = await getAuthHeader();
          
          const fetchResponse = await fetch(`${apiBase}${endpoint}`, {
            headers: {
              'Content-Type': 'application/json',
              'X-Correlation-ID': correlationId,
              ...authHeader,
              ...options.headers
            },
            credentials: 'include',
            signal: controller.signal,
            ...options
          });
          
          clearTimeout(timeoutId);
          return fetchResponse;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      { retries }
    );

    // Handle authentication errors with automatic token refresh
    if (response.status === 401) {
      logger.info('Received 401, attempting token refresh', { endpoint, correlationId });
      
      // Try to refresh token
      const newToken = await auth.refreshAccessToken();
      
      if (newToken) {
        // Retry request with new token (without retries to avoid infinite loop)
        logger.debug('Retrying request with refreshed token', { endpoint, correlationId });
        return apiFetch(endpoint, { ...options, retries: 0 });
      } else {
        // Refresh failed, clear auth and throw
        logger.warn('Token refresh failed, clearing authentication', { endpoint, correlationId });
        auth.clearToken();
        throw new Error('Authentication failed. Please log in again.');
      }
    }

    // Handle other error status codes
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      
      logger.error('API request failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        errorMessage: errorText,
        correlationId,
        base
      });
      
      // Provide user-friendly error messages for common scenarios
      let errorMessage: string;
      switch (response.status) {
        case 400:
          errorMessage = `Invalid request: ${errorText || response.statusText}`;
          break;
        case 403:
          errorMessage = 'Access denied. You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage = `Resource not found: ${endpoint}`;
          break;
        case 409:
          errorMessage = `Conflict: ${errorText || 'The resource already exists or conflicts with existing data'}`;
          break;
        case 422:
          errorMessage = `Validation failed: ${errorText || response.statusText}`;
          break;
        case 429:
          errorMessage = 'Too many requests. Please slow down and try again later.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorMessage = 'Server error. Please try again later.';
          break;
        default:
          errorMessage = `Request failed (${response.status}): ${errorText || response.statusText}`;
      }
      
      const error = new Error(errorMessage) as ApiError;
      error.status = response.status;
      error.statusText = response.statusText;
      error.correlationId = correlationId;
      error.endpoint = endpoint;
      throw error;
    }

    // Parse and return successful response
    const data = await response.json().catch(() => ({}));
    
    logger.debug('API request completed successfully', {
      endpoint,
      status: response.status,
      correlationId
    });
    
    return data;
  } catch (error) {
    // Handle timeout errors
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      logger.error('API request timed out', {
        endpoint,
        timeout,
        correlationId
      });
      const timeoutError = new Error(`Request timed out after ${timeout}ms`) as ApiError;
      timeoutError.isTimeout = true;
      timeoutError.correlationId = correlationId;
      throw timeoutError;
    }
    
    // Re-throw with correlation ID if not already attached
    if (!(error as ApiError).correlationId) {
      (error as ApiError).correlationId = correlationId;
    }
    throw error;
  }
};

// Entity operations
const createEntityAPI = <T = unknown>(entityName: string): EntityAPI<T> => ({
  list: (sortBy?: string) => {
    const query = sortBy ? `?sort=${sortBy}` : '';
    return apiFetch<T[]>(`/entities/${entityName}${query}`);
  },

  filter: (conditions: EntityConditions) => {
    const queryParams = new URLSearchParams();
    Object.entries(conditions).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
    return apiFetch<T[]>(`/entities/${entityName}/query?${queryParams}`);
  },

  read: (id: string) => apiFetch<T>(`/entities/${entityName}/${id}`),

  create: (data: Partial<T>) => apiFetch<T>(`/entities/${entityName}`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id: string, data: Partial<T>) => apiFetch<T>(`/entities/${entityName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  delete: (id: string) => apiFetch<void>(`/entities/${entityName}/${id}`, {
    method: 'DELETE'
  })
});

// Core integrations
const coreIntegrations = {
  // Upload file
  UploadFile: async ({ file }: UploadFilePayload) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const { response } = await fetchWithFallback((apiBase) =>
      fetch(`${apiBase}/integrations/upload-file`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData,
        credentials: 'include'
      })
    );

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return response.json();
  },

  // Extract data from uploaded file (AI)
  ExtractDataFromUploadedFile: async ({ file_url, json_schema }: ExtractDataPayload) => {
    return apiFetch('/integrations/extract-data', {
      method: 'POST',
      body: JSON.stringify({ file_url, json_schema })
    });
  },

  // Parse program PDF from base64 (matches backend /integrations/parse-program-pdf)
  ParseProgramPDF: async ({ pdf_base64, pdf_name, pdf_type }: ParseProgramPDFPayload) => {
    return apiFetch('/integrations/parse-program-pdf', {
      method: 'POST',
      body: JSON.stringify({ pdf_base64, pdf_name, pdf_type })
    });
  }
};

// Public integrations (no auth)
const publicIntegrations = {
  BrokerSignCOI: async ({ token }: BrokerSignCOIPayload) => {
    const { response } = await fetchWithFallback((apiBase) =>
      fetch(`${apiBase}/public/broker-sign-coi?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BrokerSignCOI failed (${response.status}): ${text}`);
    }
    return response.json();
  }
  ,
  ListPendingCOIs: async () => {
    const { response } = await fetchWithFallback((apiBase) =>
      fetch(`${apiBase}/public/pending-cois`, { method: 'GET', credentials: 'include' })
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ListPendingCOIs failed (${response.status}): ${text}`);
    }
    return response.json();
  }
};

// Admin actions (auth required)
const adminIntegrations = {
  GenerateCOI: async ({ coi_id }: GenerateCOIPayload) => {
    return apiFetch('/admin/generate-coi', {
      method: 'POST',
      body: JSON.stringify({ coi_id })
    });
  },
  SignCOI: async ({ coi_id, signature_url }: SignCOIPayload) => {
    return apiFetch('/admin/sign-coi', {
      method: 'POST',
      body: JSON.stringify({ coi_id, signature_url })
    });
  }
};

// Send email
const sendEmail = async (payload: Record<string, unknown>) => {
  return apiFetch('/integrations/send-email', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

// Analyze policy
const _analyzePolicy = async ({ coi_id, policy_documents }: AnalyzePolicyPayload) => {
  return apiFetch('/integrations/analyze-policy', {
    method: 'POST',
    body: JSON.stringify({ coi_id, policy_documents })
  });
};

// Authentication module - delegates to centralized auth.js
const authModule = {
  // Support both calling patterns for backward compatibility:
  // - login(username, password) - legacy pattern
  // - login({ username, password }) - consistent with auth.login()
  login: async (usernameOrObj: string | { username: string; password: string }, password?: string) => {
    if (typeof usernameOrObj === 'object') {
      // Object pattern: { username, password }
      return auth.login(usernameOrObj);
    } else {
      // Legacy pattern: (username, password)
      return auth.login({ username: usernameOrObj, password });
    }
  },

  logout: () => {
    auth.clearToken();
  },

  me: async () => {
    return apiFetch('/auth/me');
  },

  isAuthenticated: () => {
    return !!auth.getToken();
  }
};

// API Client object structure (mimics compliant client)
export const apiClient = {
  auth: authModule,
  api: {
    get: <T = unknown>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
    post: <T = unknown>(endpoint: string, data: unknown) => apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) })
  },
  entities: {
    User: createEntityAPI('User'),
    Contractor: createEntityAPI('Contractor'),
    Project: createEntityAPI('Project'),
    GeneratedCOI: createEntityAPI('GeneratedCOI'),
    InsuranceProgram: createEntityAPI('InsuranceProgram'),
    SubInsuranceRequirement: createEntityAPI('SubInsuranceRequirement'),
    ProjectInsuranceRequirement: createEntityAPI('ProjectInsuranceRequirement'),
    ProjectSubcontractor: createEntityAPI('ProjectSubcontractor'),
    InsuranceDocument: createEntityAPI('InsuranceDocument'),
    BrokerUploadRequest: createEntityAPI('BrokerUploadRequest'),
    Message: createEntityAPI('Message'),
    Notification: createEntityAPI('Notification'),
    Portal: createEntityAPI('Portal'),
    Trade: createEntityAPI('Trade')
  },
  integrations: {
    Core: coreIntegrations,
    Public: publicIntegrations,
    Admin: adminIntegrations
  },
  sendEmail
};

export default apiClient;
