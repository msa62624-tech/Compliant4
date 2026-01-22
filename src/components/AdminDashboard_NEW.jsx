
import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, FileText, AlertTriangle, CheckCircle2, Clock, Building2, MessageSquare } from "lucide-react";
import StatsCard from "@/components/insurance/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UserProfile from "@/components/UserProfile.jsx";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.auth.me(),
  });

  const { data: pendingCOIs = [] } = useQuery({
    queryKey: ['pending-coi-reviews'],
    queryFn: async () => {
      const cois = await apiClient.entities.GeneratedCOI.list('-uploaded_for_review_date');
      return cois.filter(c => c.status === 'awaiting_admin_review');
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: activeCOIs = [] } = useQuery({
    queryKey: ['active-cois'],
    queryFn: async () => {
      const cois = await apiClient.entities.GeneratedCOI.list();
      return cois.filter(c => c.status === 'active');
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.entities.Project.list('-created_date'),
  });

  const { data: allSubs = [] } = useQuery({
    queryKey: ['all-subs'],
    queryFn: () => apiClient.entities.Contractor.filter({ contractor_type: 'subcontractor' }),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['recent-messages'],
    queryFn: () => apiClient.entities.Message.list('-created_date'),
  });

  const expiringSoon = activeCOIs.filter(coi => {
    if (!coi.gl_expiration_date) return false;
    const daysUntil = differenceInDays(new Date(coi.gl_expiration_date), new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  });

  const projectsNeedingSetup = projects.filter(p => p.needs_admin_setup);
  const unreadMessages = messages.filter(m => !m.is_read).length;

  const stats = {
    pendingReviews: pendingCOIs.length,
    expiringSoon: expiringSoon.length,
    projectsNeedingSetup: projectsNeedingSetup.length,
    totalSubs: allSubs.length,
    unreadMessages: unreadMessages,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Admin Dashboard
            </h1>
            <p className="text-slate-600">System overview and quick actions</p>
          </div>
          <UserProfile 
            user={user}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div onClick={() => navigate(createPageUrl('PendingReviews'))} className="cursor-pointer">
            <StatsCard
              title="Pending Reviews"
              value={stats.pendingReviews}
              icon={Clock}
              color="amber"
              subtitle="Need your attention"
            />
          </div>
          <div onClick={() => navigate(createPageUrl('ExpiringPolicies'))} className="cursor-pointer">
            <StatsCard
              title="Expiring Soon"
              value={stats.expiringSoon}
              icon={AlertTriangle}
              color="red"
              subtitle="Within 30 days"
            />
          </div>
          <div onClick={() => navigate(createPageUrl('ProjectsSetup'))} className="cursor-pointer">
            <StatsCard
              title="Projects Setup"
              value={stats.projectsNeedingSetup}
              icon={FileText}
              color="blue"
              subtitle="Awaiting configuration"
            />
          </div>
          <div onClick={() => navigate(createPageUrl('Messages'))} className="cursor-pointer">
            <StatsCard
              title="Messages"
              value={stats.unreadMessages}
              icon={MessageSquare}
              color="purple"
              subtitle="Unread messages"
            />
          </div>
        </div>

        {projectsNeedingSetup.length > 0 && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              <div className="flex items-center justify-between">
                <div>
                  <span>
                    <strong>{projectsNeedingSetup.length} new project{projectsNeedingSetup.length !== 1 ? 's' : ''}</strong> need{projectsNeedingSetup.length === 1 ? 's' : ''} insurance program assignment.
                  </span>
                  {projectsNeedingSetup.length === 1 && (
                    <div className="text-sm mt-1 text-red-800">
                      {projectsNeedingSetup[0].project_name} - {projectsNeedingSetup[0].gc_name}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(createPageUrl("ProjectsSetup"))}
                  className="bg-red-600 hover:bg-red-700 ml-4"
                >
                  Review Projects
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-red-50 hover:border-red-500"
                onClick={() => navigate(createPageUrl('PendingReviews'))}
              >
                <Clock className="w-6 h-6 text-amber-600" />
                <span className="font-semibold">Review Pending COIs</span>
                {stats.pendingReviews > 0 && (
                  <Badge className="bg-amber-100 text-amber-700">{stats.pendingReviews} pending</Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-red-50 hover:border-red-500"
                onClick={() => navigate(createPageUrl('ExpiringPolicies'))}
              >
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <span className="font-semibold">Expiring Policies</span>
                {stats.expiringSoon > 0 && (
                  <Badge className="bg-red-100 text-red-700">{stats.expiringSoon} expiring</Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-purple-50 hover:border-purple-500"
                onClick={() => navigate(createPageUrl('Messages'))}
              >
                <MessageSquare className="w-6 h-6 text-purple-600" />
                <span className="font-semibold">Messages</span>
                {stats.unreadMessages > 0 && (
                  <Badge className="bg-purple-100 text-purple-700">{stats.unreadMessages} unread</Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-green-50 hover:border-green-500"
                onClick={() => navigate(createPageUrl('SubcontractorsManagement'))}
              >
                <Users className="w-6 h-6 text-green-600" />
                <span className="font-semibold">Manage Subcontractors</span>
                <Badge className="bg-green-100 text-green-700">{stats.totalSubs} total</Badge>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-rose-50 hover:border-rose-500"
                onClick={() => navigate(createPageUrl('contractors'))}
              >
                <Building2 className="w-6 h-6 text-indigo-600" />
                <span className="font-semibold">General Contractors</span>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-teal-50 hover:border-teal-500"
                onClick={() => navigate(createPageUrl('ProjectsSetup'))}
              >
                <Shield className="w-6 h-6 text-teal-600" />
                <span className="font-semibold">Project Setup</span>
                {stats.projectsNeedingSetup > 0 && (
                  <Badge className="bg-teal-100 text-teal-700">{stats.projectsNeedingSetup} need setup</Badge>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {stats.pendingReviews === 0 && stats.expiringSoon === 0 && stats.projectsNeedingSetup === 0 && stats.unreadMessages === 0 && (
          <Card className="border-emerald-200 shadow-lg bg-emerald-50">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-slate-600 text-lg">
                No pending tasks or urgent items requiring attention
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
