import { useEffect, useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, AlertTriangle, Search, Users } from "lucide-react";
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

  // Fetch projects - don't filter by status, show all
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['gc-projects', gcId],
    queryFn: async () => {
      try {
        // Use public endpoint to fetch all projects, then filter by gc_id
        const { protocol, host, origin } = window.location;
        const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
        const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                           origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                           origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                           import.meta?.env?.VITE_API_BASE_URL || '';
        
        const response = await fetch(`${backendBase}/public/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const allProjects = await response.json();
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
        // Use public endpoint to fetch all project subcontractors
        const { protocol, host, origin } = window.location;
        const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
        const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                           origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                           origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                           import.meta?.env?.VITE_API_BASE_URL || '';
        
        const response = await fetch(`${backendBase}/public/all-project-subcontractors`);
        if (!response.ok) throw new Error('Failed to fetch subcontractors');
        const allSubs = await response.json();
        
        // Filter to only show subcontractors for projects owned by this GC
        const projectIds = new Set(projects.map(p => p.id));
        return allSubs.filter(ps => projectIds.has(ps.project_id));
      } catch (err) {
        console.error('Error fetching subcontractors:', err);
        return [];
      }
    },
    enabled: !!gcId && projects.length > 0,
    retry: 1,
  });

  // Fetch COIs to determine actual compliance status
  const { data: cois = [] } = useQuery({
    queryKey: ['gc-cois', gcId],
    queryFn: async () => {
      try {
        // Use public endpoint to fetch all COIs
        const { protocol, host, origin } = window.location;
        const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
        const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                           origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                           origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                           import.meta?.env?.VITE_API_BASE_URL || '';
        
        const response = await fetch(`${backendBase}/public/all-cois`);
        if (!response.ok) throw new Error('Failed to fetch COIs');
        const allCois = await response.json();
        
        // Filter to COIs for this GC's projects
        const projectIds = new Set(projects.map(p => p.id));
        return allCois.filter(coi => projectIds.has(coi.project_id));
      } catch (err) {
        console.error('Error fetching COIs:', err);
        return [];
      }
    },
    enabled: !!gcId && projects.length > 0,
    retry: 1,
  });

  // Helper function to get actual status for a subcontractor
  const getActualStatus = (sub) => {
    const relatedCois = cois.filter(c => 
      c.subcontractor_id === sub.subcontractor_id || c.project_sub_id === sub.id
    );
    
    if (relatedCois.length === 0) {
      console.log(`[${sub.subcontractor_name}] No COIs found, returning: ${sub.compliance_status || 'pending_broker'}`);
      return sub.compliance_status || 'pending_broker';
    }
    
    // Find the most recent COI
    const latestCoi = relatedCois.sort((a, b) => {
      const aDate = new Date(a.created_date || 0);
      const bDate = new Date(b.created_date || 0);
      return bDate - aDate;
    })[0];
    
    console.log(`[${sub.subcontractor_name}] Found COI with status: ${latestCoi.status}`, latestCoi);
    
    // Map COI status to compliance status
    if (latestCoi.status === 'approved' || latestCoi.status === 'compliant') {
      return 'compliant';
    } else if (latestCoi.status === 'awaiting_admin_review') {
      return 'awaiting_admin_review';
    } else if (latestCoi.status === 'awaiting_broker_upload') {
      return 'awaiting_broker_upload';
    }
    
    return latestCoi.status || sub.compliance_status || 'pending_broker';
  };

  // Log COI data for debugging
  React.useEffect(() => {
    console.log('🔍 GC Dashboard Debug:', {
      gcId,
      projectsCount: projects.length,
      coisCount: cois.length,
      subsCount: projectSubs.length,
      searchTerm,
      searchType,
      filteredProjectsCount: filteredProjects.length,
      coisData: cois.slice(0, 3) // First 3 COIs
    });
  }, [cois, projects, projectSubs, gcId, searchTerm, searchType, filteredProjects]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                General Contractor Portal
              </h1>
              <p className="text-sm text-slate-600">Manage Your Projects & Subcontractors</p>
            </div>
            <UserProfile 
              user={{ 
                id: gcId, 
                name: `General Contractor (${gcId})`,
                email: '',
                role: 'gc'
              }}
              companyName={`General Contractor (${gcId})`}
              companyId={gcId}
            />
          </div>
          {/* GC portal: view/manage subs only - no project creation */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-8">

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
                    
                    // If searching by subcontractor, filter the subs to show only matching ones
                    let displaySubsList = projectSubsList;
                    if (searchType === 'subcontractor' && searchTerm) {
                      const searchLower = searchTerm.toLowerCase();
                      displaySubsList = projectSubsList.filter(ps => 
                        ps.subcontractor_name?.toLowerCase().includes(searchLower)
                      );
                    }
                    
                    const compliantCount = displaySubsList.filter(ps => {
                      const actualStatus = getActualStatus(ps);
                      return actualStatus === 'compliant';
                    }).length;

                    return (
                      <TableRow
                        key={project.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/gc-project?project=${project.id}&id=${gcId}`)}
                      >
                        <TableCell className="font-medium">{project.project_name}</TableCell>
                        <TableCell className="text-slate-600">{project.address || 'Address not provided'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold text-emerald-700">{compliantCount}</span>
                            <span className="text-slate-500"> / {displaySubsList.length} compliant</span>
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

        {/* Subcontractor Details when searching by subcontractor */}
        {searchType === 'subcontractor' && searchTerm && (
          <Card className="mt-6">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Matching Subcontractors ({filteredProjects.length} projects found)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProjects.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No subcontractors found matching "{searchTerm}"
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Company</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.flatMap((project) => {
                      const projectSubsList = projectSubs.filter(ps => ps.project_id === project.id);
                      const searchLower = searchTerm.toLowerCase();
                      const matchingSubs = projectSubsList.filter(ps => 
                        ps.subcontractor_name?.toLowerCase().includes(searchLower)
                      );
                      
                      console.log(`Project ${project.project_name}: ${matchingSubs.length} matching subs`);
                      
                      return matchingSubs.map((sub) => {
                        const status = getActualStatus(sub);
                        const statusColor = status === 'compliant' ? 'bg-emerald-50 text-emerald-700' :
                                           status === 'awaiting_broker_upload' ? 'bg-yellow-50 text-yellow-700' :
                                           status === 'awaiting_admin_review' ? 'bg-blue-50 text-blue-700' :
                                           'bg-slate-100 text-slate-700';
                        
                        return (
                          <TableRow key={sub.id} className="hover:bg-slate-50">
                            <TableCell className="font-medium">{sub.subcontractor_name}</TableCell>
                            <TableCell>{sub.trade_type || 'N/A'}</TableCell>
                            <TableCell className="text-slate-600">{project.project_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColor}>
                                {status === 'compliant' ? '✓ Compliant' :
                                 status === 'awaiting_broker_upload' ? 'Awaiting Broker' :
                                 status === 'awaiting_admin_review' ? 'Under Review' :
                                 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}