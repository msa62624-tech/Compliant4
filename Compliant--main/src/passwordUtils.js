/**
 * Password and User Management Utilities
 * Centralized functions for user creation and password management
 */

/**
 * Generate a secure random password
 * Format: Capital letter + lowercase + numbers + special char + random string
 * Example: Insure7k4m2p!
 */
export function generateSecurePassword() {
  const numbers = '0123456789';
  const special = '!@#$%';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  
  // Generate cryptographically secure random characters using rejection sampling
  // to avoid bias from modulo operation
  const getRandomChar = (charset) => {
    const charsetSize = charset.length;
    const maxValid = Math.floor(256 / charsetSize) * charsetSize;
    let randomByte;
    do {
      const arr = new Uint8Array(1);
      crypto.getRandomValues(arr);
      randomByte = arr[0];
    } while (randomByte >= maxValid);
    return charset[randomByte % charsetSize];
  };
  
  // Generate 8 random lowercase characters
  let randomChars = '';
  for (let i = 0; i < 8; i++) {
    randomChars += getRandomChar(lowercase);
  }
  
  // Ensure at least one of each character type
  const password = 
    'Insure' + // Prefix for branding
    getRandomChar(numbers) +
    randomChars +
    getRandomChar(special);
  
  return password;
}

/**
 * Get username from email (username is always the email)
 */
export function getUsernameFromEmail(email) {
  return email;
}

/**
 * Create user credentials object
 * @param {string} email - User's email address (will be username)
 * @param {string} name - User's full name
 * @param {string} role - User role (gc, broker, subcontractor, admin, admin_assistant)
 * @param {object} additionalFields - Additional fields like gc_id, subcontractor_id, assigned_gc_ids
 */
export function createUserCredentials(email, name, role, additionalFields = {}) {
  const username = getUsernameFromEmail(email);
  const password = generateSecurePassword();
  
  return {
    username,
    email,
    password,
    name,
    role,
    must_change_password: false, // Password change is optional, not mandatory
    created_at: new Date().toISOString(),
    ...additionalFields
  };
}

/**
 * Format login credentials for email
 */
export function formatLoginCredentialsForEmail(email, password, portalUrl) {
  return `🔐 YOUR LOGIN CREDENTIALS:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Portal URL: ${portalUrl}
Username: ${email}
Temporary Password: ${password}
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SECURITY TIP: For your account security, we recommend changing your password after your first login. You can do this anytime from your account settings.`;
}

/**
 * Password validation rules
 * Enhanced security requirements: 12 character minimum
 */
export function validatePassword(password) {
  const minLength = 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecial) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
