import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Upload,
  Shield,
  FolderOpen,
  User
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UserProfile from "@/components/UserProfile.jsx";
import ProjectRequirementsViewer from "@/components/ProjectRequirementsViewer";
import { normalizeSubcontractorTrades } from "@/utils";

export default function SubcontractorDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  const subId = urlParams.get('id');
  const subEmail = urlParams.get('email');
  const navigate = useNavigate();

  const { data: subcontractor, isLoading: subLoading, error: subError } = useQuery({
    queryKey: ['subcontractor', subId, subEmail],
    queryFn: async () => {
      const contractors = await apiClient.entities.Contractor.list();
      if (subId) {
        return contractors.find(c => c.id === subId && c.contractor_type === 'subcontractor');
      }
      if (subEmail) {
        return contractors.find(c => c.email === subEmail && c.contractor_type === 'subcontractor');
      }
      return null;
    },
    enabled: !!(subId || subEmail),
  });

  // Get projects this subcontractor is assigned to via ProjectSubcontractor
  const { data: assignedProjects = [] } = useQuery({
    queryKey: ['sub-assigned-projects', subId],
    queryFn: async () => {
      if (!subId) return [];
      const allProjectSubs = await apiClient.entities.ProjectSubcontractor.list();
      const myProjectIds = allProjectSubs
        .filter(ps => ps.subcontractor_id === subId)
        .map(ps => ps.project_id);
      
      const allProjects = await apiClient.entities.Project.list();
      return allProjects.filter(p => myProjectIds.includes(p.id));
    },
    enabled: !!subId,
  });

  const { data: myCOIs = [] } = useQuery({
    queryKey: ['sub-cois', subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      const cois = await apiClient.entities.GeneratedCOI.list('-created_date');
      return cois.filter(c => c.subcontractor_id === subcontractor.id);
    },
    enabled: !!subcontractor?.id,
  });

  if (!subId && !subEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Required</h2>
            <p className="text-slate-600">Please use the link provided in your email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading your portal...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Error Loading Dashboard</h3>
            <p className="text-slate-600 mb-4">
              There was an error loading your information. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subcontractor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Not Found</h2>
            <p className="text-slate-600">Subcontractor not found. Please check your link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCOIs = myCOIs.filter(c => c.status === 'active');
  const expiringSoon = activeCOIs.filter(c => {
    if (!c.gl_expiration_date) return false;
    const daysUntil = differenceInDays(new Date(c.gl_expiration_date), new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  });

  // Check for COIs that need broker verification for renewal
  const needsVerification = myCOIs.filter(c => {
    if (!c.gl_expiration_date) return false;
    const daysUntil = differenceInDays(new Date(c.gl_expiration_date), new Date());
    // Show alert if expiring within 30 days and not yet verified for this renewal cycle
    return daysUntil >= 0 && daysUntil <= 30 && !c.broker_verified_at_renewal;
  });

  const needsBrokerInfo = !subcontractor.broker_email;
  const brokerInfo = subcontractor.broker_email ? {
    name: subcontractor.broker_name || 'Your Broker',
    email: subcontractor.broker_email,
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{subcontractor.company_name}</h1>
              <p className="text-sm text-slate-600">Subcontractor Insurance Portal</p>
            </div>
            <UserProfile 
              user={{ 
                id: subId,
                name: subcontractor.contact_person || subcontractor.company_name,
                email: subcontractor.email,
                role: 'subcontractor'
              }}
              companyName={subcontractor.company_name}
              companyId={subId}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Broker Verification Alert - Critical */}
        {needsVerification.length > 0 && (
          <Card className="border-red-200 bg-red-50 shadow-md">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                🚨 URGENT: Broker Verification Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-900 font-medium">
                Your insurance policies are up for renewal. You must verify your broker information before renewal can proceed.
              </p>
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-sm font-semibold text-red-900 mb-2">Policies Requiring Verification:</p>
                {needsVerification.map((coi) => {
                  const daysUntil = differenceInDays(new Date(coi.gl_expiration_date), new Date());
                  return (
                    <div key={coi.id} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                      <div>
                        <p className="font-medium text-slate-900">{coi.project_name || 'Policy'}</p>
                        <p className="text-sm text-slate-600">
                          Expires: {format(new Date(coi.gl_expiration_date), 'MMMM d, yyyy')} ({daysUntil} days)
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate(`/broker-verification?coiId=${coi.id}`)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        size="sm"
                      >
                        Verify Now
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Broker Setup Alert - Prominent CTA */}
        {needsBrokerInfo && (
          <Card className="border-amber-200 bg-amber-50 shadow-md">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Action Required: Add Your Insurance Broker
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-amber-900">
                To proceed with your projects, you need to provide your insurance broker&apos;s information. Each policy term (GL, WC, etc.) needs a broker. Choose how you&apos;d like to set it up:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <Button 
                  className="h-auto flex-col p-4 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => navigate(`/broker-upload?type=global&subId=${subId}`)}
                >
                  <Upload className="w-5 h-5 mb-2" />
                  <span className="text-base font-semibold">One Broker for All Policies</span>
                  <span className="text-sm font-normal mt-1">Use the same broker for all policy terms (GL, WC, etc.)</span>
                </Button>
                <Button 
                  className="h-auto flex-col p-4 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => navigate(`/broker-upload?type=per-policy&subId=${subId}`)}
                >
                  <Upload className="w-5 h-5 mb-2" />
                  <span className="text-base font-semibold">Different Brokers per Policy</span>
                  <span className="text-sm font-normal mt-1">Set different brokers for each policy term (GL, WC, etc.)</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              My Projects & Insurance Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignedProjects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-slate-900">No projects assigned</h3>
                <p className="text-slate-600">You&apos;ll see your projects here once they&apos;re assigned by a General Contractor.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Project</TableHead>
                    <TableHead>General Contractor</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Insurance Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedProjects.map((project) => {
                    const projectCOI = myCOIs.find(c => c.project_id === project.id);
                    const hasUploaded = projectCOI?.first_coi_uploaded || projectCOI?.first_coi_url;

                    let insuranceStatus = 'pending';
                    let statusColor = 'bg-amber-50 text-amber-700';

                    if (!projectCOI || projectCOI.status === 'awaiting_broker_upload' || !hasUploaded) {
                      insuranceStatus = 'needs broker upload';
                      statusColor = 'bg-red-50 text-red-700';
                    } else if (projectCOI.status === 'awaiting_admin_review' || projectCOI.status === 'awaiting_broker_signature') {
                      insuranceStatus = 'under review';
                      statusColor = 'bg-red-50 text-red-700';
                    } else if (projectCOI.status === 'deficiency_pending') {
                      insuranceStatus = 'needs correction';
                      statusColor = 'bg-orange-50 text-orange-700';
                    } else if (projectCOI.status === 'active') {
                      insuranceStatus = 'approved';
                      statusColor = 'bg-emerald-50 text-emerald-700';
                    }

                    return (
                      <TableRow key={project.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{project.project_name}</TableCell>
                        <TableCell className="text-slate-600">{project.gc_name || 'N/A'}</TableCell>
                        <TableCell className="text-slate-600">{project.city}, {project.state}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            {project.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border ${statusColor}`}>
                            {insuranceStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Insurance Requirements for Projects */}
        {assignedProjects.length > 0 && (
          <div className="space-y-4">
            {assignedProjects.map((project) => {
              const subTrades = normalizeSubcontractorTrades(subcontractor);
              return (
                <div key={project.id}>
                  <ProjectRequirementsViewer 
                    projectId={project.id} 
                    selectedTrades={subTrades}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* COI Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Active COIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{activeCOIs.length}</div>
              <p className="text-sm text-slate-600 mt-1">Approved certificates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{expiringSoon.length}</div>
              <p className="text-sm text-slate-600 mt-1">Within 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-red-600" />
                Broker
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brokerInfo ? (
                <div>
                  <p className="font-medium text-red-600">{brokerInfo.name}</p>
                  <p className="text-sm text-slate-600 mt-1">{brokerInfo.email}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Not yet set up</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Certificates of Insurance - if any */}
        {myCOIs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>My Certificates of Insurance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Project</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>GL Expiration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myCOIs.map((coi) => {
                    const daysUntilExpiry = coi.gl_expiration_date 
                      ? differenceInDays(new Date(coi.gl_expiration_date), new Date())
                      : null;
                    
                    return (
                      <TableRow key={coi.id}>
                        <TableCell className="font-medium">{coi.project_name}</TableCell>
                        <TableCell className="text-slate-600">
                          {coi.created_date ? format(new Date(coi.created_date), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {coi.gl_expiration_date ? format(new Date(coi.gl_expiration_date), 'MMM d, yyyy') : 'N/A'}
                            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {daysUntilExpiry} days
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={coi.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                          >
                            {coi.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
