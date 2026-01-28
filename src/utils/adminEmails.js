/**
 * Fetch admin emails from backend API
 * @param {string} baseUrl - Base URL of the API
 * @returns {Promise<string[]>} - Array of admin email addresses
 */
export async function fetchAdminEmails(baseUrl) {
  const defaultEmails = ['admin@insuretrack.com'];
  
  try {
    const apiUrl = baseUrl.replace(':5175', ':3001').replace(':5176', ':3001');
    const response = await fetch(`${apiUrl}/public/admin-emails`);
    
    if (response.ok) {
      const data = await response.json();
      return data.emails || defaultEmails;
    }
  } catch (error) {
    console.warn('Could not fetch admin emails, using default:', error.message);
  }
  
  return defaultEmails;
}
