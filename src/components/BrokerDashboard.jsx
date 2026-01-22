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

  // Compute backend base for Codespaces or local
  const backendBase = React.useMemo(() => {
    const { protocol, host, origin } = window.location;
    const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
    if (m) return `${protocol}//${m[1]}-3001${m[3]}`;
    if (origin.includes(':5175')) return origin.replace(':5175', ':3001');
    if (origin.includes(':5176')) return origin.replace(':5176', ':3001');
    return import.meta?.env?.VITE_API_BASE_URL || '';
  }, []);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md border-slate-700 bg-slate-800">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-amber-400 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-300">Please log in to access the broker dashboard.</p>
            <Button 
              className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-teal-400" />
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
    awaiting_broker_info: { label: 'Awaiting Info', color: 'bg-red-500/20 text-red-300 border-red-400/30', icon: Clock, bgIcon: 'bg-red-500/20' },
    awaiting_broker_upload: { label: 'Awaiting Upload', color: 'bg-amber-500/20 text-amber-300 border-amber-400/30', icon: Upload, bgIcon: 'bg-amber-500/20' },
    awaiting_broker_signature: { label: 'Needs Signature', color: 'bg-purple-500/20 text-purple-300 border-purple-400/30', icon: FileText, bgIcon: 'bg-purple-500/20' },
    awaiting_admin_review: { label: 'Under Review', color: 'bg-rose-500/20 text-indigo-300 border-indigo-400/30', icon: Clock, bgIcon: 'bg-rose-500/20' },
    active: { label: 'Active', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30', icon: CheckCircle2, bgIcon: 'bg-emerald-500/20' },
    deficiency_pending: { label: 'Deficiency', color: 'bg-red-500/20 text-red-300 border-red-400/30', icon: AlertTriangle, bgIcon: 'bg-red-500/20' },
  };

  const firstCOI = allCOIs.length > 0 ? allCOIs[0] : null;
  const displayBrokerName = firstCOI?.broker_name || firstCOI?.broker_gl_name || 'Broker';
  const brokerCompany = firstCOI?.broker_company || firstCOI?.broker_gl_company || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
                  {displayBrokerName?.[0]?.toUpperCase() || 'B'}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-white mb-2">
                  {displayBrokerName}
                </h1>
                {brokerCompany && (
                  <p className="text-xl text-slate-300 mb-3">{brokerCompany}</p>
                )}
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
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Mail className="w-5 h-5 text-teal-400" />
              <span className="text-slate-200 text-sm">{effectiveBrokerEmail}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-delay-100">
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
        <div className="animate-fade-in-delay-200">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-slate-700 pb-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-teal-400" />
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-200 to-rose-200 bg-clip-text text-transparent">
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
        </div>

        {/* Requests List */}
        <div className="animate-fade-in-delay-300">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-slate-700 pb-6">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-400" />
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-200 to-rose-200 bg-clip-text text-transparent">
                  Certificate Requests
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allCOIs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-700 rounded-full mb-6">
                    <FileText className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Requests Yet</h3>
                  <p className="text-slate-400">Certificate requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {allCOIs.map((coi, index) => {
                    const _project = allProjects.find(p => p.id === coi.project_id);
                    const config = statusConfig[coi.status] || statusConfig.awaiting_broker_info;
                    const StatusIcon = config.icon;

                    return (
                      <div 
                        key={coi.id} 
                        className={`p-6 transition-all duration-300 hover:bg-slate-700/30 border-l-4 border-transparent hover:border-teal-400 ${index % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-bold text-white">{coi.subcontractor_name}</h3>
                              <Badge className={`${config.color} border`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              {coi.compliance_status && (
                                <Badge 
                                  className={`${
                                    coi.compliance_status === 'compliant' 
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' 
                                      : 'bg-red-500/20 text-red-300 border-red-400/50'
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
                              <div className="flex items-center gap-2 text-slate-300">
                                <Building2 className="w-4 h-4 text-teal-400" />
                                <span><strong className="text-slate-200">Project:</strong> {coi.project_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-300">
                                <Briefcase className="w-4 h-4 text-teal-400" />
                                <span><strong className="text-slate-200">GC:</strong> {coi.gc_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-300">
                                <span><strong className="text-slate-200">Trade:</strong> {coi.trade_type}</span>
                              </div>
                              {coi.sub_notified_date && (
                                <div className="text-xs text-slate-400">
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
                                className="text-red-400 border-red-400/30 hover:bg-red-500/20 transition-all"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Sample
                              </Button>
                            )}
                            
                            {coi.coi_token && (coi.status === 'awaiting_broker_upload' || coi.status === 'awaiting_broker_signature' || coi.status === 'deficiency_pending') && (
                              <Button
                                size="sm"
                                onClick={() => window.location.href = `${window.location.origin}${createPageUrl('broker-upload-coi')}?token=${coi.coi_token}`}
                                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white group"
                              >
                                <Upload className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform" />
                                Upload
                              </Button>
                            )}

                            {coi.status === 'active' && coi.first_coi_url && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(coi.first_coi_url, '_blank')}
                                  className="text-emerald-400 border-emerald-400/30 hover:bg-emerald-500/20 transition-all"
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
                                  className="text-amber-400 border-amber-400/30 hover:bg-amber-500/20 transition-all"
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
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-300 mb-1">Deficiency Details</p>
                                <p className="text-sm text-red-200">{coi.deficiency_message}</p>
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

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-delay-100 {
          animation: fade-in 0.6s ease-out 0.1s both;
        }

        .animate-fade-in-delay-200 {
          animation: fade-in 0.6s ease-out 0.2s both;
        }

        .animate-fade-in-delay-300 {
          animation: fade-in 0.6s ease-out 0.3s both;
        }
      `}</style>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, colorClass, highlight }) {
  const colorMap = {
    blue: { bg: 'from-red-500/10 to-rose-600/5', icon: 'text-red-400', border: 'border-red-500/20', hover: 'hover:border-red-400/40' },
    amber: { bg: 'from-amber-500/10 to-amber-600/5', icon: 'text-amber-400', border: 'border-amber-500/20', hover: 'hover:border-amber-400/40' },
    emerald: { bg: 'from-emerald-500/10 to-emerald-600/5', icon: 'text-emerald-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-400/40' },
    red: { bg: 'from-red-500/10 to-red-600/5', icon: 'text-red-400', border: 'border-red-500/20', hover: 'hover:border-red-400/40' },
  };

  const colors = colorMap[colorClass];

  return (
    <div className={`relative p-6 bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl ${colors.hover} transition-all duration-300 ${highlight ? 'ring-1 ring-offset-2 ring-offset-slate-900 ' + colors.border : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-${colorClass}-500/20 rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-400 mb-1">{label}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}