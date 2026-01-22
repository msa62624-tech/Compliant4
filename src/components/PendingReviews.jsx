
import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Clock, Eye, CheckCircle2} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PendingReviews() {
  const navigate = useNavigate();

  const { data: pendingCOIs = [], isLoading: coisLoading } = useQuery({
    queryKey: ['pending-coi-reviews'],
    queryFn: async () => {
      const cois = await apiClient.entities.GeneratedCOI.list('-uploaded_for_review_date');
      return cois.filter(c => c.status === 'awaiting_admin_review');
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const getSeverityBadge = (analysis) => {
    if (!analysis || !analysis.policy_analysis) return null;
    
    let criticalCount = 0;
    Object.values(analysis.policy_analysis).forEach(policy => {
      if (policy.has_condo_exclusion) criticalCount++;
      if (policy.has_height_limitation) criticalCount++;
      if (policy.has_hammer_clause) criticalCount++;
      if (policy.has_action_over_exclusion) criticalCount++;
    });

    if (criticalCount > 0) {
      return <Badge className="bg-red-100 text-red-700 border-red-300">{criticalCount} Critical Issues</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 border-green-300">No Critical Issues</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Pending COI Reviews
          </h1>
          <p className="text-slate-600">Review and approve insurance certificates</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Awaiting Admin Review ({pendingCOIs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {coisLoading ? (
              <div className="p-6 space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : pendingCOIs.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  All Caught Up!
                </h3>
                <p className="text-slate-600">
                  No pending COI reviews at the moment
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                {pendingCOIs.map((coi) => (
                  <Card key={coi.id} className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow cursor-pointer bg-amber-50 border-slate-200" onClick={() => navigate(createPageUrl(`COIReview?id=${coi.id}`))}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900">{coi.subcontractor_name}</h3>
                            <p className="text-sm text-slate-600 mt-1">{coi.project_name}</p>
                            <p className="text-xs text-slate-500">{coi.gc_name}</p>
                          </div>
                          <Badge variant="destructive" className="bg-amber-600 shrink-0">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-white rounded p-3">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Trade Type</p>
                            <p className="text-sm font-medium text-slate-900 mt-1">{coi.trade_type || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Broker</p>
                            <p className="text-sm font-medium text-slate-900 mt-1">{coi.broker_name || coi.broker_company || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Uploaded</p>
                            <p className="text-sm font-medium text-slate-900 mt-1">
                              {coi.uploaded_for_review_date 
                                ? format(new Date(coi.uploaded_for_review_date), 'MMM d')
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Status</p>
                            {getSeverityBadge(coi)}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(createPageUrl(`COIReview?id=${coi.id}`));
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Review & Approve
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
