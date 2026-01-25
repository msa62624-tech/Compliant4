import { useState } from 'react';
import { compliant } from "@/api/compliantClient";
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Building2 } from 'lucide-react';
import ForgotPassword from '@/components/ForgotPassword';

export default function SubcontractorLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Validate email format
      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Call backend contractor login endpoint for proper bcrypt verification
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/public/contractor-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Login failed');
      }

      const { contractor } = await response.json();

      if (!contractor) {
        throw new Error('Email not found. Please check and try again.');
      }

      // Store subcontractor session
      sessionStorage.setItem('subPublicSession', 'true');
      sessionStorage.setItem('subPortalId', contractor.id);
      sessionStorage.setItem('subPublicSessionInitialized', 'true');
      sessionStorage.setItem('subAuthenticated', 'true');

      onLogin && onLogin(contractor.id);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 via-rose-600 to-orange-700 p-4">
        <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} portalType="sub" />
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
          <p className="text-red-100 text-lg">Subcontractor Portal</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b">
            <CardTitle className="text-2xl text-slate-900">Subcontractor Login</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Sign in to your insurance portal</p>
          </CardHeader>
          <CardContent className="p-8">
            {error && (
              <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 text-base border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  disabled={loading}
                  placeholder="your@company.com"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-12 text-base border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  disabled={loading}
                  placeholder="Enter your password"
                />
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

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-600">
              <p>No account yet?</p>
              <p className="mt-2 text-slate-500">You&apos;ll receive a login link when added to a project by your General Contractor.</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-red-100 text-sm">
          <p>Need help? Contact your General Contractor or insurance consultant.</p>
        </div>
      </div>
    </div>
  );
}
