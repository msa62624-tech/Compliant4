import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordFlow({ 
  portalType = 'gc', // 'gc', 'broker', 'subcontractor'
  onBackToLogin,
  backendBase = ''
}) {
  const [step, setStep] = useState('email'); // 'email', 'token', 'success'
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const portalNames = {
    gc: 'GC',
    broker: 'Broker',
    subcontractor: 'Subcontractor'
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const response = await fetch(`${backendBase}/public/${portalType}-forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setMessage('Check your email for the password reset link (valid for 1 hour)');
      setStep('token');
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!token || !newPassword || !confirmPassword) {
        throw new Error('All fields are required');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const response = await fetch(`${backendBase}/public/${portalType}-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          token, 
          newPassword 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setStep('success');
      setMessage(data.message || 'Password reset successfully');
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request Reset Email
  if (step === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={onBackToLogin}
                className="text-slate-600 hover:text-slate-900 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <CardTitle>Reset {portalNames[portalType]} Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                We'll send a password reset link to your email. The link expires in 1 hour.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Enter Token and New Password
  if (step === 'token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter Reset Code</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              {message && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  {message}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reset Code
                </label>
                <Input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste the reset code from your email"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <Button 
                type="button"
                variant="outline"
                onClick={onBackToLogin}
                disabled={loading}
                className="w-full"
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Success
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle>Password Reset Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-6">
              Your password has been reset successfully. You can now log in with your new password.
            </p>
            <Button 
              onClick={onBackToLogin}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
