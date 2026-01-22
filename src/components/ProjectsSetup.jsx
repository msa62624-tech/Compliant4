import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ProjectsSetup() {
  const navigate = useNavigate();

  const { data: projects = [], isLoading: _isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.entities.Project.list('-created_date'),
  });

  const projectsNeedingSetup = projects.filter(p => p.needs_admin_setup);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Projects Setup
          </h1>
          <p className="text-slate-600">Configure insurance programs and additional insured requirements</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              Projects Awaiting Setup ({projectsNeedingSetup.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {projectsNeedingSetup.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  All Projects Configured!
                </h3>
                <p className="text-slate-600">
                  No projects currently need setup
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">Project Name</TableHead>
                      <TableHead className="font-semibold">General Contractor</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsNeedingSetup.map((project) => (
                      <TableRow key={project.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-medium text-slate-900">
                          {project.project_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {project.gc_name}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">
                          {project.address_city || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {project.created_date 
                            ? format(new Date(project.created_date), 'MMM d, yyyy')
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                            Needs Setup
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => navigate(createPageUrl(`ProjectDetails?id=${project.id}`))}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Configure
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
