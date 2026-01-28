/**
 * Password and User Management Utilities
 * Centralized functions for user creation and password management
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UserCredentials {
  username: string;
  email: string;
  password: string;
  name: string;
  role: string;
  must_change_password: boolean;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Generate a secure random password
 * Format: Capital letter + lowercase + numbers + special char + random string
 * Example: Insure7k4m2p!
 */
export function generateSecurePassword(): string {
  const numbers = '0123456789';
  const special = '!@#$%';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  
  // Generate cryptographically secure random characters using rejection sampling
  // to avoid bias from modulo operation
  const getRandomChar = (charset: string): string => {
    const charsetSize = charset.length;
    const maxValid = Math.floor(256 / charsetSize) * charsetSize;
    let randomByte: number;
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
export function getUsernameFromEmail(email: string): string {
  return email;
}

/**
 * Create user credentials object
 * @param email - User's email address (will be username)
 * @param name - User's full name
 * @param role - User role (gc, broker, subcontractor, admin, admin_assistant)
 * @param additionalFields - Additional fields like gc_id, subcontractor_id, assigned_gc_ids
 */
export function createUserCredentials(
  email: string, 
  name: string, 
  role: string, 
  additionalFields: Record<string, unknown> = {}
): UserCredentials {
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
export function formatLoginCredentialsForEmail(
  email: string, 
  password: string, 
  portalUrl: string, 
  dashboardUrl: string = portalUrl
): string {
  return `🔐 YOUR LOGIN CREDENTIALS:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Portal URL: ${dashboardUrl}
Username: ${email}
Temporary Password: ${password}
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SECURITY TIP: For your account security, we recommend changing your password after your first login. You can do this anytime from your account settings.`;
}

/**
 * Password validation rules
 * Enhanced security requirements: 12 character minimum
 */
export function validatePassword(password: string): PasswordValidationResult {
  const minLength = 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password);
  
  const errors: string[] = [];
  
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
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
