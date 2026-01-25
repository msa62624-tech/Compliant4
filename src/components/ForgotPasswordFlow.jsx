import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordFlow({ 
  portalType = 'gc', // 'gc', 'broker', 'subcontractor'
  onBackToLogin,
  backendBase = ''
}) {
  const [step, setStep] = useState('email'); // 'email', 'success'
  const [email, setEmail] = useState('');
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

      // Use unified auth endpoint to request a password reset link
      const response = await fetch(`${backendBase}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, portalType })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setMessage('Check your email for the password reset link (valid for 1 hour).');
      setStep('success');
    } catch (err) {
      setError(err.message || 'Request failed');
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

  // No token entry step — users reset via link from email

  // Step 2: Success
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle>Reset Link Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-6">
              {message || 'Check your email for the password reset link. Use the link within 1 hour to set a new password.'}
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
