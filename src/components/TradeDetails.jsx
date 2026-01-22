
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, FolderOpen, Clock, ListChecks } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TradeDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const tradeName = urlParams.get('trade');

  const { data: subsWithTrade = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ['subs-by-trade', tradeName],
    queryFn: async () => {
      const allSubs = await compliant.entities.Contractor.filter({ 
        contractor_type: 'subcontractor'
      });
      
      // Flexible trade matching - case insensitive and partial match
      return allSubs.filter(sub => {
        const tradeNameLower = (tradeName || '').toLowerCase();
        
        // Check trade_types array first
        if (sub.trade_types && Array.isArray(sub.trade_types) && sub.trade_types.length > 0) {
          return sub.trade_types.some(trade => {
            const tradeLower = trade.toLowerCase();
            // Exact match OR partial match (e.g., "Roofing" matches "Roofers", "Roofing Contractor")
            return tradeLower === tradeNameLower || 
                   tradeLower.includes(tradeNameLower) || 
                   tradeNameLower.includes(tradeLower);
          });
        }
        
        // Fall back to legacy trade_type field
        if (sub.trade_type) {
          const tradeLower = sub.trade_type.toLowerCase();
          return tradeLower === tradeNameLower || 
                 tradeLower.includes(tradeNameLower) || 
                 tradeNameLower.includes(tradeLower);
        }
        
        return false;
      });
    },
    enabled: !!tradeName,
  });

  const { data: allProjectSubs = [], isLoading: allProjectSubsLoading } = useQuery({
    queryKey: ['all-project-subs'],
    queryFn: () => compliant.entities.ProjectSubcontractor.list(),
  });

  const { data: allProjects = [], isLoading: allProjectsLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => compliant.entities.Project.list(),
  });

  const { data: allCOIs = [], isLoading: allCOIsLoading } = useQuery({
    queryKey: ['all-generated-cois'],
    queryFn: () => compliant.entities.GeneratedCOI.list(),
  });

  const { data: tradeRequirements = [], isLoading: tradeRequirementsLoading } = useQuery({
    queryKey: ['trade-requirements', tradeName],
    queryFn: () => compliant.entities.TradeRequirement.filter({ trade_name: tradeName }),
    enabled: !!tradeName,
  });

  const getSubProjects = (subName) => {
    const subProjectRecords = allProjectSubs.filter(ps => ps.subcontractor_name === subName);
    return subProjectRecords.map(ps => {
      const project = allProjects.find(p => p.id === ps.project_id);
      return {
        ...ps,
        project_details: project
      };
    });
  };

  const getSubInsurance = (subName) => {
    return allCOIs.filter(coi => coi.subcontractor_name === subName);
  };

  const _getInsuranceStatus = (subName) => {
    const cois = getSubInsurance(subName);
    if (cois.length === 0) return { status: 'none', label: 'No Insurance', color: 'slate' };
    
    const activeCOI = cois.find(coi => coi.status === 'active');
    if (activeCOI) {
      // Check if policies are expiring soon
      const glExpiry = activeCOI.gl_expiration_date ? new Date(activeCOI.gl_expiration_date) : null;
      if (glExpiry) {
        const daysUntilExpiry = Math.floor((glExpiry - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) return { status: 'expired', label: 'Expired', color: 'red' };
        if (daysUntilExpiry < 30) return { status: 'expiring', label: `Exp in ${daysUntilExpiry}d`, color: 'amber' };
      }
      return { status: 'active', label: 'Active', color: 'emerald' };
    }
    
    const awaitingBroker = cois.find(coi => coi.status === 'awaiting_broker_upload' || coi.status === 'awaiting_broker_info');
    if (awaitingBroker) return { status: 'pending', label: 'Awaiting Broker', color: 'blue' };
    
    return { status: 'unknown', label: 'Unknown', color: 'slate' };
  };

  // Calculate unique projects across all subs in this trade
  const uniqueProjectIds = new Set();
  if (!allProjectSubsLoading && !allProjectsLoading) {
    subsWithTrade.forEach(sub => {
      const projectsForSub = getSubProjects(sub.company_name);
      projectsForSub.forEach(proj => {
        if (proj.project_id) {
          uniqueProjectIds.add(proj.project_id);
        }
      });
    });
  }
  const uniqueProjects = Array.from(uniqueProjectIds).length;

  const stats = {
    totalSubs: subsWithTrade.length,
    activeProjects: uniqueProjects,
    pendingCOIs: subsWithTrade.filter(sub => {
      const subCOIs = allCOIs.filter(c => c.subcontractor_name === sub.company_name);
      return subCOIs.some(c => c.status === 'awaiting_broker_info' || c.status === 'awaiting_broker_upload');
    }).length,
    avgRequirements: tradeRequirements.length,
  };

  if (!tradeName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">No trade specified</p>
            <Button onClick={() => navigate(createPageUrl("TradesManagement"))}>
              Back to Trades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("TradesManagement"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{tradeName}</h1>
            <p className="text-slate-600">Subcontractors specializing in this trade</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Subs</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalSubs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active Projects</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.activeProjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending COIs</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pendingCOIs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <ListChecks className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Requirements</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.avgRequirements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">
              Subcontractors in {tradeName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {contractorsLoading || allProjectSubsLoading || allCOIsLoading || tradeRequirementsLoading ? (
              <div className="p-6 space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : subsWithTrade.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  No Subcontractors Yet
                </h3>
                <p className="text-slate-600 mb-4">
                  No subcontractors are currently registered for the <strong>{tradeName}</strong> trade.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-red-900 font-medium">
                    Subcontractors are automatically added here when:
                  </p>
                  <ul className="text-sm text-red-800 mt-2 space-y-1 text-left">
                    <li>• A project adds them with this trade</li>
                    <li>• Their contractor profile includes this trade</li>
                  </ul>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Company Name</TableHead>
                    <TableHead>All Trades</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Insurance Status</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsWithTrade.map((sub) => {
                    const subProjects = allProjectSubs.filter(ps => ps.subcontractor_name === sub.company_name);
                    const subCOIs = allCOIs.filter(c => c.subcontractor_name === sub.company_name);
                    const activeCOI = subCOIs.find(c => c.status === 'active');
                    
                    // Get all trades for this sub
                    const allSubTrades = sub.trade_types && sub.trade_types.length > 0
                      ? sub.trade_types
                      : (sub.trade_type ? [sub.trade_type] : []);

                    return (
                      <TableRow key={sub.id} className="hover:bg-slate-50">
                        <TableCell 
                          className="font-medium text-slate-900 cursor-pointer hover:text-red-600"
                          onClick={() => navigate(createPageUrl(`SubcontractorView?name=${sub.company_name}`))}
                        >
                          {sub.company_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {allSubTrades.length > 0 ? (
                              <>
                                {allSubTrades.map((trade, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="outline" 
                                    className={trade.toLowerCase() === tradeName.toLowerCase() ? 'bg-red-100 text-red-700 border-red-300 font-bold' : ''}
                                  >
                                    {trade}
                                  </Badge>
                                ))}
                              </>
                            ) : (
                              <span className="text-xs text-slate-500">No trades listed</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {sub.email || 'No email'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {subProjects.length} project{subProjects.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {activeCOI?.broker_company || 'Not set'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              activeCOI
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }
                          >
                            {activeCOI ? 'Active COI' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(createPageUrl(`SubcontractorView?name=${sub.company_name}`))}
                            >
                              View Details
                            </Button>
                            {subProjects.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const firstProject = subProjects[0];
                                  navigate(createPageUrl(`ProjectDetails?id=${firstProject.project_id}`));
                                }}
                                className="text-red-600"
                              >
                                View Projects
                              </Button>
                            )}
                          </div>
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
