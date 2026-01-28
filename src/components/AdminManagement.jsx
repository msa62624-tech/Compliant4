import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Trash2, Mail, Shield, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminManagement() {
  const queryClient = useQueryClient();
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch current user to verify super admin
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        return await apiClient.auth.me();
      } catch (error) {
        console.error('Failed to fetch current user:', error);
        return null;
      }
    }
  });

  // Fetch all admins
  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['all-admins'],
    queryFn: async () => {
      try {
        const users = await apiClient.entities.User.list();
        return users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'regular_admin');
      } catch (error) {
        console.error('Error fetching admins:', error);
        return [];
      }
    }
  });

  // Create admin mutation
  const createAdminMutation = useMutation({
    mutationFn: async (adminData) => {
      return await apiClient.entities.User.create({
        ...adminData,
        role: adminData.role || 'admin',
        is_active: true,
        created_date: new Date().toISOString()
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['all-admins']);
      const roleLabel = data.role === 'admin' ? 'Assistant admin' : 'Regular admin';
      setSuccess(`${roleLabel} created successfully!`);
      setNewAdmin({ name: '', email: '', password: '', role: 'admin' });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error) => {
      setError(`Failed to create admin: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  });

  // Delete admin mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId) => {
      return await apiClient.entities.User.delete(adminId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['all-admins']);
      setSuccess('Admin removed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error) => {
      setError(`Failed to remove admin: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleCreateAdmin = (e) => {
    e.preventDefault();
    setError(null);

    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      setError('All fields are required');
      return;
    }

    if (!newAdmin.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (newAdmin.password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    createAdminMutation.mutate(newAdmin);
  };

  const handleDeleteAdmin = (admin) => {
    if (admin.role === 'super_admin') {
      setError('Cannot delete super admin');
      return;
    }

    if (confirm(`Are you sure you want to remove ${admin.name}? All their assigned files will become unassigned.`)) {
      deleteAdminMutation.mutate(admin.id);
    }
  };

  // Check if user is super admin
  if (currentUser && currentUser.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <Alert className="bg-red-50 border-red-200 max-w-2xl mx-auto mt-8">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Access Denied: Only super admins can manage assistant admins.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Management</h1>
          <p className="text-slate-600">Manage assistant admins and their access</p>
        </div>

        {/* Success/Error Alerts */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-900">{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">{error}</AlertDescription>
          </Alert>
        )}

        {/* Create New Admin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Admin User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Admin Type</Label>
                  <Select
                    value={newAdmin.role}
                    onValueChange={(value) => setNewAdmin(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Assistant Admin (Restricted)</SelectItem>
                      <SelectItem value="regular_admin">Regular Admin (Full Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={createAdminMutation.isPending}
                className="w-full md:w-auto"
              >
                {createAdminMutation.isPending ? 'Creating...' : 'Create Admin User'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Admins List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current Admins ({admins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-2 text-slate-600">Loading admins...</p>
              </div>
            ) : admins.length === 0 ? (
              <p className="text-slate-600 text-center py-8">No admins found</p>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{admin.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="text-sm text-slate-600">{admin.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={admin.role === 'super_admin' ? 'default' : admin.role === 'regular_admin' ? 'default' : 'secondary'}>
                        {admin.role === 'super_admin' ? 'Super Admin' : admin.role === 'regular_admin' ? 'Regular Admin' : 'Assistant Admin'}
                      </Badge>
                      {admin.role !== 'super_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAdmin(admin)}
                          disabled={deleteAdminMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-red-900 mb-2">How Admin Assignment Works</h3>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• <strong>Super Admin:</strong> You see all files and can assign them to assistant admins</li>
              <li>• <strong>Assistant Admins:</strong> Only see files assigned to them and receive emails for their files</li>
              <li>• <strong>Assigning Files:</strong> Use the &quot;Assign Admin&quot; option in project/COI details pages</li>
              <li>• <strong>Email Notifications:</strong> Automatically sent to the assigned admin&apos;s email</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
