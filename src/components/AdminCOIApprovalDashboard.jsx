import React, { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Eye, 
  TrendingUp
} from "lucide-react";
import { notificationLinks } from "@/notificationLinkBuilder";
import { validateCOICompliance } from "@/insuranceRequirements";
import { notifyCOIDeficiencies, notifyAllStakeholdersCOIApproved } from "@/coiNotifications";
import UserProfile from "@/components/UserProfile.jsx";

/**
 * AdminCOIApprovalDashboard Component
 * Centralized admin interface for reviewing and approving uploaded COIs
 * Shows compliance status, requirements, and one-click approval
 */
export default function AdminCOIApprovalDashboard() {
  const queryClient = useQueryClient();
  const [selectedCOI, setSelectedCOI] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.auth.me(),
  });

  // Fetch all COIs
  const { data: cois = [], isLoading } = useQuery({
    queryKey: ['allCOIs', filterStatus],
    queryFn: async () => {
      try {
        const allCois = await apiClient.entities.GeneratedCOI.list();
        if (filterStatus === 'all') return allCois;
        if (filterStatus === 'pending') {
          return allCois.filter((c) => c.status === 'pending' || c.status === 'awaiting_admin_review');
        }
        return allCois.filter((c) => c.status === filterStatus);
      } catch (err) {
        // Fallback for public sessions without auth
        const publicPending = await apiClient.integrations.Public.ListPendingCOIs();
        if (filterStatus === 'all') return publicPending;
        if (filterStatus === 'pending') return publicPending;
        return publicPending.filter((c) => c.status === filterStatus);
      }
    },
  });

  // Fetch subcontractors for reference
  const { data: subcontractors = {} } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      try {
        const subs = await apiClient.entities.Contractor.filter({ contractor_type: 'subcontractor' });
        const map = {};
        subs.forEach((s) => (map[s.id] = s));
        return map;
      } catch (_) {
        // Public fallback: show basic data only
        return {};
      }
    },
  });

  // Fetch projects for reference
  const { data: projects = {} } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const prjs = await apiClient.entities.Project.list();
        const map = {};
        prjs.forEach((p) => (map[p.id] = p));
        return map;
      } catch (_) {
        return {};
      }
    },
  });

  // Approve COI mutation
  const approveMutation = useMutation({
    mutationFn: async (coiId) => {
      const coi = cois.find((c) => c.id === coiId);
      if (!coi) throw new Error('COI not found');

      // Update COI status
      await apiClient.entities.GeneratedCOI.update(coiId, {
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: 'admin',
      });

      // Notify all stakeholders
      const sub = subcontractors[coi.subcontractor_id];
      const project = projects[coi.project_id];
      if (sub && project) {
        await notifyAllStakeholdersCOIApproved(coi, sub, project);
      }

      return coi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allCOIs']);
      setSelectedCOI(null);
    },
  });

  // Reject with deficiencies mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ coiId, deficiencies }) => {
      const coi = cois.find((c) => c.id === coiId);
      if (!coi) throw new Error('COI not found');

      // Update COI status
      await apiClient.entities.GeneratedCOI.update(coiId, {
        status: 'pending_correction',
        deficiencies: deficiencies,
        rejected_at: new Date().toISOString(),
      });

      // Notify broker and sub of deficiencies
      const sub = subcontractors[coi.subcontractor_id];
      const project = projects[coi.project_id];
      if (sub && project) {
        await notifyCOIDeficiencies(coi, sub, project, deficiencies);
      }

      return coi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allCOIs']);
      setSelectedCOI(null);
    },
  });

  // Stats
  const pendingCount = cois.filter((c) => c.status === 'pending' || c.status === 'awaiting_admin_review').length;
  const approvedCount = cois.filter((c) => c.status === 'active').length;
  const rejectedCount = cois.filter((c) => c.status === 'pending_correction').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">COI Approval Dashboard</h1>
          <p className="text-gray-600">Review and approve Certificates of Insurance</p>
        </div>
        <UserProfile user={user} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={pendingCount}
          color="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={approvedCount}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs Correction"
          value={rejectedCount}
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Total COIs"
          value={cois.length}
          color="blue"
        />
      </div>

      {/* Tabs for different statuses */}
      <Tabs
        value={filterStatus}
        onValueChange={setFilterStatus}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="active">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="pending_correction">
            Needs Correction ({rejectedCount})
          </TabsTrigger>
          <TabsTrigger value="all">All ({cois.length})</TabsTrigger>
        </TabsList>

        {/* Pending Reviews Tab */}
        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Loading COIs...
              </CardContent>
            </Card>
          ) : cois.filter((c) => c.status === 'pending' || c.status === 'awaiting_admin_review').length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No pending COIs for review
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cois
                .filter((c) => c.status === 'pending' || c.status === 'awaiting_admin_review')
                .map((coi) => (
                  <COICard
                    key={coi.id}
                    coi={coi}
                    subcontractor={subcontractors[coi.subcontractor_id]}
                    project={projects[coi.project_id]}
                    isSelected={selectedCOI?.id === coi.id}
                    onSelect={setSelectedCOI}
                    onApprove={() => approveMutation.mutate(coi.id)}
                    isApproving={approveMutation.isPending}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        {/* Approved Tab */}
        <TabsContent value="active" className="space-y-4">
          {cois.filter((c) => c.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No approved COIs yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cois
                .filter((c) => c.status === 'active')
                .map((coi) => (
                  <COICard
                    key={coi.id}
                    coi={coi}
                    subcontractor={subcontractors[coi.subcontractor_id]}
                    project={projects[coi.project_id]}
                    isSelected={selectedCOI?.id === coi.id}
                    onSelect={setSelectedCOI}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        {/* Needs Correction Tab */}
        <TabsContent value="pending_correction" className="space-y-4">
          {cois.filter((c) => c.status === 'pending_correction').length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No COIs pending correction
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cois
                .filter((c) => c.status === 'pending_correction')
                .map((coi) => (
                  <COICard
                    key={coi.id}
                    coi={coi}
                    subcontractor={subcontractors[coi.subcontractor_id]}
                    project={projects[coi.project_id]}
                    isSelected={selectedCOI?.id === coi.id}
                    onSelect={setSelectedCOI}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Loading COIs...
              </CardContent>
            </Card>
          ) : cois.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No COIs found
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cois.map((coi) => (
                <COICard
                  key={coi.id}
                  coi={coi}
                  subcontractor={subcontractors[coi.subcontractor_id]}
                  project={projects[coi.project_id]}
                  isSelected={selectedCOI?.id === coi.id}
                  onSelect={setSelectedCOI}
                  onApprove={() => approveMutation.mutate(coi.id)}
                  isApproving={approveMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail View */}
      {selectedCOI && (
        <COIDetailPanel
          coi={selectedCOI}
          subcontractor={subcontractors[selectedCOI.subcontractor_id]}
          project={projects[selectedCOI.project_id]}
          onApprove={() => approveMutation.mutate(selectedCOI.id)}
          isApproving={approveMutation.isPending}
          onReject={(deficiencies) =>
            rejectMutation.mutate({ coiId: selectedCOI.id, deficiencies })
          }
          isRejecting={rejectMutation.isPending}
          onClose={() => setSelectedCOI(null)}
        />
      )}
    </div>
  );
}

/**
 * StatCard Component
 */
function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-red-50 border-red-200',
  };

  const iconClasses = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-red-600',
  };

  return (
    <Card className={colorClasses[color]}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${iconClasses[color]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * COICard Component
 */
function COICard({
  coi,
  subcontractor,
  project,
  isSelected,
  onSelect,
  onApprove,
  isApproving,
}) {
  const statusColors = {
    pending: 'bg-amber-50 border-amber-200',
    awaiting_admin_review: 'bg-amber-50 border-amber-200',
    active: 'bg-green-50 border-green-200',
    pending_correction: 'bg-red-50 border-red-200',
  };

  const statusBadge = {
    pending: <Badge className="bg-amber-600">Pending Review</Badge>,
    awaiting_admin_review: <Badge className="bg-amber-600">Under Review</Badge>,
    active: <Badge className="bg-green-600">Approved</Badge>,
    pending_correction: <Badge className="bg-red-600">Needs Correction</Badge>,
  };

  const reviewLink = notificationLinks.getAdminCOIReviewLink(coi.id);

  return (
    <Card
      className={`cursor-pointer transition ${
        isSelected ? 'ring-2 ring-red-500' : ''
      } ${statusColors[coi.status]}`}
      onClick={() => onSelect(coi)}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              {subcontractor?.company_name || 'Unknown Sub'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Project: {project?.project_name || 'Unknown Project'}
            </p>
          </div>
          {statusBadge[coi.status]}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-600">Trade</p>
            <p className="font-semibold">{coi.trade_types?.join(', ') || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">GL Limit</p>
            <p className="font-semibold">
              ${(coi.gl_each_occurrence / 1000000).toFixed(1)}M
            </p>
          </div>
          <div>
            <p className="text-gray-600">WC Limit</p>
            <p className="font-semibold">
              ${(coi.wc_each_accident / 1000000).toFixed(1)}M
            </p>
          </div>
          <div>
            <p className="text-gray-600">Uploaded</p>
            <p className="font-semibold">
              {new Date(coi.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(reviewLink, '_blank');
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            Review Details
          </Button>
          {coi.status === 'pending' && onApprove && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
              disabled={isApproving}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * COIDetailPanel Component
 */
function COIDetailPanel({
  coi,
  subcontractor: _subcontractor,
  project,
  onApprove,
  isApproving,
  onReject,
  isRejecting,
  onClose,
}) {
  const [complianceResult, setComplianceResult] = React.useState(null);

  // Check compliance on mount
  React.useEffect(() => {
    validateCOICompliance(coi, project, coi.trade_types).then(setComplianceResult);
  }, [coi, project]);

  if (!complianceResult) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">Validating compliance...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-0 right-0 m-4 w-96 max-h-96 overflow-y-auto shadow-lg z-50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>COI Details & Compliance</CardTitle>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compliance Status */}
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            {complianceResult.compliant ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Compliance: APPROVED
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                Compliance: ISSUES FOUND
              </>
            )}
          </h4>
        </div>

        {/* Issues */}
        {complianceResult.issues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {complianceResult.issues.length} compliance issue(s) found
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {coi.status === 'pending' && (
            <>
              <Button
                className="flex-1"
                onClick={onApprove}
                disabled={isApproving || !complianceResult.compliant}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onReject(complianceResult.issues)}
                disabled={isRejecting}
              >
                Request Corrections
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
