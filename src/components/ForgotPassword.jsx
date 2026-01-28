import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { getBackendBaseUrl } from '@/urlConfig';
import { validatePassword } from '@/utils';

/**
 * ForgotPassword Component
 * Multi-step password reset flow for GC, Broker, and Subcontractor portals
 */
export default function ForgotPassword({ onBackToLogin, portalType = 'gc' }) {
  const [step, setStep] = useState('email'); // 'email', 'token', 'reset', 'success'
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [_message, setMessage] = useState(null);

  const requestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const backendBase = getBackendBaseUrl();
      const endpoint = portalType === 'gc' ? '/public/gc-forgot-password' :
                      portalType === 'broker' ? '/public/broker-forgot-password' :
                      '/public/subcontractor-forgot-password';

      const response = await fetch(`${backendBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }

      setStep('token');
    } catch (err) {
      setError(err.message || 'Failed to request reset');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!token) {
        throw new Error('Reset token is required');
      }
      if (!newPassword || !confirmPassword) {
        throw new Error('Both passwords are required');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      const backendBase = getBackendBaseUrl();
      const endpoint = portalType === 'gc' ? '/public/gc-reset-password' :
                      portalType === 'broker' ? '/public/broker-reset-password' :
                      '/public/subcontractor-reset-password';

      const response = await fetch(`${backendBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.toLowerCase(),
          token,
          newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setMessage('Password reset successfully!');
      setStep('success');
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request Reset
  if (step === 'email') {
    return (
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b">
            <CardTitle className="text-2xl text-slate-900">Reset Password</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Enter your email to receive a reset token</p>
          </CardHeader>
          <CardContent className="p-8">
            {error && (
              <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={requestReset} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 text-base border-slate-300"
                  disabled={loading}
                  placeholder="your@email.com"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Token'}
              </Button>
            </form>

            <button
              onClick={onBackToLogin}
              className="w-full mt-6 flex items-center justify-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Enter Token & New Password
  if (step === 'token') {
    return (
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b">
            <CardTitle className="text-2xl text-slate-900">Reset Password</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Enter the token from your email and set a new password</p>
          </CardHeader>
          <CardContent className="p-8">
            {error && (
              <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={resetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reset Token</label>
                <Input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="h-12 text-base border-slate-300 font-mono"
                  disabled={loading}
                  placeholder="Paste token from email"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="h-12 text-base border-slate-300"
                  disabled={loading}
                  placeholder="New password (min 8 chars)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="h-12 text-base border-slate-300"
                  disabled={loading}
                  placeholder="Confirm password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold"
                disabled={loading}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>

            <button
              onClick={() => {
                setStep('email');
                setError(null);
                setToken('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="w-full mt-6 flex items-center justify-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Email Entry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Success
  if (step === 'success') {
    return (
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="text-2xl text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Password Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-6">Your password has been reset successfully!</p>
            <Button
              onClick={onBackToLogin}
              className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
