import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { validatePassword } from '@/passwordUtils';

/**
 * ResetPassword Component
 * Allows users to reset their password using a token from email
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const passwordValidation = validatePassword(newPassword);

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token, email]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!token || !email) {
      setError('Invalid or missing reset token');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('. '));
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001')}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            token,
            newPassword
          }),
          credentials: 'include'
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Reset Your Password
          </CardTitle>
          <CardDescription>
            Enter your new password below. Make sure it meets all the security requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Password has been reset successfully! Redirecting to login...
              </AlertDescription>
            </Alert>
          )}

          {!success && token && email && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={isResetting}
                  />
                </div>
                {newPassword && !passwordValidation.isValid && (
                  <div className="text-xs text-red-600 space-y-1">
                    {passwordValidation.errors.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                )}
                {newPassword && passwordValidation.isValid && (
                  <div className="text-xs text-green-600">✓ Password meets all requirements</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={isResetting}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <div className="text-xs text-red-600">Passwords do not match</div>
                )}
                {confirmPassword && newPassword === confirmPassword && (
                  <div className="text-xs text-green-600">✓ Passwords match</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  type="button"
                  disabled={isResetting}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPasswords ? 'Hide' : 'Show'} Passwords
                </Button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600">
                <strong>Password Requirements:</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>At least 12 characters</li>
                  <li>One uppercase letter</li>
                  <li>One lowercase letter</li>
                  <li>One number</li>
                  <li>One special character (!@#$%^&*)</li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={isResetting || !passwordValidation.isValid || newPassword !== confirmPassword}
                className="w-full"
              >
                {isResetting ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </form>
          )}

          {!token || !email ? (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
