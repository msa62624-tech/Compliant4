import { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, CheckCircle2, AlertTriangle, XCircle, Search, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { createPageUrl } from "@/utils";
import StatsCard from "../components/insurance/StatsCard";

export default function BrokerRequestsTracking() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: uploadRequests = [], isLoading } = useQuery({
    queryKey: ['upload-requests'],
    queryFn: () => apiClient.entities.BrokerUploadRequest.list('-sent_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.entities.Project.list(),
  });

  const getRequestAge = (sentDate) => {
    if (!sentDate) return null;
    return differenceInDays(new Date(), new Date(sentDate));
  };

  const isOverdue = (request) => {
    if (request.status !== 'pending') return false;
    const age = getRequestAge(request.sent_date);
    return age > 5; // 5 business days
  };

  const stats = {
    total: uploadRequests.length,
    pending: uploadRequests.filter(r => r.status === 'pending').length,
    uploaded: uploadRequests.filter(r => r.status === 'uploaded').length,
    overdue: uploadRequests.filter(r => isOverdue(r)).length,
  };

  const filteredRequests = uploadRequests.filter(req => {
    const matchesSearch = 
      req.subcontractor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.broker_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.project_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'overdue' ? isOverdue(req) : req.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (request) => {
    if (isOverdue(request)) {
      return {
        label: 'Overdue',
        icon: AlertTriangle,
        className: 'bg-red-100 text-red-800 border-red-300'
      };
    }

    const configs = {
      pending: {
        label: 'Pending Upload',
        icon: Clock,
        className: 'bg-amber-100 text-amber-800 border-amber-300'
      },
      uploaded: {
        label: 'Uploaded',
        icon: CheckCircle2,
        className: 'bg-red-100 text-red-800 border-red-300'
      },
      under_review: {
        label: 'Under Review',
        icon: Clock,
        className: 'bg-purple-100 text-purple-800 border-purple-300'
      },
      approved: {
        label: 'Approved',
        icon: CheckCircle2,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      },
      rejected: {
        label: 'Rejected',
        icon: XCircle,
        className: 'bg-red-100 text-red-800 border-red-300'
      },
      needs_correction: {
        label: 'Needs Correction',
        icon: AlertTriangle,
        className: 'bg-orange-100 text-orange-800 border-orange-300'
      }
    };

    return configs[request.status] || configs.pending;
  };

  const copyUploadLink = (token) => {
    const url = `${window.location.origin}${createPageUrl('broker-upload-coi')}?token=${token}`;
    navigator.clipboard.writeText(url);
    alert('Upload link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Broker Request Tracking
          </h1>
          <p className="text-slate-600">Monitor all document upload requests sent to brokers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Requests"
            value={stats.total}
            icon={Mail}
            color="blue"
          />
          <StatsCard
            title="Pending Upload"
            value={stats.pending}
            icon={Clock}
            color="amber"
          />
          <StatsCard
            title="Uploaded"
            value={stats.uploaded}
            icon={CheckCircle2}
            color="green"
          />
          <StatsCard
            title="Overdue"
            value={stats.overdue}
            icon={AlertTriangle}
            color="red"
          />
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-xl font-bold text-slate-900">
                Upload Requests
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="overdue">Overdue</TabsTrigger>
                    <TabsTrigger value="uploaded">Uploaded</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Subcontractor</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Trade</TableHead>
                    <TableHead className="font-semibold">Broker</TableHead>
                    <TableHead className="font-semibold">Request Type</TableHead>
                    <TableHead className="font-semibold">Sent</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(8).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        {searchQuery ? 'No requests match your search' : 'No upload requests found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => {
                      const statusConfig = getStatusConfig(request);
                      const Icon = statusConfig.icon;
                      const age = getRequestAge(request.sent_date);
                      const project = projects.find(p => p.id === request.project_id);

                      return (
                        <TableRow key={request.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium text-slate-900">
                            {request.subcontractor_name}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {request.project_name}
                            {project?.project_number && (
                              <p className="text-xs text-slate-400 font-mono mt-0.5">
                                #{project.project_number}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              {request.trade_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {request.broker_email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {request.request_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {request.sent_date ? (
                              <>
                                <div>{format(new Date(request.sent_date), 'MMM d, yyyy')}</div>
                                {age !== null && (
                                  <div className={`text-xs ${age > 5 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                    {age} day{age !== 1 ? 's' : ''} ago
                                  </div>
                                )}
                              </>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig.className}>
                              <Icon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyUploadLink(request.upload_token)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Copy Link
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}