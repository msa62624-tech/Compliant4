interface AdminEmailsResponse {
  emails: string[];
}

/**
 * Fetch admin emails from backend API
 * @param baseUrl - Base URL of the API
 * @returns Array of admin email addresses
 */
export async function fetchAdminEmails(baseUrl: string): Promise<string[]> {
  const defaultEmails: string[] = ['admin@insuretrack.com'];
  
  try {
    const apiUrl = baseUrl.replace(':5175', ':3001').replace(':5176', ':3001');
    const response = await fetch(`${apiUrl}/public/admin-emails`);
    
    if (response.ok) {
      const data: AdminEmailsResponse = await response.json();
      return data.emails || defaultEmails;
    }
    
    return defaultEmails;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Could not fetch admin emails, using default:', errorMessage);
    return defaultEmails;
  }
}
