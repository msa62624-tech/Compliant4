
import React, { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, FileText, Upload, CheckCircle2, AlertCircle, Clock, 
  User, Shield, Calendar, Eye, Edit2, Save, X, Search
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import UserProfile from "@/components/UserProfile.jsx";

export default function SubcontractorPortal() {
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedCOI, setSelectedCOI] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  // Get contractor record for current user
  const { data: contractor, isLoading: contractorLoading } = useQuery({
    queryKey: ['my-contractor'],
    queryFn: async () => {
      // Check if in testing mode
      const testingRole = sessionStorage.getItem('testing_role');
      
      if (testingRole === 'sub_mpi') {
        // For testing, find MPI contractor
        const contractors = await compliant.entities.Contractor.list();
        return contractors.find(c => c.company_name === 'MPI' && c.contractor_type === 'subcontractor');
      }
      
      // Normal mode - find by email
      const contractors = await compliant.entities.Contractor.filter({ 
        email: user.email,
        contractor_type: 'subcontractor'
      });
      return contractors[0];
    },
    enabled: !!user,
  });

  // Get all projects this subcontractor is on
  const { data: myProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['my-projects', contractor?.company_name],
    queryFn: async () => {
      const projectSubs = await compliant.entities.ProjectSubcontractor.filter({
        subcontractor_name: contractor.company_name
      });
      
      // Get project details for each
      const allProjects = await compliant.entities.Project.list();
      return projectSubs.map(ps => {
        const project = allProjects.find(p => p.id === ps.project_id);
        return { ...ps, project_details: project };
      });
    },
    enabled: !!contractor?.company_name,
  });

  // Get all COIs for this subcontractor
  const { data: myCOIs = [] } = useQuery({
    queryKey: ['my-cois', contractor?.company_name],
    queryFn: () => compliant.entities.GeneratedCOI.filter({
      subcontractor_name: contractor.company_name
    }),
    enabled: !!contractor?.company_name,
  });

  // Get all requirements for my projects
  const { data: allRequirements = [] } = useQuery({
    queryKey: ['all-requirements'],
    queryFn: () => compliant.entities.SubInsuranceRequirement.list(),
  });

  // Filter projects based on search term
  const filteredProjects = myProjects.filter(projectSub => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const projectName = projectSub.project_details?.project_name?.toLowerCase() || '';
    const projectAddress = projectSub.project_details?.project_address?.toLowerCase() || '';
    const gcName = projectSub.gc_name?.toLowerCase() || '';
    
    return (
      projectName.includes(searchLower) ||
      projectAddress.includes(searchLower) ||
      gcName.includes(searchLower)
    );
  });

  const [profileForm, setProfileForm] = useState({
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  React.useEffect(() => {
    if (contractor && !isEditingProfile) {
      setProfileForm({
        contact_person: contractor.contact_person || '',
        email: contractor.email || '',
        phone: contractor.phone || '',
        address: contractor.address || '',
        city: contractor.city || '',
        state: contractor.state || '',
        zip_code: contractor.zip_code || '',
      });
    }
  }, [contractor, isEditingProfile]);

  const updateContractorMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-contractor']);
      setIsEditingProfile(false);
    },
  });

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.GeneratedCOI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-cois']);
      setIsUploadDialogOpen(false);
      setUploadProgress('');
    },
  });

  const handleSaveProfile = async () => {
    await updateContractorMutation.mutateAsync({
      id: contractor.id,
      data: profileForm
    });
  };

  const handleFileUpload = async (file, type) => {
    if (!selectedCOI) return;

    try {
      setIsUploading(true);
      setUploadProgress('📤 Uploading file...');

      const uploadResult = await compliant.integrations.Core.UploadFile({ file });
      
      if (type === 'coi') {
        setUploadProgress('🤖 Extracting data from certificate...');
        
        const extractionResult = await compliant.integrations.Core.ExtractDataFromUploadedFile({
          file_url: uploadResult.file_url,
          json_schema: {
            type: "object",
            properties: {
              insurance_carrier_gl: { type: "string" },
              policy_number_gl: { type: "string" },
              gl_each_occurrence: { type: "number" },
              gl_general_aggregate: { type: "number" },
              gl_products_completed_ops: { type: "number" },
              gl_effective_date: { type: "string" },
              gl_expiration_date: { type: "string" },
              insurance_carrier_umbrella: { type: "string" },
              policy_number_umbrella: { type: "string" },
              umbrella_each_occurrence: { type: "number" },
              umbrella_aggregate: { type: "number" },
              umbrella_effective_date: { type: "string" },
              umbrella_expiration_date: { type: "string" },
              insurance_carrier_wc: { type: "string" },
              policy_number_wc: { type: "string" },
              wc_each_accident: { type: "number" },
              wc_disease_policy_limit: { type: "number" },
              wc_disease_each_employee: { type: "number" },
              wc_effective_date: { type: "string" },
              wc_expiration_date: { type: "string" },
              insurance_carrier_auto: { type: "string" },
              policy_number_auto: { type: "string" },
              auto_combined_single_limit: { type: "number" },
              auto_effective_date: { type: "string" },
              auto_expiration_date: { type: "string" },
            }
          }
        });

        let extractedData = {};
        if (extractionResult.status === 'success' && extractionResult.output) {
          extractedData = extractionResult.output;
        }

        await updateCOIMutation.mutateAsync({
          id: selectedCOI.id,
          data: {
            first_coi_url: uploadResult.file_url,
            first_coi_uploaded: true,
            first_coi_upload_date: new Date().toISOString(),
            status: 'awaiting_admin_review',
            ...extractedData
          }
        });

        alert('✅ Certificate uploaded successfully! It will be reviewed by the admin team.');
      } else if (type === 'hold_harmless') {
        await updateCOIMutation.mutateAsync({
          id: selectedCOI.id,
          data: {
            hold_harmless_sub_signed_url: uploadResult.file_url,
            hold_harmless_sub_signed_date: new Date().toISOString(),
            hold_harmless_status: 'signed_by_sub'
          }
        });

        try {
          const projectDetails = myProjects.find(p => p.project_id === selectedCOI.project_id)?.project_details;
          
          // Notify GC with link to sign
          if (projectDetails?.gc_email) {
            const gcProjectLink = `${window.location.origin}/gc-project?project=${projectDetails.id}&id=${projectDetails.gc_id}`;
            await sendEmail({
              to: projectDetails.gc_email,
              subject: `Action Required: Sign Hold Harmless Agreement - ${projectDetails.project_name}`,
              body: `The subcontractor has signed the Hold Harmless Agreement and it now requires your signature.

Project: ${projectDetails.project_name}
Subcontractor: ${selectedCOI.subcontractor_name}
Trade: ${selectedCOI.trade_type}

📄 Subcontractor's Signed Agreement: ${uploadResult.file_url}

🔗 Click here to review and sign: ${gcProjectLink}

Please review and countersign the agreement to complete the approval process.

Best regards,
InsureTrack System`
            });
          }

          // Notify admin that sub has signed
          if (selectedCOI.admin_emails && Array.isArray(selectedCOI.admin_emails)) {
            for (const adminEmail of selectedCOI.admin_emails) {
              try {
                await sendEmail({
                  to: adminEmail,
                  subject: `📋 Hold Harmless Signed by Sub - ${selectedCOI.subcontractor_name} - ${projectDetails?.project_name}`,
                  body: `A subcontractor has signed their Hold Harmless Agreement and it is now pending GC signature.

Project: ${projectDetails?.project_name || 'N/A'}
Subcontractor: ${selectedCOI.subcontractor_name}
Trade: ${selectedCOI.trade_type}
GC: ${projectDetails?.gc_name || 'N/A'}

Status: Signed by Subcontractor - Pending GC Signature

Signed agreement: ${uploadResult.file_url}

The GC has been notified to review and countersign.

Best regards,
InsureTrack System`
                });
              } catch (adminEmailErr) {
                console.error('Failed to notify admin:', adminEmailErr);
              }
            }
          }
        } catch (notifyErr) {
          console.error('Failed to send notifications about hold harmless:', notifyErr);
        }

        alert('✅ Hold Harmless agreement uploaded successfully! The GC has been notified to countersign.');
      }

      setIsUploading(false);
      setUploadProgress('');
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress('');
      alert('Failed to upload file. Please try again.');
    }
  };

  const getProjectRequirements = (projectId, tradeTypes) => {
    const project = myProjects.find(p => p.project_id === projectId)?.project_details;
    if (!project || !project.program_id) return [];

    const programReqs = allRequirements.filter(r => r.program_id === project.program_id);
    
    return programReqs.filter(req => {
      if (!req.trade_types || req.trade_types.length === 0) return false;
      return tradeTypes.some(trade => req.trade_types.includes(trade));
    });
  };

  const getStatusInfo = (coi) => {
    if (!coi.first_coi_uploaded) {
      return {
        label: 'Not Uploaded',
        color: 'red',
        icon: AlertCircle,
        description: 'Certificate needs to be uploaded'
      };
    }

    if (coi.status === 'awaiting_admin_review') {
      return {
        label: 'Under Review',
        color: 'blue',
        icon: Clock,
        description: 'Certificate is being reviewed by admin'
      };
    }

    if (coi.status === 'deficiency_pending') {
      return {
        label: 'Issues Found',
        color: 'amber',
        icon: AlertCircle,
        description: 'Certificate has compliance issues that need correction'
      };
    }

    if (coi.status === 'active' && coi.gl_expiration_date) {
      const daysUntilExpiry = differenceInDays(new Date(coi.gl_expiration_date), new Date());
      
      if (daysUntilExpiry < 0) {
        return {
          label: 'Expired',
          color: 'red',
          icon: AlertCircle,
          description: 'Certificate has expired'
        };
      } else if (daysUntilExpiry <= 30) {
        return {
          label: `Expires in ${daysUntilExpiry}d`,
          color: 'amber',
          icon: Clock,
          description: 'Certificate expiring soon - renewal needed'
        };
      }
      
      return {
        label: 'Active',
        color: 'emerald',
        icon: CheckCircle2,
        description: 'Certificate is active and compliant'
      };
    }

    return {
      label: 'Pending',
      color: 'slate',
      icon: Clock,
      description: 'Waiting for information'
    };
  };

  const overallCompliance = () => {
    const total = myCOIs.length;
    if (total === 0) return { status: 'none', percentage: 0 };
    
    const active = myCOIs.filter(c => c.status === 'active').length;
    const percentage = Math.round((active / total) * 100);
    
    if (percentage >= 80) return { status: 'good', percentage };
    if (percentage >= 50) return { status: 'medium', percentage };
    return { status: 'poor', percentage };
  };

  if (userLoading || contractorLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Subcontractor Profile</h2>
            <p className="text-slate-600">Your account is not linked to a subcontractor profile. Please contact your administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const compliance = overallCompliance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Welcome, {contractor.company_name}
            </h1>
            <p className="text-slate-600">Manage your projects, insurance certificates, and compliance</p>
          </div>
          <UserProfile 
            user={{ 
              name: user?.name || contractor.contact_person,
              email: user?.email || contractor.email,
              role: 'subcontractor'
            }}
            companyName={contractor.company_name}
          />
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active Projects</p>
                  <p className="text-2xl font-bold text-slate-900">{myProjects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total COIs</p>
                  <p className="text-2xl font-bold text-slate-900">{myCOIs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active COIs</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {myCOIs.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 shadow-sm ${
            compliance.status === 'good' ? 'border-emerald-200 bg-emerald-50' :
            compliance.status === 'medium' ? 'border-amber-200 bg-amber-50' :
            'border-red-200 bg-red-50'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  compliance.status === 'good' ? 'bg-emerald-100' :
                  compliance.status === 'medium' ? 'bg-amber-100' :
                  'bg-red-100'
                }`}>
                  <Shield className={`w-6 h-6 ${
                    compliance.status === 'good' ? 'text-emerald-600' :
                    compliance.status === 'medium' ? 'text-amber-600' :
                    'text-red-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Compliance</p>
                  <p className={`text-2xl font-bold ${
                    compliance.status === 'good' ? 'text-emerald-900' :
                    compliance.status === 'medium' ? 'text-amber-900' :
                    'text-red-900'
                  }`}>
                    {compliance.percentage}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects">My Projects</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="profile">Company Profile</TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b">
                <div className="flex flex-col gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    My Active Projects
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by job/project name or address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {projectsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-lg font-semibold mb-2">
                      {searchTerm ? 'No matching projects' : 'No Projects Yet'}
                    </p>
                    <p>
                      {searchTerm ? 'Try a different search term' : 'You haven\'t been assigned to any projects yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredProjects.map((projectSub) => {
                      const coi = myCOIs.find(c => c.project_id === projectSub.project_id);
                      const statusInfo = coi ? getStatusInfo(coi) : null;
                      const StatusIcon = statusInfo?.icon || Clock;
                      const tradeTypes = projectSub.trade_types || [projectSub.trade_type].filter(Boolean);
                      const requirements = getProjectRequirements(projectSub.project_id, tradeTypes);

                      return (
                        <Card key={projectSub.id} className={`border-2 ${
                          statusInfo?.color === 'emerald' ? 'border-emerald-200 bg-emerald-50' :
                          statusInfo?.color === 'amber' ? 'border-amber-200 bg-amber-50' :
                          statusInfo?.color === 'red' ? 'border-red-200 bg-red-50' :
                          'border-red-200 bg-red-50'
                        }`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-slate-900 mb-2">
                                  {projectSub.project_details?.project_name || 'Unknown Project'}
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4 text-sm mb-3">
                                  <div>
                                    <span className="text-slate-500">GC:</span>
                                    <span className="font-medium text-slate-900 ml-2">{projectSub.gc_name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Your Trade(s):</span>
                                    <div className="inline-flex gap-1 ml-2">
                                      {tradeTypes.map((trade, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-white">
                                          {trade}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  {projectSub.project_details?.address && (
                                    <div className="md:col-span-2">
                                      <span className="text-slate-500">Location:</span>
                                      <span className="font-medium text-slate-900 ml-2">
                                        {projectSub.project_details.address}, {projectSub.project_details.city}, {projectSub.project_details.state}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {statusInfo && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <Badge className={`bg-${statusInfo.color}-600 text-white`}>
                                      <StatusIcon className="w-3 h-3 mr-1" />
                                      {statusInfo.label}
                                    </Badge>
                                    <span className="text-sm text-slate-600">{statusInfo.description}</span>
                                  </div>
                                )}

                                {requirements.length > 0 && (
                                  <div className="mt-4 p-4 bg-white rounded-lg border">
                                    <p className="font-semibold text-slate-900 mb-2">Insurance Requirements:</p>
                                    <div className="space-y-2 text-sm">
                                      {requirements.map((req, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <Shield className="w-4 h-4 text-red-600 mt-0.5" />
                                          <div>
                                            <span className="font-medium">{req.insurance_type.replace(/_/g, ' ').toUpperCase()}:</span>
                                            {req.insurance_type === 'general_liability' && (
                                              <span className="text-slate-600 ml-2">
                                                ${req.gl_each_occurrence?.toLocaleString()} / ${req.gl_general_aggregate?.toLocaleString()}
                                              </span>
                                            )}
                                            {req.insurance_type === 'workers_compensation' && (
                                              <span className="text-slate-600 ml-2">
                                                ${req.wc_each_accident?.toLocaleString()} per accident
                                              </span>
                                            )}
                                            {req.insurance_type === 'umbrella_policy' && (
                                              <span className="text-slate-600 ml-2">
                                                ${req.umbrella_each_occurrence?.toLocaleString()} / ${req.umbrella_aggregate?.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                {coi && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCOI(coi);
                                      setIsUploadDialogOpen(true);
                                    }}
                                    className={
                                      statusInfo?.color === 'red' || statusInfo?.color === 'amber'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-slate-600 hover:bg-slate-700'
                                    }
                                  >
                                    <Upload className="w-4 h-4 mr-1" />
                                    {coi.first_coi_uploaded ? 'Update' : 'Upload'} COI
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  My Insurance Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {myCOIs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-lg font-semibold mb-2">No Documents Yet</p>
                    <p>Your insurance documents will appear here once you&apos;re added to projects.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myCOIs.map((coi) => {
                      const statusInfo = getStatusInfo(coi);
                      const StatusIcon = statusInfo.icon;
                      const deficiencies = coi.policy_analysis?.deficiencies || [];

                      return (
                        <Card key={coi.id} className="border">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 mb-2">
                                  {coi.project_name}
                                </h3>
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge className={`bg-${statusInfo.color}-600 text-white`}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {statusInfo.label}
                                  </Badge>
                                </div>

                                {coi.gl_expiration_date && (
                                  <div className="text-sm text-slate-600 mb-2">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Expires: {format(new Date(coi.gl_expiration_date), 'MMM dd, yyyy')}
                                  </div>
                                )}

                                {deficiencies.length > 0 && coi.status === 'deficiency_pending' && (
                                  <Alert className="mt-3 bg-amber-50 border-amber-200">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription>
                                      <p className="font-semibold text-amber-900 mb-2">
                                        {deficiencies.length} Issue(s) Found:
                                      </p>
                                      <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                                        {deficiencies.slice(0, 3).map((def, idx) => (
                                          <li key={idx}>{def.description}</li>
                                        ))}
                                        {deficiencies.length > 3 && (
                                          <li>...and {deficiencies.length - 3} more</li>
                                        )}
                                      </ul>
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>

                              <div className="flex gap-2">
                                {coi.first_coi_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(coi.first_coi_url, '_blank')}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View COI
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCOI(coi);
                                    setIsUploadDialogOpen(true);
                                  }}
                                >
                                  <Upload className="w-4 h-4 mr-1" />
                                  {coi.first_coi_uploaded ? 'Update' : 'Upload'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Company Profile
                  </CardTitle>
                  {!isEditingProfile ? (
                    <Button
                      size="sm"
                      onClick={() => setIsEditingProfile(true)}
                      variant="outline"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveProfile}
                        disabled={updateContractorMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <Label className="text-lg font-semibold mb-3 block">Company Information</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Company Name</Label>
                        <Input
                          value={contractor.company_name}
                          disabled
                          className="bg-slate-100"
                        />
                      </div>
                      <div>
                        <Label>Trade Specializations</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(() => {
                            const trades = contractor.trade_types && contractor.trade_types.length > 0
                              ? contractor.trade_types
                              : (contractor.trade_type ? [contractor.trade_type] : []);
                            
                            return trades.map((trade, idx) => (
                              <Badge key={idx} variant="outline">
                                {trade}
                              </Badge>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-lg font-semibold mb-3 block">Contact Information</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Contact Person</Label>
                        <Input
                          value={profileForm.contact_person}
                          onChange={(e) => setProfileForm({...profileForm, contact_person: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-lg font-semibold mb-3 block">Business Address</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label>Street Address</Label>
                        <Input
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                      <div>
                        <Label>City</Label>
                        <Input
                          value={profileForm.city}
                          onChange={(e) => setProfileForm({...profileForm, city: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input
                          value={profileForm.state}
                          onChange={(e) => setProfileForm({...profileForm, state: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <Label>ZIP Code</Label>
                        <Input
                          value={profileForm.zip_code}
                          onChange={(e) => setProfileForm({...profileForm, zip_code: e.target.value})}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? 'bg-slate-100' : ''}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Broker Information (Read-only) */}
                  {myCOIs.length > 0 && myCOIs[0].broker_email && (
                    <div>
                      <Label className="text-lg font-semibold mb-3 block">Insurance Broker</Label>
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          {myCOIs[0].broker_company && (
                            <div>
                              <p className="text-slate-500">Company</p>
                              <p className="font-medium text-slate-900">{myCOIs[0].broker_company}</p>
                            </div>
                          )}
                          {myCOIs[0].broker_name && (
                            <div>
                              <p className="text-slate-500">Contact</p>
                              <p className="font-medium text-slate-900">{myCOIs[0].broker_name}</p>
                            </div>
                          )}
                          {myCOIs[0].broker_email && (
                            <div>
                              <p className="text-slate-500">Email</p>
                              <p className="font-medium text-slate-900">{myCOIs[0].broker_email}</p>
                            </div>
                          )}
                          {myCOIs[0].broker_phone && (
                            <div>
                              <p className="text-slate-500">Phone</p>
                              <p className="font-medium text-slate-900">{myCOIs[0].broker_phone}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Upload Documents - {selectedCOI?.project_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border-2 border-red-300">
                <Label className="text-lg font-semibold text-red-900 mb-3 block">
                  Certificate of Insurance (Required)
                </Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleFileUpload(file, 'coi');
                      e.target.value = null;
                    }
                  }}
                  className="border-2 cursor-pointer"
                  disabled={isUploading}
                />
                {selectedCOI?.first_coi_url && (
                  <div className="mt-3">
                    <Badge className="bg-emerald-600 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Current COI on File
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => window.open(selectedCOI.first_coi_url, '_blank')}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  </div>
                )}
              </div>

              {selectedCOI?.hold_harmless_template_url && (
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
                  <Label className="text-lg font-semibold text-green-900 mb-3 block">
                    Hold Harmless Agreement
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFileUpload(file, 'hold_harmless');
                        e.target.value = null;
                      }
                    }}
                    className="border-2 cursor-pointer"
                    disabled={isUploading}
                  />
                  {selectedCOI?.hold_harmless_sub_signed_url && (
                    <div className="mt-3">
                      <Badge className="bg-emerald-600 text-white">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Signed Agreement on File
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2"
                        onClick={() => window.open(selectedCOI.hold_harmless_sub_signed_url, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isUploading && uploadProgress && (
                <Alert className="bg-red-50 border-red-300">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin w-5 h-5 border-4 border-red-600 border-t-transparent rounded-full"></div>
                    <p className="font-semibold text-red-900">{uploadProgress}</p>
                  </div>
                </Alert>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
