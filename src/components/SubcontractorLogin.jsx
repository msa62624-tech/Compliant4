import { useState } from 'react';
import { compliant } from "@/api/compliantClient";
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Building2 } from 'lucide-react';

export default function SubcontractorLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      // Find subcontractor by email
      const contractors = await compliant.entities.Contractor.list();
      const subcontractor = contractors.find(
        c => c.email === email && c.contractor_type === 'subcontractor'
      );

      if (!subcontractor) {
        throw new Error('Email not found. Please check and try again.');
      }

      // For now, simple password validation (in production, hash and compare)
      // We'll store a basic password on the contractor record
      if (subcontractor.password !== password) {
        throw new Error('Incorrect password');
      }

      // Store subcontractor session
      sessionStorage.setItem('subPublicSession', 'true');
      sessionStorage.setItem('subPortalId', subcontractor.id);
      sessionStorage.setItem('subPublicSessionInitialized', 'true');

      onLogin && onLogin(subcontractor.id);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
