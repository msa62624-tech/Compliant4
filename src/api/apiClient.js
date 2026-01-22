/**
 * Direct REST API Client - replaces legacy client with native fetch calls
 * Uses the Express backend endpoints directly
 */

export const getAuthHeader = () => {
  // Check both storages for backward compatibility
  const token = localStorage.getItem('insuretrack_token') || sessionStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase;
  const origin = window.location.origin;
  // Codespaces domains encode port in subdomain: -5175.app.github.dev
  if (origin.includes('.app.github.dev')) {
    return origin
      .replace('-5173', '-3001')
      .replace('-5175', '-3001');
  }
  return origin.replace(':5173', ':3001').replace(':5175', ':3001');
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

  // Parse program PDF
  ParseProgramPDF: async ({ file_url }) => {
    return apiFetch('/integrations/parse-program', {
      method: 'POST',
      body: JSON.stringify({ file_url })
    });
  }
};

// Public integrations (no auth)
const publicIntegrations = {
  ProgramReview: async ({ file_url, requirements }) => {
    const url = `${getApiBase()}/public/program-review`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_url, requirements }),
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ProgramReview failed (${res.status}): ${text}`);
    }
    return res.json();
  }
  ,
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

// Authentication module
const auth = {
  login: async (username, password) => {
    const response = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem('insuretrack_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('insuretrack_refresh_token', data.refresh_token);
      }
      // Notify listeners (e.g., App) when auth state changes
      try { window.dispatchEvent(new Event('auth-changed')); } catch (e) {}
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem('insuretrack_token');
    localStorage.removeItem('insuretrack_refresh_token');
    sessionStorage.removeItem('token');
    try { window.dispatchEvent(new Event('auth-changed')); } catch (e) {}
  },

  me: async () => {
    return apiFetch('/auth/me');
  },

  isAuthenticated: () => {
    return !!(localStorage.getItem('insuretrack_token') || sessionStorage.getItem('token'));
  }
};

// API Client object structure (mimics compliant client)
export const apiClient = {
  auth,
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
    Portal: createEntityAPI('Portal')
  },
  integrations: {
    Core: coreIntegrations,
    Public: publicIntegrations,
    Admin: adminIntegrations
  },
  sendEmail
};

export default apiClient;
