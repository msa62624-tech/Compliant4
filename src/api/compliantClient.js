/**
 * INsuretrack REST API Client (Compliant)
 * 
 * This is the custom REST API client for the Compliant insurance tracking system.
 * 
 * This file implements a custom REST API client that connects to our
 * Express.js backend (backend/server.js). All functionality is self-contained
 * within this application.
 * 
 * Features:
 * - Entity CRUD operations (list, filter, read, update, create, delete)
 * - Authentication (JWT with token refresh)
 * - Integration methods (email, file upload, LLM, Adobe Sign)
 * - Automatic retry logic with exponential backoff
 * 
 * Configuration:
 * - Backend URL: Set via VITE_API_BASE_URL environment variable (REQUIRED)
 * - Auto-detection: Codespaces and localhost URLs are automatically detected
 */

import { getAuthHeader, clearToken, refreshAccessToken } from '../auth.js';

const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : null;

const computedCodespacesUrl = (() => {
  if (typeof window === 'undefined') return null;
  const { protocol, host } = window.location;
  // Codespaces host example: something-5175.app.github.dev → switch to -3001
  // Match pattern: (prefix)-(port).app.github.dev and replace port with 3001
  const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
  if (m) {
    return `${protocol}//${m[1]}-3001${m[3]}`;
  }
  // Fallback: replace :5175 or :5176 with :3001 if present (for localhost-style URLs)
  const { origin } = window.location;
  if (origin.includes(':5175')) return origin.replace(':5175', ':3001');
  if (origin.includes(':5176')) return origin.replace(':5176', ':3001');
  return null;
})();

const baseUrl = envUrl || computedCodespacesUrl || null;

// Backend configuration error messages
const BACKEND_NOT_CONFIGURED_ERROR = 'Backend not configured. For Vercel deployments: Add VITE_API_BASE_URL environment variable in your Vercel dashboard and redeploy. For local development: Configure VITE_API_BASE_URL in .env file.';

