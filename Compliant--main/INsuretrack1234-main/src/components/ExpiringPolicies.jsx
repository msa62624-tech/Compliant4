
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ExpiringPolicies() {
  const navigate = useNavigate();

  const { data: activeCOIs = [], isLoading: _isLoading } = useQuery({
    queryKey: ['active-cois'],
    queryFn: async () => {
      const cois = await compliant.entities.GeneratedCOI.list();
      return cois.filter(c => c.status === 'active');
    },
  });

  // Check for expiring COIs (within 30 days)
  const expiringSoon = activeCOIs.filter(coi => {
    if (!coi.gl_expiration_date) return false;
    const daysUntil = differenceInDays(new Date(coi.gl_expiration_date), new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  }).sort((a, b) => {
    const daysA = differenceInDays(new Date(a.gl_expiration_date), new Date());
    const daysB = differenceInDays(new Date(b.gl_expiration_date), new Date());
    return daysA - daysB;
  });

  const getSeverityColor = (daysLeft) => {
    if (daysLeft <= 5) return "bg-red-100 text-red-700 border-red-300";
    if (daysLeft <= 15) return "bg-amber-100 text-amber-700 border-amber-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Expiring Policies
          </h1>
          <p className="text-slate-600">Monitor and manage upcoming policy expirations</p>
        </div>

        {expiringSoon.length > 0 ? (
          <Card className="border-red-200 shadow-lg">
            <CardHeader className="border-b border-red-200 bg-red-50">
              <CardTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Policies Expiring Within 30 Days ({expiringSoon.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Subcontractor</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">GL Expiration</TableHead>
                    <TableHead className="font-semibold">Days Left</TableHead>
                    <TableHead className="font-semibold">Broker</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringSoon.map((coi) => {
                    const daysLeft = differenceInDays(new Date(coi.gl_expiration_date), new Date());
                    return (
                      <TableRow key={coi.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">
                          {coi.subcontractor_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {coi.project_name}
                        </TableCell>
                        <TableCell className="text-red-700 font-medium">
                          {format(new Date(coi.gl_expiration_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(daysLeft)}>
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {coi.broker_company || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(createPageUrl(`SubcontractorView?name=${encodeURIComponent(coi.subcontractor_name)}`))}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Contact
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No Expiring Policies
              </h3>
              <p className="text-slate-600">
                All policies are current or have sufficient time before expiration
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
