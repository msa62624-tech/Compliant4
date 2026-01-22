import { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Eye,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import UserProfile from "@/components/UserProfile.jsx";

export default function BrokerPortal() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.auth.me(),
  });

  // For testing, show all COIs. In production, filter by broker email
  const testingRole = sessionStorage.getItem('testing_role');
  const isBrokerTest = testingRole === 'broker_hml';

  const { data: myCOIs = [], isLoading } = useQuery({
    queryKey: ['broker-cois', user?.email],
    queryFn: async () => {
      const allCOIs = await apiClient.entities.GeneratedCOI.list();
      
      // In testing mode, show all COIs for broker testing
      if (isBrokerTest) {
        return allCOIs;
      }
      
      // In production, filter by broker email
      return allCOIs.filter(c => 
        c.broker_email && 
        c.broker_email.toLowerCase() === user?.email?.toLowerCase()
      );
    },
    enabled: !!user,
  });

  const filteredCOIs = myCOIs.filter(coi => {
    const searchLower = searchTerm.toLowerCase();
    
    if (!searchTerm) return true;
    
    if (searchType === 'all') {
      return (
        coi.subcontractor_name?.toLowerCase().includes(searchLower) ||
        coi.project_name?.toLowerCase().includes(searchLower) ||
        coi.gc_name?.toLowerCase().includes(searchLower)
      );
    } else if (searchType === 'job') {
      return coi.project_name?.toLowerCase().includes(searchLower);
    } else if (searchType === 'subcontractor') {
      return coi.subcontractor_name?.toLowerCase().includes(searchLower);
    } else if (searchType === 'gc') {
      return coi.gc_name?.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  const getStatusInfo = (coi) => {
    if (!coi.first_coi_uploaded) {
      return {
        label: 'Upload Needed',
        color: 'red',
        icon: AlertCircle,
        description: 'Broker needs to upload certificate'
      };
    }

    if (coi.status === 'awaiting_admin_review') {
      return {
        label: 'Under Review',
        color: 'blue',
        icon: Clock,
        description: 'Certificate is being reviewed'
      };
    }

    if (coi.status === 'deficiency_pending') {
      return {
        label: 'Issues Found',
        color: 'amber',
        icon: AlertCircle,
        description: 'Certificate has issues'
      };
    }

    if (coi.status === 'active') {
      return {
        label: 'Active',
        color: 'emerald',
        icon: CheckCircle2,
        description: 'Certificate is active'
      };
    }

    return {
      label: 'Pending',
      color: 'slate',
      icon: Clock,
      description: 'Waiting'
    };
  };

  const stats = {
    total: myCOIs.length,
    pending: myCOIs.filter(c => !c.first_coi_uploaded).length,
    active: myCOIs.filter(c => c.status === 'active').length,
    issues: myCOIs.filter(c => c.status === 'deficiency_pending').length,
  };

  const handleUploadClick = (coi) => {
    navigate(createPageUrl(`broker-upload-coi?token=${coi.coi_token}`));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Broker Portal
            </h1>
            <p className="text-slate-600">
              {isBrokerTest && <Badge className="bg-blue-600 text-white mr-2">Testing Mode - Showing All COIs</Badge>}
              Manage certificate requests and uploads
            </p>
          </div>
          <UserProfile 
            user={{ 
              name: user?.name || 'Broker',
              email: user?.email,
              role: 'broker'
            }}
          />
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Requests</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending Upload</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Issues</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.issues}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Certificate Requests
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
                    <SelectItem value="gc">General Contractor</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={`Search ${searchType === 'all' ? 'all fields' : searchType === 'job' ? 'by job/project' : searchType === 'subcontractor' ? 'by subcontractor' : 'by GC'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCOIs.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {searchTerm ? 'No Results Found' : 'No Requests Yet'}
                </h3>
                <p className="text-slate-600">
                  {searchTerm ? 'Try a different search term' : 'Certificate requests will appear here'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Subcontractor</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">GC</TableHead>
                    <TableHead className="font-semibold">Trade</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold w-48">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCOIs.map((coi) => {
                    const statusInfo = getStatusInfo(coi);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={coi.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">
                          {coi.subcontractor_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {coi.project_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {coi.gc_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {coi.trade_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`bg-${statusInfo.color}-50 text-${statusInfo.color}-700 border-${statusInfo.color}-200`}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {coi.sub_notified_date ? format(new Date(coi.sub_notified_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {coi.sample_coi_pdf_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(coi.sample_coi_pdf_url, '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Sample
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleUploadClick(coi)}
                              className={
                                !coi.first_coi_uploaded || coi.status === 'deficiency_pending'
                                  ? 'bg-red-600 hover:bg-red-700'
                                  : 'bg-slate-600 hover:bg-slate-700'
                              }
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {coi.first_coi_uploaded ? 'Update' : 'Upload'}
                            </Button>
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