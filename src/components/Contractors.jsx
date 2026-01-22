import React, { useState } from "react";
import ReactDOM from "react-dom";
import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, Mail, Phone, Plus, Pencil, Trash2, FolderOpen, Archive } from "lucide-react";
import StatsCard from "@/components/insurance/StatsCard";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete.jsx";
import ZipCodeLookup from "@/components/ZipCodeLookup.jsx";
import { sendGCWelcomeEmail } from "@/gcNotifications";
import { notificationLinks } from "@/notificationLinkBuilder";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

export default function Contractors() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignAdminDialog, setIsAssignAdminDialog] = useState(false);
  const [selectedGC, setSelectedGC] = useState(null);
  const [editingContractor, setEditingContractor] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    entity_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    mailing_address: '',
    additional_contacts: [],
    license_number: '',
    status: 'active',
  });
  
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const { data: allContractors = [], isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => compliant.entities.Contractor.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => compliant.entities.User.list(),
    enabled: user?.role === 'super_admin',
  });

  // Filter contractors based on user role
  const contractors = React.useMemo(() => {
    const gcs = allContractors.filter(c => c.contractor_type === 'general_contractor');
    
    if (user?.role === 'super_admin') {
      return gcs; // Super admin sees all
    } else if (user?.role === 'admin') {
      return gcs.filter(gc => gc.admin_id === user.id); // Admin sees only their GCs
    }
    return [];
  }, [allContractors, user]);

  const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');

  const { data: documents = [] } = useQuery({
    queryKey: ['insurance-documents'],
    queryFn: () => compliant.entities.InsuranceDocument.list(),
  });

  const createContractorMutation = useMutation({
    mutationFn: (data) => {
      return compliant.entities.Contractor.create(data);
    },
    onSuccess: (_result) => {
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries(['contractors']);
      // Dialog closure is handled in handleSubmit after Portal creation and email sending complete
    },
    onError: (error) => {
      console.error('❌ Error creating contractor:', error);
      alert(`Failed to create contractor: ${error.message}`);
    },
  });

  const updateContractorMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contractors']);
      closeDialog();
      setIsAssignAdminDialog(false);
      setSelectedGC(null);
    },
  });

  const deleteContractorMutation = useMutation({
    mutationFn: (id) => compliant.entities.Contractor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contractors']);
    },
  });

  // Archive mutation
  const archiveContractorMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await compliant.api.post(`/entities/Contractor/${id}/archive`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Contractor archived successfully');
      queryClient.invalidateQueries(['contractors']);
    },
    onError: (error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  // New openDialog function to handle both add and edit
  const openDialog = (contractor = null) => {
    if (contractor) {
      setEditingContractor(contractor);
      setFormData({
        company_name: contractor.company_name || '',
        contact_person: contractor.contact_person || '',
        entity_name: contractor.entity_name || '',
        email: contractor.email || '',
        phone: contractor.phone || '',
        address: contractor.address || '',
        city: contractor.city || '',
        state: contractor.state || '',
        zip_code: contractor.zip_code || '',
        mailing_address: contractor.mailing_address || '',
        additional_contacts: contractor.additional_contacts || [],
        license_number: contractor.license_number || '',
        status: contractor.status || 'active',
      });
    } else {
      setEditingContractor(null);
      setFormData({
        company_name: '',
        entity_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        mailing_address: '',
        additional_contacts: [],
        license_number: '',
        status: 'active',
      });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingContractor(null); // Reset editing contractor
    // Reset form data to initial state
    setFormData({
      company_name: '',
      entity_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      mailing_address: '',
      additional_contacts: [],
      license_number: '',
      status: 'active',
    });
  };

  const handleAddressSelect = (addressData) => {
    if (!addressData) return;
    setFormData({
      ...formData,
      address: addressData.address || '',
      city: addressData.city || '',
      state: addressData.state || '',
      zip_code: addressData.zip_code || '',
    });
  };

  const handleZipCityStateFound = (city, state) => {
    setFormData((prev) => ({
      ...prev,
      city: city || prev.city,
      state: state || prev.state,
    }));
  };

  const handleAddContact = () => {
    setFormData({
      ...formData,
      additional_contacts: [
        ...formData.additional_contacts,
        { name: '', email: '', phone: '', position: '', receive_emails: false }
      ]
    });
  };

  const handleRemoveContact = (index) => {
    setFormData({
      ...formData,
      additional_contacts: formData.additional_contacts.filter((_, i) => i !== index)
    });
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.additional_contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData({ ...formData, additional_contacts: newContacts });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      contractor_type: 'general_contractor',
      ...(!editingContractor && { admin_id: user?.id, admin_name: user?.name })
    };

    try {
      if (editingContractor) {
        await updateContractorMutation.mutateAsync({ id: editingContractor.id, data });
        closeDialog();
        alert('✅ General Contractor updated successfully!');
      } else {
        // Create the contractor
        const newGC = await createContractorMutation.mutateAsync(data);
        const gcLogin = newGC.gcLogin;
        
        // Create Portal for GC (await it to ensure it's created)
        // Use gc-dashboard (public access) not gc-details (admin only)
        // Generate secure portal token using crypto
        const portalTokenBytes = new Uint8Array(24);
        crypto.getRandomValues(portalTokenBytes);
        const portalToken = Array.from(portalTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        
        const dashboardLink = notificationLinks.getGCDashboardLink(newGC.id);
        const projectsLink = notificationLinks.getGCProjectsLink(newGC.id);
        
        let portalCreated = false;
        let emailSent = false;
        
        try {
          const createdPortal = await compliant.entities.Portal.create({
            user_type: 'gc',
            user_id: newGC.id,
            user_name: data.company_name || data.entity_name,
            user_email: data.email,
            access_token: portalToken,
            dashboard_url: dashboardLink,
            projects_url: projectsLink,
            status: 'active',
            welcome_email_sent: false,
            welcome_email_sent_date: null
          });
          portalCreated = true;
          
          // Send welcome email with login credentials and portal access information
          try {
            emailSent = await sendGCWelcomeEmail({
              ...newGC,
              email: data.email,
              contact_person: data.contact_person,
              company_name: data.company_name || data.entity_name,
              license_number: data.license_number,
              phone: data.phone,
              gcLogin
            });
            
            if (emailSent) {
              // Update portal to mark email as sent
              await compliant.entities.Portal.update(createdPortal.id, {
                welcome_email_sent: true,
                welcome_email_sent_date: new Date().toISOString()
              });
            } else {
              console.warn('⚠️ Welcome email was not sent (returned false)');
            }
          } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError);
            emailSent = false;
          }
        } catch (portalError) {
          console.error('❌ Failed to create portal:', portalError);
          portalCreated = false;
        }
        
        // Create portals and send emails for additional contacts
        let additionalContactResults = [];
        if (data.additional_contacts && data.additional_contacts.length > 0) {
          for (const contact of data.additional_contacts) {
            if (!contact.email || !contact.name) continue;
            
            try {
              // Generate portal token for additional contact
              const contactTokenBytes = new Uint8Array(24);
              crypto.getRandomValues(contactTokenBytes);
              const contactToken = Array.from(contactTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
              
              // Create username from email (before @ sign)
              const username = contact.email.split('@')[0];
              
              // Generate temporary password
              const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
              
              // Create user account for additional contact
              const contactUser = await compliant.entities.User.create({
                username: username,
                password: tempPassword,
                email: contact.email,
                name: contact.name,
                role: 'gc_user',
                gc_id: newGC.id,
                gc_name: data.company_name || data.entity_name,
                is_active: true,
                created_date: new Date().toISOString()
              });
              
              // Create Portal for additional contact
              const contactPortal = await compliant.entities.Portal.create({
                user_type: 'gc_user',
                user_id: contactUser.id,
                user_name: contact.name,
                user_email: contact.email,
                access_token: contactToken,
                dashboard_url: dashboardLink,
                projects_url: projectsLink,
                status: 'active',
                gc_id: newGC.id,
                welcome_email_sent: false,
                welcome_email_sent_date: null
              });
              
              // Send welcome email to additional contact
              try {
                const contactEmailSent = await sendEmail({
                  to: contact.email,
                  subject: `Welcome to InsureTrack - ${data.company_name || data.entity_name}`,
                  body: `Dear ${contact.name},

You have been added as a contact for ${data.company_name || data.entity_name} on InsureTrack.

🔐 Your Login Credentials:
Username: ${username}
Temporary Password: ${tempPassword}

🔗 Access Your Dashboard:
${dashboardLink}

📋 View Projects:
${projectsLink}

What you can do:
✓ View all projects for ${data.company_name || data.entity_name}
✓ Upload insurance documents
✓ Track compliance status
✓ Receive notifications about your projects

Please login and change your password on first access.

Best regards,
InsureTrack Team`
                });
                
                if (contactEmailSent) {
                  await compliant.entities.Portal.update(contactPortal.id, {
                    welcome_email_sent: true,
                    welcome_email_sent_date: new Date().toISOString()
                  });
                  additionalContactResults.push({ name: contact.name, email: contact.email, success: true });
                } else {
                  additionalContactResults.push({ name: contact.name, email: contact.email, success: false, reason: 'Email failed' });
                }
              } catch (emailErr) {
                console.error(`Failed to send email to ${contact.email}:`, emailErr);
                additionalContactResults.push({ name: contact.name, email: contact.email, success: false, reason: emailErr.message });
              }
            } catch (contactErr) {
              console.error(`Failed to create account for ${contact.name}:`, contactErr);
              additionalContactResults.push({ name: contact.name, email: contact.email, success: false, reason: contactErr.message });
            }
          }
        }
        
        // Close dialog after everything is done
        closeDialog();
        
        // Show success message with status of portal and email
        const loginNote = gcLogin
          ? `\n\n🔐 Login created:\nUsername: ${gcLogin.username}\nTemporary password: ${gcLogin.password}`
          : '';
        
        const portalNote = portalCreated ? '\n✅ Portal created' : '\n⚠️ Portal creation failed';
        const emailNote = emailSent ? `\n✅ Welcome email sent to ${data.email}` : '\n⚠️ Welcome email failed to send';
        
        // Additional contacts note
        let additionalContactsNote = '';
        if (additionalContactResults.length > 0) {
          const successCount = additionalContactResults.filter(r => r.success).length;
          additionalContactsNote = `\n\n👥 Additional Contacts: ${successCount}/${additionalContactResults.length} successfully created`;
          additionalContactResults.forEach(result => {
            if (result.success) {
              additionalContactsNote += `\n  ✅ ${result.name} (${result.email})`;
            } else {
              additionalContactsNote += `\n  ⚠️ ${result.name} (${result.email}) - ${result.reason}`;
            }
          });
        }
        
        // Include dashboard link when portal is created (especially important when email fails)
        const dashboardLinkNote = portalCreated ? `\n\n🔗 GC Dashboard Link:\n${dashboardLink}` : '';
        
        alert(`✅ General Contractor "${data.company_name || data.entity_name}" has been added!${loginNote}${portalNote}${emailNote}${additionalContactsNote}${dashboardLinkNote}`);
      }
    } catch (error) {
      console.error('❌ Submit error:', error);
      
      // Provide specific guidance based on error type
      let errorMessage = error.message;
      if (error.message.includes('Backend not configured')) {
        errorMessage = `❌ Configuration Error: Backend not connected!\n\n` +
          `The application cannot save data because the backend URL is not configured.\n\n` +
          `To fix this:\n` +
          `1. Create a .env file in the root directory\n` +
          `2. Add: VITE_API_BASE_URL=http://localhost:3001\n` +
          `3. Ensure the backend server is running (npm start in backend directory)\n` +
          `4. Refresh the page\n\n` +
          `Technical details: ${error.message}`;
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = `❌ Authentication Error: Please log in again.\n\n${error.message}`;
      } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        errorMessage = `❌ Network Error: Cannot connect to backend.\n\n` +
          `Please ensure:\n` +
          `1. Backend server is running (http://localhost:3001)\n` +
          `2. VITE_API_BASE_URL is configured correctly in .env file\n` +
          `3. There are no firewall or CORS issues\n\n` +
          `Technical details: ${error.message}`;
      }
      
      alert(errorMessage);
    }
  };

  const openAssignAdminDialog = (gc) => {
    setSelectedGC(gc);
    setIsAssignAdminDialog(true);
  };

  const handleAssignAdmin = async (adminId) => {
    const admin = allUsers.find(u => u.id === adminId);
    await updateContractorMutation.mutateAsync({
      id: selectedGC.id,
      data: {
        admin_id: adminId,
        admin_name: admin?.name || '',
      }
    });
  };

  const _handleDelete = async (contractorId) => {
    if (!confirm('Are you sure you want to delete this General Contractor? This action cannot be undone.')) {
      return;
    }
    
    await deleteContractorMutation.mutateAsync(contractorId);
  };

  const handleArchive = async (contractor) => {
    const reason = prompt(`Archive ${contractor.company_name}?\n\nPlease provide a reason (e.g., "Out of business", "Project completed"):`);
    
    if (reason === null) {
      // User cancelled
      return;
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for archiving');
      return;
    }
    
    await archiveContractorMutation.mutateAsync({ 
      id: contractor.id, 
      reason: reason.trim() 
    });
  };

  const handleResendWelcome = async (contractor) => {
    try {
      // Find or create Portal for this GC
      const portals = await compliant.entities.Portal.filter({ user_type: 'gc', user_id: contractor.id });
      let portal = portals && portals[0];

      if (!portal) {
        // Use gc-dashboard (public access) not gc-details (admin only)
        // Generate secure portal token using crypto
        const portalTokenBytes = new Uint8Array(24);
        crypto.getRandomValues(portalTokenBytes);
        const portalToken = Array.from(portalTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        
        const dashboardLink = notificationLinks.getGCDashboardLink(contractor.id);
        const projectsLink = notificationLinks.getGCProjectsLink(contractor.id);
        portal = await compliant.entities.Portal.create({
          user_type: 'gc',
          user_id: contractor.id,
          user_name: contractor.entity_name || contractor.company_name,
          user_email: contractor.email,
          access_token: portalToken,
          dashboard_url: dashboardLink,
          projects_url: projectsLink,
          status: 'active',
          welcome_email_sent: false,
          welcome_email_sent_date: null
        });
      }

      const dashboardLink = portal.dashboard_url || notificationLinks.getGCDashboardLink(contractor.id);
      const projectsLink = portal.projects_url || notificationLinks.getGCProjectsLink(contractor.id);

      const _resp = await sendEmail({
        to: contractor.email,
        subject: `Welcome to InsureTrack - Access Your Portal`,
        body: `Dear ${contractor.contact_person},

Welcome to InsureTrack! Your General Contractor portal has been created for ${contractor.entity_name || contractor.company_name}.

🔗 Access Your Portal Here:
${dashboardLink}

📋 View All Your Projects:
${projectsLink}

What you can do in your portal:
• Create and manage construction projects
• Add subcontractors to projects  
• Track insurance compliance status
• View all certificates and documents
• Monitor project progress in real-time

Click the links above to access your dashboard immediately - no password setup required.

Need help? Reply to this email and we'll assist you.

Best regards,
InsureTrack Team`
      });
      // Email sent successfully (previewUrl available in dev mode)

      await compliant.entities.Portal.update(portal.id, {
        welcome_email_sent: true,
        welcome_email_sent_date: new Date().toISOString()
      });
      
      alert(`✅ Welcome email resent successfully to ${contractor.email}\n\n🔗 GC Dashboard Link:\n${dashboardLink}`);
    } catch (err) {
      console.error('Failed to resend welcome email:', err);
      
      // Still show the dashboard link even if email failed
      // Use gc-dashboard (public access) not gc-details (admin only)
      const dashboardFallback = notificationLinks.getGCDashboardLink(contractor.id);
      alert(`⚠️ Failed to resend welcome email\n\n🔗 GC Dashboard Link (share manually):\n${dashboardFallback}`);
    }
  };

  const _getContractorStats = (contractorId) => {
    const contractorDocs = documents.filter(d => d.contractor_id === contractorId);
    return {
      total: contractorDocs.length,
      approved: contractorDocs.filter(d => d.approval_status === 'approved').length,
      pending: contractorDocs.filter(d => d.approval_status === 'pending').length,
    };
  };

  const handleRowClick = (contractor, e) => {
    // Don't navigate if clicking on buttons within the row
    if (e.target.closest('button')) return;
    navigate(createPageUrl(`GCDetails?id=${contractor.id}`));
  };

  const stats = {
    total: contractors.length,
    active: contractors.filter(c => c.status === 'active').length,
    pending: contractors.filter(c => c.status === 'pending').length,
  };

  return (
    <div className={`min-h-screen bg-slate-50 ${isDialogOpen || isAssignAdminDialog ? 'overflow-hidden' : ''}`}>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-full px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                General Contractors
              </h1>
              <p className="text-slate-600">
                {user?.role === 'super_admin' ? 'Manage all General Contractors' : 'Manage your General Contractors and their projects'}
              </p>
            </div>
            <Button
              onClick={() => openDialog()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm h-10 px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contractor
            </Button>
          </div>
        </div>
      </div>
      <div className="max-w-full px-8 py-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total GCs"
            value={stats.total}
            icon={Users}
            color="blue"
          />
          <StatsCard
            title="Active"
            value={stats.active}
            icon={Building2}
            color="green"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon={Building2}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button
            onClick={() => openDialog()}
            className="h-20 bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-semibold flex flex-col items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-6 h-6" />
            <span>Add New GC</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 font-semibold flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/contractors')}
          >
            <Building2 className="w-6 h-6 text-slate-600" />
            <span>View All</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 border-2 border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 font-semibold flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl font-bold text-emerald-600">{stats.active}</span>
            <span className="text-emerald-700">Active</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 border-2 border-amber-300 hover:border-amber-400 hover:bg-amber-50 font-semibold flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl font-bold text-amber-600">{stats.pending}</span>
            <span className="text-amber-700">Pending</span>
          </Button>
        </div>

        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <CardTitle className="text-lg font-semibold text-slate-900">
              All Contractors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Contact Person</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    {user?.role === 'super_admin' && (
                      <TableHead className="font-semibold">Assigned Admin</TableHead>
                    )}
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Pricing</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        {user?.role === 'super_admin' && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : contractors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={user?.role === 'super_admin' ? 8 : 7} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center gap-4">
                          <Building2 className="w-16 h-16 text-slate-300" />
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                              No General Contractors Yet
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">
                              Add your first General Contractor to get started
                            </p>
                            <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700">
                              <Plus className="w-4 h-4 mr-2" />
                              Add General Contractor
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    contractors.map((contractor) => {
                      const hasCustomPricing = contractor.custom_pricing && 
                        (contractor.custom_pricing.per_project || contractor.custom_pricing.monthly || contractor.custom_pricing.annual);
                      
                      return (
                        <TableRow 
                          key={contractor.id} 
                          className="hover:bg-red-50 cursor-pointer transition-colors"
                          onClick={(e) => handleRowClick(contractor, e)}
                        >
                          <TableCell className="font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              {contractor.company_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {contractor.contact_person}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {contractor.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {contractor.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {contractor.phone}
                              </div>
                            )}
                          </TableCell>
                          {user?.role === 'super_admin' && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {contractor.admin_name ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  {contractor.admin_name}
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAssignAdminDialog(contractor)}
                                  className="text-amber-600 border-amber-200"
                                >
                                  Assign Admin
                                </Button>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                contractor.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : contractor.status === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }
                            >
                              {contractor.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {hasCustomPricing ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Custom
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                Standard
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(contractor)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/gc-details?id=${contractor.id}`)}
                                className="text-indigo-600 hover:text-rose-700 hover:bg-rose-50 font-medium"
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/gc-projects?id=${contractor.id}`)}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-medium"
                              >
                                <FolderOpen className="w-4 h-4 mr-1" />
                                Projects
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendWelcome(contractor)}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium"
                              >
                                Resend Welcome
                              </Button>
                              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleArchive(contractor)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-medium"
                                >
                                  <Archive className="w-4 h-4 mr-1" />
                                  Archive
                                </Button>
                              )}
                              {/* <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(contractor.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button> */}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit GC Dialog - Rendered as Portal */}
      {isDialogOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 px-6 pt-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingContractor ? 'Edit General Contractor' : 'Add New General Contractor'}
              </h2>
              <button
                onClick={closeDialog}
                className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-6 px-6">
              {editingContractor ? 'Update the contractor information below' : 'Fill out the form to add a new general contractor to the system'}
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <Label htmlFor="entity_name">
                    Entity Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="entity_name"
                    value={formData.entity_name}
                    onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                    placeholder="ABC Construction LLC"
                    required
                  />
                  <p className="text-xs text-slate-500">Legal entity name for the company</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name">
                    Company Name / DBA <span className="text-red-500">*</span>
                  </Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="ABC Construction"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">
                  Primary Contact Person <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-base font-semibold">Business Address</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <AddressAutocomplete
                      value={formData.address}
                      onChange={(value) => setFormData({ ...formData, address: value })}
                      onAddressSelect={handleAddressSelect}
                      placeholder="123 Business St"
                    />
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) => setFormData({ ...formData, state: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {US_STATES.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zip_code">ZIP Code</Label>
                      <ZipCodeLookup
                        value={formData.zip_code}
                        onChange={(value) => setFormData({ ...formData, zip_code: value })}
                        onCityStateFound={handleZipCityStateFound}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mailing_address">
                  Mailing Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mailing_address"
                  value={formData.mailing_address}
                  onChange={(e) => setFormData({ ...formData, mailing_address: e.target.value })}
                  placeholder="PO Box 456, City, State ZIP or same as business address"
                  required
                />
                <p className="text-xs text-slate-500">Portal access link will be sent to the email associated with this address</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="LIC-123456"
                />
              </div>

              {/* Additional Contacts Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Additional Contacts</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddContact}
                    className="text-red-600"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Contact
                  </Button>
                </div>
                <p className="text-sm text-slate-500">Add team members who should receive email notifications</p>
                
                {formData.additional_contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4 text-center">No additional contacts added yet</p>
                ) : (
                  <div className="space-y-4">
                    {formData.additional_contacts.map((contact, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg border space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Contact {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContact(index)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Name"
                            value={contact.name}
                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                          />
                          <Input
                            placeholder="Position"
                            value={contact.position}
                            onChange={(e) => handleContactChange(index, 'position', e.target.value)}
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={contact.email}
                            onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                          />
                          <Input
                            placeholder="Phone"
                            value={contact.phone}
                            onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`receive-emails-${index}`}
                            checked={contact.receive_emails}
                            onChange={(e) => handleContactChange(index, 'receive_emails', e.target.checked)}
                            className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                          />
                          <Label htmlFor={`receive-emails-${index}`} className="text-sm cursor-pointer">
                            Send email notifications to this contact
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

              <div className="flex gap-2 px-6 py-6 border-t bg-slate-50 rounded-b-lg">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={createContractorMutation.isPending || updateContractorMutation.isPending}
                >
                  {editingContractor ? 'Update' : 'Add'} General Contractor
                </Button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Assign Admin Dialog - Rendered as Portal */}
      {isAssignAdminDialog && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Assign Admin</h2>
              <button
                onClick={() => setIsAssignAdminDialog(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Assign admin to {selectedGC?.company_name}
            </p>
            <div className="space-y-2">
              {admins.map((admin) => (
                <Button
                  key={admin.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleAssignAdmin(admin.id)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {admin.full_name} ({admin.email})
                  <Badge className="ml-auto" variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                    {admin.role}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}