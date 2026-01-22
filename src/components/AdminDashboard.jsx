import { useState, useEffect } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, FileText, AlertTriangle, CheckCircle2, Clock, Building2, MessageSquare, Search } from "lucide-react";
import StatsCard from "@/components/insurance/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { initDeficiencyReminderSystem } from "@/deficiencyReminderSystem";
import NotificationPanel from "@/components/NotificationPanel.jsx";
import NotificationBadge from "@/components/NotificationBadge.jsx";
import UserProfile from "@/components/UserProfile.jsx";
import AdminCOIApprovalDashboard from "@/components/AdminCOIApprovalDashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper function to get search type label
const getSearchTypeLabel = (type) => {
  const labels = {
    gc: 'general contractor',
    trade: 'trade',
    carrier: 'insurance carrier',
    subcontractor: 'subcontractor'
  };
  return labels[type] || type;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState("gc");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFeedback, setSearchFeedback] = useState(null);

  // Initialize deficiency reminder system on component mount
  useEffect(() => {
    initDeficiencyReminderSystem();
  }, []);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        return await apiClient.auth.me();
      } catch (error) {
        console.error('Failed to fetch current user:', error);
        return { name: 'Miriam Sabel', email: 'miriamsabel@insuretrack.onmicrosoft.com', role: 'admin' };
      }
    }
  });


  const { data: pendingCOIs = [], isLoading: pendingLoading, error: pendingError } = useQuery({
    queryKey: ["pending-coi-reviews"],
    queryFn: async () => {
      try {
        const cois = await apiClient.entities.GeneratedCOI.list("-uploaded_for_review_date");
        // Filter by assigned admin if user is assistant admin, show all if super admin
        let filtered = cois.filter((c) => c.status === "awaiting_admin_review");
        if (currentUser?.role === 'admin' && currentUser?.email) {
          filtered = filtered.filter(c => !c.assigned_admin_email || c.assigned_admin_email === currentUser.email);
        }
        return filtered;
      } catch (error) {
        console.error('❌ Error fetching pending COIs:', error);
        throw error;
      }
    },
    enabled: !!currentUser, // Only run when user is loaded
  });

  const { data: activeCOIs = [], isLoading: activeLoading, error: activeError } = useQuery({
    queryKey: ["active-cois"],
    queryFn: async () => {
      try {
        const cois = await apiClient.entities.GeneratedCOI.list();
        // Filter by assigned admin if user is assistant admin, show all if super admin
        let filtered = cois.filter((c) => c.status === "active");
        if (currentUser?.role === 'admin' && currentUser?.email) {
          filtered = filtered.filter(c => !c.assigned_admin_email || c.assigned_admin_email === currentUser.email);
        }
        return filtered;
      } catch (error) {
        console.error('❌ Error fetching active COIs:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
  });

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        const allProjects = await apiClient.entities.Project.list("-created_date");
        // Filter by assigned admin if user is assistant admin, show all if super admin
        if (currentUser?.role === 'admin' && currentUser?.email) {
          return allProjects.filter(p => !p.assigned_admin_email || p.assigned_admin_email === currentUser.email);
        }
        return allProjects;
      } catch (error) {
        console.error('❌ Error fetching projects:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
  });

  const { data: allSubs = [], isLoading: subsLoading, error: subsError } = useQuery({
    queryKey: ["all-subs"],
    queryFn: async () => {
      try {
        const subs = await apiClient.entities.Contractor.filter({ contractor_type: "subcontractor" });
        // Filter by assigned admin if user is assistant admin, show all if super admin
        if (currentUser?.role === 'admin' && currentUser?.email) {
          return subs.filter(s => !s.assigned_admin_email || s.assigned_admin_email === currentUser.email);
        }
        return subs;
      } catch (error) {
        console.error('❌ Error fetching subcontractors:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
  });

  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ["recent-messages"],
    queryFn: async () => {
      try {
        const allMessages = await apiClient.entities.Message.list("-created_date");
        // Super admin should NOT see messages from assistant admins (only their own)
        // Assistant admins only see their own messages
        if (currentUser?.role === 'super_admin') {
          // Filter out messages where sender or recipient is an assistant admin
          return allMessages.filter(msg => {
            // Only show messages where both sender and recipient are NOT assistant admins
            // or messages sent/received by the super admin themselves
            return msg.recipient_id === currentUser.id || msg.sender_id === currentUser.id;
          });
        } else if (currentUser?.role === 'admin') {
          // Assistant admins only see their own messages
          return allMessages.filter(msg => 
            msg.recipient_id === currentUser.email || msg.sender_id === currentUser.email ||
            msg.recipient_id === currentUser.id || msg.sender_id === currentUser.id
          );
        }
        return allMessages;
      } catch (error) {
        console.error('❌ Error fetching messages:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
  });

  // Fetch GCs for search
  const { data: allGCs = [] } = useQuery({
    queryKey: ["all-gcs"],
    queryFn: async () => {
      try {
        const contractors = await apiClient.entities.Contractor.list();
        return contractors.filter(c => c.contractor_type === 'general_contractor');
      } catch (error) {
        console.error('❌ Error fetching GCs:', error);
        return [];
      }
    },
    enabled: !!currentUser,
  });

  // Fetch Trades for search
  const { data: allTrades = [] } = useQuery({
    queryKey: ["all-trades"],
    queryFn: async () => {
      try {
        return await apiClient.entities.Trade.list();
      } catch (error) {
        console.error('❌ Error fetching trades:', error);
        return [];
      }
    },
    enabled: !!currentUser,
  });

  // Perform search based on search type and term
  const performSearch = () => {
    if (!searchTerm.trim()) {
      return;
    }

    // Clear any previous feedback
    setSearchFeedback(null);

    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    let found = false;

    if (searchType === "gc") {
      const matchedGC = allGCs.find(gc => 
        gc.company_name?.toLowerCase().includes(lowerSearchTerm) ||
        gc.entity_name?.toLowerCase().includes(lowerSearchTerm)
      );
      if (matchedGC) {
        navigate(createPageUrl(`GCDetails?id=${matchedGC.id}`));
        found = true;
      }
    } else if (searchType === "trade") {
      const matchedTrade = allTrades.find(t => 
        t.trade_name?.toLowerCase().includes(lowerSearchTerm)
      );
      if (matchedTrade) {
        // Navigate to a page showing projects/subs with this trade
        // For now, we'll navigate to contractors with a trade filter
        navigate(createPageUrl(`contractors?trade=${matchedTrade.trade_name}`));
        found = true;
      }
    } else if (searchType === "carrier") {
      // Search for insurance carriers in COIs
      const matchedCOI = [...pendingCOIs, ...activeCOIs].find(coi =>
        coi.gl_carrier?.toLowerCase().includes(lowerSearchTerm) ||
        coi.auto_carrier?.toLowerCase().includes(lowerSearchTerm) ||
        coi.wc_carrier?.toLowerCase().includes(lowerSearchTerm) ||
        coi.umbrella_carrier?.toLowerCase().includes(lowerSearchTerm)
      );
      if (matchedCOI) {
        navigate(createPageUrl(`COIReview?id=${matchedCOI.id}`));
        found = true;
      }
    } else if (searchType === "subcontractor") {
      const matchedSub = allSubs.find(sub =>
        sub.company_name?.toLowerCase().includes(lowerSearchTerm) ||
        sub.entity_name?.toLowerCase().includes(lowerSearchTerm)
      );
      if (matchedSub) {
        navigate(createPageUrl(`SubcontractorsManagement?search=${matchedSub.company_name}`));
        found = true;
      }
    }

    // Show feedback if no match was found
    if (!found) {
      setSearchFeedback(`No ${getSearchTypeLabel(searchType)} found matching "${searchTerm}". Please try a different search term.`);
    }
  };

  const expiringSoon = activeCOIs.filter((coi) => {
    if (!coi.gl_expiration_date) return false;
    const daysUntil = differenceInDays(new Date(coi.gl_expiration_date), new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  });

  const projectsNeedingSetup = Array.isArray(projects) ? projects.filter((p) => p.needs_admin_setup) : [];
  const unreadMessages = Array.isArray(messages) ? messages.filter((m) => !m.is_read).length : 0;

  const stats = {
    pendingReviews: pendingCOIs.length,
    expiringSoon: expiringSoon.length,
    projectsNeedingSetup: projectsNeedingSetup.length,
    totalSubs: allSubs.length,
    unreadMessages,
  };

  // Check for loading or errors
  const isLoading = pendingLoading || activeLoading || projectsLoading || subsLoading || messagesLoading;
  const hasError = pendingError || activeError || projectsError || subsError || messagesError;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Profile */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-slate-600">Welcome back, {currentUser?.name || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBadge recipientId="admin" recipientType="admin" />
            <UserProfile 
              user={currentUser} 
              companyName="compliant.team Administration"
            />
          </div>
        </div>

        {/* Error Alert */}
        {hasError && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              Error loading dashboard data. Please check console for details or try refreshing the page.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading dashboard...</p>
          </div>
        )}

        {/* Search Section */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Quick Search
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={searchType} onValueChange={(value) => {
                setSearchType(value);
                setSearchFeedback(null); // Clear feedback when search type changes
              }}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Search type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gc">General Contractor</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                  <SelectItem value="carrier">Insurance Carrier</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder={`Search for ${getSearchTypeLabel(searchType)}...`}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchFeedback(null); // Clear feedback when user types
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                  className="flex-1"
                />
                <Button onClick={performSearch} disabled={!searchTerm.trim()}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Search by name to quickly find and navigate to GCs, trades, carriers, or subcontractors
            </p>
          </CardContent>
        </Card>

        {/* Search Feedback Alert */}
        {searchFeedback && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-900">
              {searchFeedback}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div onClick={() => navigate(createPageUrl("PendingReviews"))} className="cursor-pointer">
            <StatsCard
              title="Pending Reviews"
              value={stats.pendingReviews}
              icon={Clock}
              color="amber"
              subtitle="Need your attention"
            />
          </div>
          <div onClick={() => navigate(createPageUrl("ExpiringPolicies"))} className="cursor-pointer">
            <StatsCard
              title="Expiring Soon"
              value={stats.expiringSoon}
              icon={AlertTriangle}
              color="red"
              subtitle="Within 30 days"
            />
          </div>
          <div onClick={() => navigate(createPageUrl("ProjectsSetup"))} className="cursor-pointer">
            <StatsCard
              title="Projects Setup"
              value={stats.projectsNeedingSetup}
              icon={FileText}
              color="blue"
              subtitle="Awaiting configuration"
            />
          </div>
          <div onClick={() => navigate(createPageUrl("Messages"))} className="cursor-pointer">
            <StatsCard
              title="Messages"
              value={stats.unreadMessages}
              icon={MessageSquare}
              color="blue"
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
                    <strong>{projectsNeedingSetup.length} new project{projectsNeedingSetup.length !== 1 ? "s" : ""}</strong> need{projectsNeedingSetup.length === 1 ? "s" : ""} insurance program assignment.
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

        {/* Notification Panel */}
        <div className="mb-6">
          <NotificationPanel 
            recipientId="admin"
            recipientType="admin"
            onNotificationClick={(notification) => {
              // Navigate to the related entity when notification is clicked
              if (notification.related_entity === 'GeneratedCOI' && notification.related_entity_id) {
                navigate(createPageUrl(`COIReview?id=${notification.related_entity_id}`));
              }
            }}
          />
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-red-50 hover:border-red-500"
                onClick={() => navigate(createPageUrl("PendingReviews"))}
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
                onClick={() => navigate(createPageUrl("ExpiringPolicies"))}
              >
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <span className="font-semibold">Expiring Policies</span>
                {stats.expiringSoon > 0 && (
                  <Badge className="bg-red-100 text-red-700">{stats.expiringSoon} expiring</Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-red-50 hover:border-red-500"
                onClick={() => navigate(createPageUrl("Messages"))}
              >
                <MessageSquare className="w-6 h-6 text-red-600" />
                <span className="font-semibold">Messages</span>
                {stats.unreadMessages > 0 && (
                  <Badge className="bg-red-100 text-red-700">{stats.unreadMessages} unread</Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-green-50 hover:border-green-500"
                onClick={() => navigate(createPageUrl("SubcontractorsManagement"))}
              >
                <Users className="w-6 h-6 text-green-600" />
                <span className="font-semibold">Manage Subcontractors</span>
                <Badge className="bg-green-100 text-green-700">{stats.totalSubs} total</Badge>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-rose-50 hover:border-rose-500"
                onClick={() => navigate(createPageUrl("contractors"))}
              >
                <Building2 className="w-6 h-6 text-indigo-600" />
                <span className="font-semibold">General Contractors</span>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:bg-teal-50 hover:border-teal-500"
                onClick={() => navigate(createPageUrl("ProjectsSetup"))}
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

        {/* COI Approval Dashboard Section */}
        <AdminCOIApprovalDashboard />

        {stats.pendingReviews === 0 && stats.expiringSoon === 0 && stats.projectsNeedingSetup === 0 && stats.unreadMessages === 0 && (
          <Card className="border-emerald-200 shadow-lg bg-emerald-50">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-2xl font-bold text-emerald-900 mb-2">All systems are green</h3>
              <p className="text-emerald-800">No pending reviews, expiring policies, or setup tasks at the moment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
