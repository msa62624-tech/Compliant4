import { useState, useMemo } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Archive, 
  ArchiveRestore, 
  Search, 
  Building2, 
  FolderOpen, 
  Users,
  ChevronDown,
  ChevronRight,
  Calendar,
  User
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";

export default function ArchivePage() {
  const _navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGCs, setExpandedGCs] = useState(new Set());
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  // Fetch archived contractors (GCs and Subs)
  const { data: archivedContractors = [], isLoading: loadingContractors } = useQuery({
    queryKey: ['archived-contractors'],
    queryFn: async () => {
      const response = await compliant.api.get('/entities/Contractor/archived');
      return response.data || [];
    },
    enabled: user?.role === 'super_admin' || user?.role === 'admin',
  });

  // Fetch archived projects
  const { data: archivedProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['archived-projects'],
    queryFn: async () => {
      const response = await compliant.api.get('/entities/Project/archived');
      return response.data || [];
    },
    enabled: user?.role === 'super_admin' || user?.role === 'admin',
  });

  // Fetch archived ProjectSubcontractors
  const { data: archivedProjectSubs = [], isLoading: loadingProjectSubs } = useQuery({
    queryKey: ['archived-project-subs'],
    queryFn: async () => {
      const response = await compliant.api.get('/entities/ProjectSubcontractor/archived');
      return response.data || [];
    },
    enabled: user?.role === 'super_admin' || user?.role === 'admin',
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async ({ entityName, id }) => {
      const response = await compliant.api.post(`/entities/${entityName}/${id}/unarchive`);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Successfully unarchived ${variables.entityName}`);
      queryClient.invalidateQueries(['archived-contractors']);
      queryClient.invalidateQueries(['archived-projects']);
      queryClient.invalidateQueries(['archived-project-subs']);
      queryClient.invalidateQueries(['contractors']);
      queryClient.invalidateQueries(['projects']);
    },
    onError: (error) => {
      toast.error(`Failed to unarchive: ${error.message}`);
    },
  });

  // Organize data hierarchically: GC → Projects → Subcontractors
  const hierarchicalData = useMemo(() => {
    const gcs = archivedContractors.filter(c => c.contractor_type === 'general_contractor');
    const subs = archivedContractors.filter(c => c.contractor_type === 'subcontractor');
    
    return gcs.map(gc => ({
      ...gc,
      projects: archivedProjects
        .filter(p => p.gc_id === gc.id)
        .map(project => ({
          ...project,
          subcontractors: archivedProjectSubs
            .filter(ps => ps.project_id === project.id)
            .map(ps => ({
              ...ps,
              subDetails: subs.find(s => s.id === ps.subcontractor_id)
            }))
        }))
    }));
  }, [archivedContractors, archivedProjects, archivedProjectSubs]);

  // Filter by search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return hierarchicalData;
    
    const query = searchQuery.toLowerCase();
    return hierarchicalData.filter(gc => 
      gc.company_name.toLowerCase().includes(query) ||
      gc.projects.some(p => 
        p.project_name.toLowerCase().includes(query) ||
        p.subcontractors.some(s => 
          s.subDetails?.company_name?.toLowerCase().includes(query)
        )
      )
    );
  }, [hierarchicalData, searchQuery]);

  const toggleGC = (gcId) => {
    setExpandedGCs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gcId)) {
        newSet.delete(gcId);
      } else {
        newSet.add(gcId);
      }
      return newSet;
    });
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleUnarchive = (entityName, id, name) => {
    if (confirm(`Are you sure you want to unarchive ${name}?`)) {
      unarchiveMutation.mutate({ entityName, id });
    }
  };

  const isLoading = loadingContractors || loadingProjects || loadingProjectSubs;

  // Check if user is admin
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Archive className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-slate-600">You need admin permissions to view archived items.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Archive className="w-8 h-8 text-red-600" />
              Archives
            </h1>
            <p className="text-slate-600 mt-1">View and manage archived contractors, projects, and subcontractors</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search archives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Loading archives...</p>
          </CardContent>
        </Card>
      ) : filteredData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Archive className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold mb-2">No Archived Items</h2>
            <p className="text-slate-600">
              {searchQuery ? "No items match your search." : "There are no archived items yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredData.map(gc => (
            <Card key={gc.id}>
              <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={() => toggleGC(gc.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedGCs.has(gc.id) ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    <Building2 className="w-5 h-5 text-red-600" />
                    <div>
                      <CardTitle className="text-lg">{gc.company_name}</CardTitle>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Archived: {new Date(gc.archivedAt).toLocaleDateString()}
                        </span>
                        {gc.archivedBy && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            By: {gc.archivedBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {gc.projects?.length || 0} Projects
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnarchive('Contractor', gc.id, gc.company_name);
                      }}
                    >
                      <ArchiveRestore className="w-4 h-4 mr-1" />
                      Unarchive
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {expandedGCs.has(gc.id) && (
                <CardContent>
                  {gc.archivedReason && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-900">
                        <strong>Reason:</strong> {gc.archivedReason}
                      </p>
                    </div>
                  )}
                  
                  {gc.projects && gc.projects.length > 0 ? (
                    <div className="space-y-3 pl-8">
                      {gc.projects.map(project => (
                        <Card key={project.id} className="border-l-4 border-l-blue-400">
                          <CardHeader 
                            className="cursor-pointer hover:bg-slate-50 py-3"
                            onClick={() => toggleProject(project.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedProjects.has(project.id) ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <FolderOpen className="w-4 h-4 text-red-500" />
                                <div>
                                  <h3 className="font-semibold">{project.project_name}</h3>
                                  <p className="text-sm text-slate-600">
                                    Archived: {new Date(project.archivedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  {project.subcontractors?.length || 0} Subs
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnarchive('Project', project.id, project.project_name);
                                  }}
                                >
                                  <ArchiveRestore className="w-3 h-3 mr-1" />
                                  Unarchive
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          {expandedProjects.has(project.id) && (
                            <CardContent className="py-3">
                              {project.archivedReason && (
                                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                  <strong>Reason:</strong> {project.archivedReason}
                                </div>
                              )}
                              
                              {project.subcontractors && project.subcontractors.length > 0 ? (
                                <div className="space-y-2 pl-6">
                                  {project.subcontractors.map(sub => (
                                    <div
                                      key={sub.id}
                                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Users className="w-4 h-4 text-slate-500" />
                                        <div>
                                          <p className="font-medium">
                                            {sub.subDetails?.company_name || 'Unknown Subcontractor'}
                                          </p>
                                          <p className="text-sm text-slate-600">
                                            Trades: {sub.trade_types?.join(', ') || 'N/A'}
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUnarchive(
                                          'ProjectSubcontractor', 
                                          sub.id, 
                                          sub.subDetails?.company_name || 'Subcontractor'
                                        )}
                                      >
                                        <ArchiveRestore className="w-3 h-3 mr-1" />
                                        Unarchive
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 pl-6">No archived subcontractors</p>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 pl-8">No archived projects</p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
