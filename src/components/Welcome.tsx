import React from 'react';

interface WelcomeProps {
  name: string;
  role?: 'admin' | 'broker' | 'general-contractor';
}

/**
 * Example TypeScript React component
 * This demonstrates that .tsx files are fully supported
 */
export const Welcome: React.FC<WelcomeProps> = ({ name, role = 'broker' }) => {
  return (
    <div className="welcome-message">
      <h2>Welcome, {name}!</h2>
      <p>You are logged in as: {role}</p>
    </div>
  );
};

export default Welcome;
