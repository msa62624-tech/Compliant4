// Example TypeScript type definitions for the project
// This file demonstrates that TypeScript is now supported

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'broker' | 'general-contractor';
  name?: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  expiryDate: Date;
  status: 'active' | 'expired' | 'pending';
  coverageAmount: number;
}

export interface Notification {
  id: string;
  type: 'email' | 'sms' | 'push';
  recipientId: string;
  message: string;
  sentAt?: Date;
}

export type NotificationStatus = 'pending' | 'sent' | 'failed';

// Example utility function with TypeScript types
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Example async function with types
export const fetchUser = async (userId: string): Promise<User | null> => {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};