// Log backend configuration status on startup
if (typeof window !== 'undefined') {
  if (!baseUrl) {
    console.error(`❌ CRITICAL: Backend URL not configured!
❌ All operations will fail.
❌ For Vercel/Netlify/Render: Add VITE_API_BASE_URL environment variable in your deployment dashboard and redeploy.
❌ For local development: Configure VITE_API_BASE_URL in .env file.
❌ Example: VITE_API_BASE_URL=https://your-backend.vercel.app`);
  } else {
    console.log(`✅ Backend configured: ${baseUrl}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function doFetch(url, opts = {}, { retries = 2, timeout = 15000 } = {}){
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), timeout);
    const headers = { ...(opts.headers || {}), ...getAuthHeader() };
    const finalOpts = { ...opts, headers, signal: controller.signal, credentials: 'include' };

    try {
      let attempt = 0;
      let tokenRefreshAttempted = false;
      let iterations = 0;
      const maxAttempts = retries + 1; // retries=2 means 3 total attempts (initial + 2 retries)
      const maxIterations = maxAttempts + 1; // Allow one additional iteration for token refresh (which doesn't count toward retry limit)
      
      // Loop continues while: (1) attempts haven't been exhausted AND (2) iteration bound not exceeded
      // The iteration bound provides defense-in-depth against any potential unbounded loop scenarios
      while (attempt < maxAttempts && iterations < maxIterations) {
        iterations++;
        try {
          const res = await fetch(url, finalOpts);
          clearTimeout(id);
          if (res.status === 401) {
            // unauthorized - clear token and surface a clear error
            try { clearToken(); } catch(e){}
            const e = new Error('Unauthorized');
            e.status = 401;
            throw e;
          }
          if (res.status === 403) {
            // Forbidden - might be expired token, try to refresh once
            if (!tokenRefreshAttempted) {
              // Check if we have attempts left before refreshing
              if (attempt >= maxAttempts - 1) {
                // Not enough attempts left to refresh and retry
                const text = await res.text().catch(()=> '');
                const err = new Error(text || `HTTP ${res.status}`);
                err.status = res.status;
                throw err;
              }
              try {
                await refreshAccessToken();
                tokenRefreshAttempted = true;
                // Update headers with new token and retry
                const newHeaders = { ...(opts.headers || {}), ...getAuthHeader() };
                finalOpts.headers = newHeaders;
                continue; // Retry with new token without counting toward attempt limit
              } catch (err) {
                console.error('Token refresh failed:', err);
                try { clearToken(); } catch(e){}
                const e = new Error('Unauthorized');
                e.status = 401;
                throw e;
              }
            }
            // If we already tried refresh, it's a real permission error
            const text = await res.text().catch(()=> '');
            const err = new Error(text || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
          }
          if (!res.ok) {
            const text = await res.text().catch(()=> '');
            const err = new Error(text || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
          }

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) return await res.json();
          return await res.text();
        } catch (err) {
          attempt++;
          // If we've exhausted all attempts, throw the error
          if (attempt >= maxAttempts) {
            if (err.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            throw err;
          }
          // exponential backoff before retry
          await sleep(200 * Math.pow(2, attempt));
        }
      }
      // This should never be reached, but throw error as safeguard
      throw new Error('Maximum retry attempts exceeded');
    } finally {
      clearTimeout(id);
    }
  }

  function makeEntityAdapter(entityName) {
    const basePath = baseUrl ? `${baseUrl}/entities/${entityName}` : null;

    return {
      list: async (sort) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const url = new URL(basePath);
        if (sort) url.searchParams.set('sort', sort);
        const result = await doFetch(url.toString(), { method: 'GET' }, { retries: 2 });
        return result;
      },

      filter: async (params) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        return await doFetch(`${basePath}/query`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(params || {}) }, { retries: 1 });
      },

      read: async (id) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const url = new URL(basePath);
        url.searchParams.set('id', id);
        try {
          return await doFetch(url.toString(), { method: 'GET' }, { retries: 1 });
        } catch (err) {
          // Fallback for backends that only support query POST
          if (err?.status === 404) {
            const filtered = await doFetch(`${basePath}/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
            }, { retries: 0 });
            if (Array.isArray(filtered) && filtered.length > 0) return filtered[0];
          }
          throw err;
        }
      },

      update: async (id, data) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        return await doFetch(`${basePath}/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }, { retries: 0 });
      },

      create: async (data) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        return await doFetch(basePath, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }, { retries: 0 });
      },

      delete: async (id) => {
        if (!basePath) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        return await doFetch(`${basePath}/${id}`, { method: 'DELETE' }, { retries: 0 });
      }
    };
  }
const shim = {
  entities: new Proxy({}, {
    get(target, name) {
      return makeEntityAdapter(name);
    }
  }),

  auth: {
    me: async () => {
      if (!baseUrl) {
        console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
        throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
      }
      const headers = { ...getAuthHeader() };
      const res = await fetch(`${baseUrl}/auth/me`, { credentials: 'include', headers });
      if (res.status === 401) {
        try { clearToken(); } catch (e) {}
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch auth.me');
      return await res.json();
    }
  },

  integrations: {
    Core: {
      InvokeLLM: async (payload) => {
        if (!baseUrl) {
          console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const res = await fetch(`${baseUrl}/integrations/invoke-llm`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload || {})
        });
        if (!res.ok) throw new Error('InvokeLLM failed');
        return await res.json();
      },

      SendEmail: async (payload) => {
        if (!baseUrl) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const res = await fetch(`${baseUrl}/integrations/send-email`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload || {})
        });
        if (!res.ok) throw new Error('SendEmail failed');
        return await res.json();
      },

      // Helper function to extract error message from response
      _extractErrorMessage: async (res, defaultMessage) => {
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json();
            return errorData.error || errorData.message || defaultMessage;
          } else {
            const errorText = await res.text();
            return errorText || defaultMessage;
          }
        } catch (_parseError) {
          // Keep default message if parsing fails
          return defaultMessage;
        }
      },

      // Helper function for file upload
      _uploadFileHelper: async (endpoint, payload, { timeout = 60000, retries = 1 } = {}) => {
        if (!baseUrl) {
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        
        // Determine the body to send
        let body;
        if (payload.file) {
          // Validate file exists and has content
          if (!payload.file || !(payload.file instanceof File)) {
            throw new Error('Invalid file: expected File object');
          }
          // Create FormData for file upload
          const formData = new FormData();
          formData.append('file', payload.file);
          body = formData;
        } else if (payload instanceof FormData) {
          // If payload is already FormData, validate it contains a file
          if (!payload.has('file')) {
            throw new Error('Invalid FormData: missing "file" field');
          }
          body = payload;
        } else {
          throw new Error('Invalid payload: expected { file: File } or FormData');
        }
        
        const headers = { ...getAuthHeader() };
        // Don't set Content-Type header - let browser set it with boundary
        
        // Implement retry logic with timeout for large file uploads
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const res = await fetch(`${baseUrl}${endpoint}`, {
              method: 'POST',
              credentials: 'include',
              headers,
              body,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Parse error response body for better error messages
            if (!res.ok) {
              const defaultMsg = `Upload to ${endpoint} failed with status ${res.status}`;
              const errorMessage = await shim.integrations.Core._extractErrorMessage(res, defaultMsg);
              throw new Error(errorMessage);
            }
            
            // Validate response is JSON
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error(`Upload to ${endpoint} returned non-JSON response`);
            }
            
            const result = await res.json();
            
            // Validate response has required file_url field
            if (!result.file_url && !result.url) {
              throw new Error(`Upload response missing file_url or url field`);
            }
            
            return result;
          } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            
            // Don't retry on validation errors or abort errors
            if (error.name === 'AbortError') {
              throw new Error(`Upload timeout after ${timeout}ms`);
            }
            if (error.message.includes('Invalid') || error.message.includes('missing')) {
              throw error;
            }
            
            // Retry on network errors with exponential backoff
            if (attempt < retries) {
              await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff: 1s, 2s, 4s, etc.
            }
          }
        }
        
        throw lastError;
      },

      UploadFile: async (payload) => {
        return await shim.integrations.Core._uploadFileHelper('/integrations/upload-file', payload);
      },

      GenerateImage: async (payload) => {
        if (!baseUrl) {
          console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const res = await fetch(`${baseUrl}/integrations/generate-image`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload || {})
        });
        if (!res.ok) throw new Error('GenerateImage failed');
        return await res.json();
      },

      ExtractDataFromUploadedFile: async (payload) => {
        if (!baseUrl) {
          console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 
          'Content-Type': 'application/json',
          ...getAuthHeader() 
        };
        const res = await fetch(`${baseUrl}/integrations/extract-file`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('ExtractDataFromUploadedFile failed');
        return await res.json();
      },

      ParseProgramPDF: async (payload) => {
        if (!baseUrl) {
          console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const res = await fetch(`${baseUrl}/integrations/parse-program-pdf`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload || {})
        });
        if (!res.ok) throw new Error('ParseProgramPDF failed');
        return await res.json();
      },

      CreateFileSignedUrl: async (payload) => {
        if (!baseUrl) {
          console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
          throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
        }
        const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const res = await fetch(`${baseUrl}/integrations/create-signed-url`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload || {})
        });
        if (!res.ok) throw new Error('CreateFileSignedUrl failed');
        return await res.json();
      },

      UploadPrivateFile: async (payload) => {
        return await shim.integrations.Core._uploadFileHelper('/integrations/upload-private-file', payload);
      }
      ,

      Adobe: {
        // Upload a transient document to Adobe (returns transientDocumentId)
        CreateTransientDocument: async (payload) => {
          if (!baseUrl) {
            console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
            throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
          }
          const headers = { ...getAuthHeader() };
          const res = await fetch(`${baseUrl}/integrations/adobe/transientDocument`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: payload
          });
          if (!res.ok) throw new Error('CreateTransientDocument failed');
          return await res.json();
        },

        // Create an agreement using a transientDocumentId
        CreateAgreement: async (payload) => {
          if (!baseUrl) {
            console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
            throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
          }
          const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
          const res = await fetch(`${baseUrl}/integrations/adobe/agreement`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify(payload || {})
          });
          if (!res.ok) throw new Error('CreateAgreement failed');
          return await res.json();
        },

        // Get a signing URL for an agreement
        GetSigningUrl: async (agreementId) => {
          if (!baseUrl) {
            console.error(BACKEND_NOT_CONFIGURED_CONSOLE_MSG);
            throw new Error(BACKEND_NOT_CONFIGURED_ERROR);
          }
          const headers = { ...getAuthHeader() };
          const res = await fetch(`${baseUrl}/integrations/adobe/agreement/${agreementId}/url`, {
            method: 'GET',
            credentials: 'include',
            headers
          });
          if (!res.ok) throw new Error('GetSigningUrl failed');
          return await res.json();
        }
      }
    }
  }
};

export const compliant = shim;
export default compliant;
