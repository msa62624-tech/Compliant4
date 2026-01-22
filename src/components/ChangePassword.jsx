import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { validatePassword } from '@/passwordUtils';

/**
 * ChangePassword Component
 * Allows all users (admin, GC, broker, subcontractor) to change their password
 * 
 * @param {string} userId - Current user ID
 * @param {string} userEmail - Current user email
 * @param {function} onPasswordChanged - Callback after successful password change
 */
export default function ChangePassword({ userId, userEmail, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordValidation = validatePassword(newPassword);

  const handleChangePassword = async () => {
    setError('');
    setSuccess(false);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('. '));
      return;
    }

    setIsChanging(true);

    try {
      // Call API to change password
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001')}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionStorage.getItem('token') ? `Bearer ${sessionStorage.getItem('token')}` : ''
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          userId,
          userEmail
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      if (onPasswordChanged) {
        onPasswordChanged();
      }

      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Change Password
        </CardTitle>
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
            <AlertDescription>Password changed successfully!</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
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
          onClick={handleChangePassword}
          disabled={isChanging || !passwordValidation.isValid || newPassword !== confirmPassword}
          className="w-full"
        >
          {isChanging ? 'Changing Password...' : 'Change Password'}
        </Button>
      </CardContent>
    </Card>
  );
}
