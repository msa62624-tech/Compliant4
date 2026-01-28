import React, { useState } from "react";
// Use public backend endpoints for portal (no auth required)
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  Upload,
  Shield,
  Mail,
  Building2,
  Loader2,
  MessageSquare,
  Briefcase,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import MessageThread from "@/components/MessageThread.jsx";
import UserProfile from "@/components/UserProfile.jsx";
import ReplaceDocumentDialog from "@/components/ReplaceDocumentDialog.jsx";
import { getBackendBaseUrl } from "@/urlConfig";

export default function BrokerDashboard() {
  // SECURITY: Get authenticated broker info from session, not URL parameters
  // This prevents unauthorized access by URL manipulation
  const authenticatedEmail = sessionStorage.getItem('brokerPortalEmail');
  const authenticatedName = sessionStorage.getItem('brokerPortalName');
  const isAuthenticated = sessionStorage.getItem('brokerAuthenticated') === 'true';

  // Use authenticated session data instead of URL parameters
  const effectiveBrokerName = authenticatedName;
  const effectiveBrokerEmail = authenticatedEmail;

  // State for replace document dialog
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [selectedCOIForReplace, setSelectedCOIForReplace] = useState(null);

  const backendBase = React.useMemo(() => getBackendBaseUrl(), []);

  const { data: allCOIs = [], isLoading } = useQuery({
    queryKey: ['broker-cois', effectiveBrokerName, effectiveBrokerEmail],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Always send both name and email for precise filtering
      if (effectiveBrokerEmail) params.set('email', effectiveBrokerEmail);
      if (effectiveBrokerName) params.set('name', effectiveBrokerName);
      const res = await fetch(`${backendBase}/public/broker-requests?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load broker requests');
      return await res.json();
    },
    enabled: !!(effectiveBrokerName || effectiveBrokerEmail),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const res = await fetch(`${backendBase}/public/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      return await res.json();
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['broker-messages', effectiveBrokerEmail],
    queryFn: async () => {
      if (!effectiveBrokerEmail) return [];
      const params = new URLSearchParams({ email: effectiveBrokerEmail });
      const res = await fetch(`${backendBase}/public/messages?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load messages');
      return await res.json();
    },
    enabled: !!effectiveBrokerEmail,
  });

  // SECURITY: Show access error if not authenticated or missing credentials
  if (!isAuthenticated || (!effectiveBrokerName && !effectiveBrokerEmail)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Authentication Required</h2>
            <p className="text-slate-600">Please log in to access the broker dashboard.</p>
            <Button 
              className="mt-4"
              onClick={() => window.location.href = '/broker-login'}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-red-600" />
      </div>
    );
  }

  const pendingCount = allCOIs.filter(c => 
    c.status === 'awaiting_broker_info' || 
    c.status === 'awaiting_broker_upload'
  ).length;
  const activeCount = allCOIs.filter(c => c.status === 'active').length;
  const needsAttentionCount = allCOIs.filter(c => 
    c.status === 'awaiting_admin_review' || 
    c.status === 'deficiency_pending'
  ).length;

  const statusConfig = {
    awaiting_broker_info: { label: 'Awaiting Info', color: 'bg-red-100 text-red-700 border-red-200', icon: Clock },
    awaiting_broker_upload: { label: 'Awaiting Upload', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Upload },
    awaiting_broker_signature: { label: 'Needs Signature', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: FileText },
    awaiting_admin_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
    active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    deficiency_pending: { label: 'Deficiency', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  };

  const firstCOI = allCOIs.length > 0 ? allCOIs[0] : null;
  const displayBrokerName = firstCOI?.broker_name || firstCOI?.broker_gl_name || 'Broker';
  const brokerCompany = firstCOI?.broker_company || firstCOI?.broker_gl_company || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-600 via-rose-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {displayBrokerName?.[0]?.toUpperCase() || 'B'}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  {displayBrokerName}
                </h1>
                {brokerCompany && (
                  <p className="text-lg text-slate-600">{brokerCompany}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{effectiveBrokerEmail}</span>
                </div>
              </div>
            </div>
            <UserProfile 
              user={{ 
                name: displayBrokerName,
                email: effectiveBrokerEmail,
                role: 'broker'
              }}
              companyName={brokerCompany}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={FileText}
            label="Total Requests"
            value={allCOIs.length}
            colorClass="blue"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={pendingCount}
            colorClass="amber"
            highlight={pendingCount > 0}
          />
          <StatCard
            icon={CheckCircle2}
            label="Active"
            value={activeCount}
            colorClass="emerald"
          />
          <StatCard
            icon={AlertTriangle}
            label="Needs Attention"
            value={needsAttentionCount}
            colorClass="red"
            highlight={needsAttentionCount > 0}
          />
        </div>

        {/* Messages Section */}
        <Card className="shadow-lg">
          <CardHeader className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-red-600" />
              <CardTitle className="text-2xl font-bold text-slate-900">
                Message Center
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <MessageThread 
              messages={messages} 
              currentUser={{
                user_type: 'broker',
                id: effectiveBrokerEmail,
                name: displayBrokerName,
                email: effectiveBrokerEmail
              }}
              recipientType="admin"
            />
          </CardContent>
        </Card>

        {/* Requests List */}
        <div>
          <Card className="shadow-lg">
            <CardHeader className="border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Certificate Requests
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allCOIs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-6">
                    <FileText className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Requests Yet</h3>
                  <p className="text-slate-600">Certificate requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {allCOIs.map((coi, index) => {
                    const _project = allProjects.find(p => p.id === coi.project_id);
                    const config = statusConfig[coi.status] || statusConfig.awaiting_broker_info;
                    const StatusIcon = config.icon;

                    return (
                      <div 
                        key={coi.id} 
                        className={`p-6 transition-all hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-bold text-slate-900">{coi.subcontractor_name}</h3>
                              <Badge className={`${config.color} border`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              {coi.compliance_status && (
                                <Badge 
                                  className={`${
                                    coi.compliance_status === 'compliant' 
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                      : 'bg-red-100 text-red-700 border-red-200'
                                  } border`}
                                >
                                  {coi.compliance_status === 'compliant' ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Compliant
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      {coi.compliance_issues?.length || 0} Issue(s)
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Building2 className="w-4 h-4 text-red-600" />
                                <span><strong className="text-slate-900">Project:</strong> {coi.project_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <Briefcase className="w-4 h-4 text-red-600" />
                                <span><strong className="text-slate-900">GC:</strong> {coi.gc_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <span><strong className="text-slate-900">Trade:</strong> {coi.trade_type}</span>
                              </div>
                              {coi.sub_notified_date && (
                                <div className="text-xs text-slate-500">
                                  Requested: {format(new Date(coi.sub_notified_date), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            {coi.sample_coi_pdf_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(coi.sample_coi_pdf_url, '_blank')}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Sample
                              </Button>
                            )}
                            
                            {coi.coi_token && (coi.status === 'awaiting_broker_upload' || coi.status === 'awaiting_broker_signature' || coi.status === 'deficiency_pending' || coi.status === 'pending_broker_signature') && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const isSignOnly = coi.status === 'awaiting_broker_signature' || coi.status === 'pending_broker_signature' || coi.is_reused;
                                  const step = isSignOnly ? 3 : 1;
                                  const action = isSignOnly ? 'sign' : 'upload';
                                  window.location.href = `${window.location.origin}${createPageUrl('broker-upload-coi')}?token=${coi.coi_token}&step=${step}&action=${action}`;
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                {coi.status === 'awaiting_broker_signature' || coi.status === 'pending_broker_signature' || coi.is_reused ? (
                                  <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Sign
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload
                                  </>
                                )}
                              </Button>
                            )}

                            {coi.status === 'active' && coi.first_coi_url && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(coi.first_coi_url, '_blank')}
                                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedCOIForReplace(coi);
                                    setReplaceDialogOpen(true);
                                  }}
                                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                  title="Replace approved document (will change status to pending review)"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Replace
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {coi.deficiency_message && (
                          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-700 mb-1">Deficiency Details</p>
                                <p className="text-sm text-red-600">{coi.deficiency_message}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Replace Document Dialog */}
      {selectedCOIForReplace && (
        <ReplaceDocumentDialog
          isOpen={replaceDialogOpen}
          onClose={() => {
            setReplaceDialogOpen(false);
            setSelectedCOIForReplace(null);
          }}
          document={{
            id: selectedCOIForReplace.id,
            document_type: 'Certificate of Insurance',
            insurance_type: 'COI'
          }}
          uploadRequestId={selectedCOIForReplace.upload_request_id}
          complianceCheckId={selectedCOIForReplace.compliance_check_id}
          projectId={selectedCOIForReplace.project_id}
          subcontractorId={selectedCOIForReplace.subcontractor_id}
          brokerEmail={effectiveBrokerEmail}
          brokerName={effectiveBrokerName}
          onSuccess={() => {
            // Refresh the COI list
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, colorClass, highlight }) {
  const colorMap = {
    blue: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200' },
  };

  const colors = colorMap[colorClass];

  return (
    <Card className={`transition-all hover:shadow-md ${highlight ? 'ring-2 ring-red-500' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 ${colors.bg} rounded-lg`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
        </div>
        <h3 className="text-sm font-medium text-slate-600 mb-1">{label}</h3>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}