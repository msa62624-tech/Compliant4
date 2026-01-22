import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Building2, Mail, Shield, Key, LogOut } from 'lucide-react';
import ChangePassword from '@/components/ChangePassword.jsx';

/**
 * UserProfile Component
 * Displays user information and provides access to password change and logout
 * 
 * @param {object} user - User object with id, name, email, role
 * @param {string} companyName - Optional company name
 * @param {string} companyId - Optional company ID
 */
export default function UserProfile({ user, companyName, companyId: _companyId }) {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    const role = user?.role;
    
    // Clear authentication based on role
    if (role === 'broker') {
      // Clear broker session
      sessionStorage.removeItem('brokerAuthenticated');
      sessionStorage.removeItem('brokerPortalEmail');
      sessionStorage.removeItem('brokerPortalName');
      sessionStorage.removeItem('brokerPublicSession');
      // Redirect to broker login
      window.location.href = '/broker-login';
    } else if (role === 'subcontractor') {
      // Clear subcontractor session
      sessionStorage.removeItem('subPublicSession');
      sessionStorage.removeItem('subPublicSessionInitialized');
      sessionStorage.removeItem('subPortalId');
      // Redirect to subcontractor login or home
      window.location.href = '/subcontractor-login';
    } else if (role === 'gc') {
      // Clear GC session
      sessionStorage.removeItem('gcAuthenticated');
      sessionStorage.removeItem('gcPublicSession');
      sessionStorage.removeItem('gcPortalId');
      // Redirect to GC login or home
      window.location.href = '/gc-login';
    } else {
      // For admin and other authenticated users, clear token and redirect to login
      try {
        localStorage.removeItem('insuretrack_token');
        localStorage.removeItem('insuretrack_refresh_token');
      } catch (e) {
        // Ignore storage errors
      }
      window.location.href = '/';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-red-600 text-white';
      case 'gc':
        return 'bg-red-600 text-white';
      case 'broker':
        return 'bg-purple-600 text-white';
      case 'subcontractor':
        return 'bg-green-600 text-white';
      case 'admin_assistant':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'gc':
        return 'General Contractor';
      case 'broker':
        return 'Insurance Broker';
      case 'subcontractor':
        return 'Subcontractor';
      case 'admin_assistant':
        return 'Admin Assistant';
      default:
        return role || 'User';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 hover:bg-slate-100"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-indigo-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <span className="hidden md:inline font-medium">{user?.name || 'Profile'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </DialogTitle>
        </DialogHeader>

        {!showPasswordChange ? (
          <div className="space-y-4">
            {/* User Avatar */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-indigo-600 flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <User className="w-5 h-5 text-slate-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium">Name</p>
                  <p className="text-sm font-semibold text-slate-900">{user?.name || 'N/A'}</p>
                </div>
              </div>

              {companyName && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-slate-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 font-medium">Company</p>
                    <p className="text-sm font-semibold text-slate-900">{companyName}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium">Email / Username</p>
                  <p className="text-sm font-semibold text-slate-900">{user?.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-slate-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium">Role</p>
                  <Badge className={getRoleBadgeColor(user?.role)}>
                    {getRoleLabel(user?.role)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t space-y-2">
              <Button
                onClick={() => setShowPasswordChange(true)}
                className="w-full flex items-center justify-center gap-2"
                variant="outline"
              >
                <Key className="w-4 h-4" />
                Change Password
              </Button>
              
              {/* Show logout button for all roles */}
              <Button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => setShowPasswordChange(false)}
              className="mb-2"
            >
              ← Back to Profile
            </Button>
            <ChangePassword
              userId={user?.id}
              userEmail={user?.email}
              onPasswordChanged={() => {
                setShowPasswordChange(false);
                setTimeout(() => {
                  setIsOpen(false);
                }, 2000);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
