/**
 * Generate a secure random token using Web Crypto API
 * @param bytes - Number of bytes to generate (default: 24)
 * @returns Hexadecimal string representation of the token
 */
export function generateSecureToken(bytes: number = 24): string {
  const tokenBytes = new Uint8Array(bytes);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
