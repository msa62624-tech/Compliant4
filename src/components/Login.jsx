import { useState } from 'react';
import auth from '@/auth.js';
import { validateLoginCredentials } from '@/utils/validation';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import ForgotPassword from '@/components/ForgotPassword';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const validateForm = () => {
    // Clear previous validation errors
    setValidationErrors({});

    // Validate using Zod schema
    const result = validateLoginCredentials({ username, password });
    
    if (!result.success) {
      const errors = {};
      result.errors.forEach(err => {
        errors[err.field] = err.message;
      });
      setValidationErrors(errors);
      return false;
    }

    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validate form before submission
    if (!validateForm()) {
      setLoading(false);
      setError('Please fix the validation errors below');
      return;
    }

    try {
      await auth.login({ username, password });
      // No need to call onLogin - auth.login triggers 'auth-changed' event
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 via-rose-600 to-orange-700 p-4">
        <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 via-rose-600 to-orange-700 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-white/10 backdrop-blur-lg rounded-2xl mb-6 hover:scale-110 transition-transform duration-300 animate-pulse">
            <Building2 className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight bg-gradient-to-r from-white via-red-50 to-white bg-clip-text text-transparent animate-gradient">compliant.team</h1>
          <p className="text-red-100 text-lg">Insurance Compliance Made Simple</p>
        </div>
        <form onSubmit={submit} className="bg-white p-10 rounded-3xl shadow-2xl">
          <h2 className="text-3xl font-bold mb-8 text-slate-900">Welcome back</h2>
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</div>}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
            <Input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className={`h-12 text-base border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 ${validationErrors.username ? 'border-red-500' : ''}`}
              disabled={loading} 
              placeholder="Enter your username"
              aria-invalid={!!validationErrors.username}
              aria-describedby={validationErrors.username ? "username-error" : undefined}
            />
            {validationErrors.username && (
              <p id="username-error" className="text-sm text-red-600 mt-1">{validationErrors.username}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
            <PasswordInput 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className={`h-12 text-base border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 ${validationErrors.password ? 'border-red-500' : ''}`}
              disabled={loading} 
              placeholder="Enter your password"
              aria-invalid={!!validationErrors.password}
              aria-describedby={validationErrors.password ? "password-error" : undefined}
            />
            {validationErrors.password && (
              <p id="password-error" className="text-sm text-red-600 mt-1">{validationErrors.password}</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Forgot password?
            </button>
          </div>
          <Button type="submit" className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
