import { useEffect, useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, AlertTriangle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserProfile from "@/components/UserProfile.jsx";
import NotificationBanner from "@/components/NotificationBanner.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GCDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  const gcId = urlParams.get('id');
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all');


  // Set public access mode
  useEffect(() => {
    if (gcId) {
      sessionStorage.setItem('public_access_enabled', 'true');
    }
  }, [gcId]);

  // Fetch GC data
  const { data: contractor, isLoading: contractorLoading, error: contractorError } = useQuery({
    queryKey: ['gc-contractor', gcId],
    queryFn: async () => {
      try {
        const allContractors = await compliant.entities.Contractor.list();
        const gc = allContractors.find(c => c.id === gcId);
        if (!gc) {
          console.warn(`Contractor ${gcId} not found`);
          return null;
        }
        return gc;
      } catch (err) {
        console.error('Error fetching contractor:', err);
        return null;
      }
    },
    enabled: !!gcId,
    retry: 1,
  });

  // Fetch projects - don't filter by status, show all
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['gc-projects', gcId],
    queryFn: async () => {
      try {
        const allProjects = await compliant.entities.Project.list();
        return allProjects.filter(p => p.gc_id === gcId);
      } catch (err) {
        console.error('Error fetching projects:', err);
        return [];
      }
    },
    enabled: !!gcId,
    retry: 1,
  });

  // Fetch subcontractors
  const { data: projectSubs = [] } = useQuery({
    queryKey: ['gc-subs', gcId],
    queryFn: async () => {
      try {
        const allSubs = await compliant.entities.ProjectSubcontractor.list();
        return allSubs.filter(ps => ps.gc_id === gcId);
      } catch (err) {
        console.error('Error fetching subcontractors:', err);
        return [];
      }
    },
    enabled: !!gcId,
    retry: 1,
  });

  // Filter projects and subs based on search
  const filteredProjects = projects.filter(project => {
    const searchLower = searchTerm.toLowerCase();
    
    if (!searchTerm) return true;
    
    if (searchType === 'all') {
      const projectSubsList = projectSubs.filter(ps => ps.project_id === project.id);
      const hasMatchingSub = projectSubsList.some(ps => 
        ps.subcontractor_name?.toLowerCase().includes(searchLower)
      );
      return (
        project.project_name?.toLowerCase().includes(searchLower) ||
        project.project_address?.toLowerCase().includes(searchLower) ||
        hasMatchingSub
      );
    } else if (searchType === 'job') {
      return (
        project.project_name?.toLowerCase().includes(searchLower) ||
        project.project_address?.toLowerCase().includes(searchLower)
      );
    } else if (searchType === 'subcontractor') {
      const projectSubsList = projectSubs.filter(ps => ps.project_id === project.id);
      return projectSubsList.some(ps => 
        ps.subcontractor_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  if (!gcId) {
    console.warn('❌ No GC ID provided in URL');
    console.warn('   Full URL:', window.location.href);
    console.warn('   Search params:', window.location.search);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Access</h2>
            <p className="text-slate-600">Please use the link from your email to access your portal.</p>
            <p className="text-xs text-slate-500 mt-4">Debug: No ID parameter found in URL</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contractorError) {
    console.error('❌ Error loading contractor:', contractorError);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error Loading Portal</h2>
            <p className="text-slate-600">{contractorError?.message || 'Failed to load contractor data'}</p>
            <p className="text-xs text-slate-500 mt-4">Please refresh the page or contact support</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contractorLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading your portal...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                {contractor?.company_name || `General Contractor (${gcId})`}
              </h1>
              <p className="text-sm text-slate-600">General Contractor Portal</p>
            </div>
            <UserProfile 
              user={{ 
                id: gcId, 
                name: contractor?.contact_person || contractor?.company_name,
                email: contractor?.email,
                role: 'gc'
              }}
              companyName={contractor?.company_name}
              companyId={gcId}
            />
          </div>
          {/* GC portal: view/manage subs only - no project creation */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Notification Banner */}
        {contractor?.email && (
          <NotificationBanner gcEmail={contractor.email} />
        )}

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Your Projects
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-3">
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    <SelectItem value="job">Job/Project</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={`Search ${searchType === 'all' ? 'all fields' : searchType === 'job' ? 'by job/project' : 'by subcontractor'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projectsLoading ? (
              <div className="p-6 space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {searchTerm ? 'No matching projects' : 'No projects assigned'}
                </h3>
                <p className="text-slate-600">
                  {searchTerm ? 'Try a different search term' : 'Contact your administrator to have projects added to your portal.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Project</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Subcontractors</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const projectSubsList = projectSubs.filter(ps => ps.project_id === project.id);
                    const compliantCount = projectSubsList.filter(ps => ps.compliance_status === 'compliant').length;

                    return (
                      <TableRow
                        key={project.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/gc-project?project=${project.id}&id=${gcId}`)}
                      >
                        <TableCell className="font-medium">{project.project_name}</TableCell>
                        <TableCell className="text-slate-600">{project.project_address || 'Address not provided'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold text-emerald-700">{compliantCount}</span>
                            <span className="text-slate-500"> / {projectSubsList.length} compliant</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                            {project.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gc-project?project=${project.id}&id=${gcId}`);
                          }}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}