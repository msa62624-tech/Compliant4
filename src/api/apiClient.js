/**
 * Direct REST API Client - replaces legacy client with native fetch calls
 * Uses the Express backend endpoints directly
 */

import * as auth from '../auth.js';

// Use centralized auth module for consistent token management
export const getAuthHeader = () => auth.getAuthHeader();

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase;
  
  const { protocol, host, origin } = window.location;
  
  // Codespaces URL patterns:
  // Pattern 1: something-5175.app.github.dev (with port in subdomain)
  const withPortMatch = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
  if (withPortMatch) {
    return `${protocol}//${withPortMatch[1]}-3001${withPortMatch[3]}`;
  }
  
  // Pattern 2: something.github.dev (without port - default Codespaces format)
  // Only match if it's .github.dev but NOT .app.github.dev (already handled above)
  if (host.endsWith('.github.dev') && !host.endsWith('.app.github.dev')) {
    // Replace .github.dev with -3001.app.github.dev (only at the end)
    return `${protocol}//${host.replace(/\.github\.dev$/, '-3001.app.github.dev')}`;
  }
  
  // Fallback for localhost with port
  if (origin.includes(':5173')) return origin.replace(':5173', ':3001');
  if (origin.includes(':5175')) return origin.replace(':5175', ':3001');
  if (origin.includes(':5176')) return origin.replace(':5176', ':3001');
  
  // Default fallback
  return 'http://localhost:3001';
};

// Generic fetch wrapper
const apiFetch = async (endpoint, options = {}) => {
  const url = `${getApiBase()}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers
    },
    credentials: 'include',
    ...options
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
};

// Entity operations
const createEntityAPI = (entityName) => ({
  list: (sortBy) => {
    const query = sortBy ? `?sort=${sortBy}` : '';
    return apiFetch(`/entities/${entityName}${query}`);
  },

  filter: (conditions) => {
    const queryParams = new URLSearchParams();
    Object.entries(conditions).forEach(([key, value]) => {
      queryParams.append(key, value);
    });
    return apiFetch(`/entities/${entityName}/query?${queryParams}`);
  },

  read: (id) => apiFetch(`/entities/${entityName}/${id}`),

  create: (data) => apiFetch(`/entities/${entityName}`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => apiFetch(`/entities/${entityName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  delete: (id) => apiFetch(`/entities/${entityName}/${id}`, {
    method: 'DELETE'
  })
});

// Core integrations
const coreIntegrations = {
  // Upload file
  UploadFile: async ({ file }) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${getApiBase()}/integrations/upload-file`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return response.json();
  },

  // Extract data from uploaded file (AI)
  ExtractDataFromUploadedFile: async ({ file_url, json_schema }) => {
    return apiFetch('/integrations/extract-data', {
      method: 'POST',
      body: JSON.stringify({ file_url, json_schema })
    });
  },

  // Parse program PDF from base64 (matches backend /integrations/parse-program-pdf)
  ParseProgramPDF: async ({ pdf_base64, pdf_name, pdf_type }) => {
    return apiFetch('/integrations/parse-program-pdf', {
      method: 'POST',
      body: JSON.stringify({ pdf_base64, pdf_name, pdf_type })
    });
  }
};

// Public integrations (no auth)
const publicIntegrations = {
  BrokerSignCOI: async ({ token }) => {
    const url = `${getApiBase()}/public/broker-sign-coi?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BrokerSignCOI failed (${res.status}): ${text}`);
    }
    return res.json();
  }
  ,
  ListPendingCOIs: async () => {
    const url = `${getApiBase()}/public/pending-cois`;
    const res = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ListPendingCOIs failed (${res.status}): ${text}`);
    }
    return res.json();
  }
};

// Admin actions (auth required)
const adminIntegrations = {
  GenerateCOI: async ({ coi_id }) => {
    return apiFetch('/admin/generate-coi', {
      method: 'POST',
      body: JSON.stringify({ coi_id })
    });
  },
  SignCOI: async ({ coi_id, signature_url }) => {
    return apiFetch('/admin/sign-coi', {
      method: 'POST',
      body: JSON.stringify({ coi_id, signature_url })
    });
  }
};

// Send email
const sendEmail = async (payload) => {
  return apiFetch('/integrations/send-email', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

// Analyze policy
const _analyzePolicy = async ({ coi_id, policy_documents }) => {
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
  login: async (usernameOrObj, password) => {
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
    get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
    post: (endpoint, data) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) })
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
