import { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ExternalLink, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import StatusBadge from "@/components/insurance/StatusBadge";
import ApprovalModal from "@/components/insurance/ApprovalModal";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AllDocuments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get current user to check access
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.auth.me(),
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['insurance-documents'],
    queryFn: () => apiClient.entities.InsuranceDocument.list('-created_date'),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.InsuranceDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['insurance-documents']);
    },
  });

  const handleApprove = async (document, notes) => {
    const user = await apiClient.auth.me();
    await updateDocumentMutation.mutateAsync({
      id: document.id,
      data: {
        approval_status: 'approved',
        reviewed_by: user.email,
        review_date: new Date().toISOString(),
        notes: notes || undefined,
      }
    });
  };

  const handleReject = async (document, reason) => {
    const user = await apiClient.auth.me();
    await updateDocumentMutation.mutateAsync({
      id: document.id,
      data: {
        approval_status: 'rejected',
        reviewed_by: user.email,
        review_date: new Date().toISOString(),
        rejection_reason: reason,
      }
    });
  };

  const openApprovalModal = (document) => {
    setSelectedDocument(document);
    setIsModalOpen(true);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.subcontractor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.policy_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.insurance_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if user has access to archives (only admin and GC)
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Restrict access: only admin, super_admin, and gc roles can access archives
  const hasAccess = currentUser?.role === 'admin' || 
                    currentUser?.role === 'super_admin' || 
                    currentUser?.role === 'gc';

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600 mb-4">
              You do not have permission to access the document archives.
            </p>
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-900 text-sm">
                Archive access is restricted to administrators and general contractors only.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            All Insurance Documents
          </h1>
          <p className="text-slate-600">Search and manage all submitted insurance certificates</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-xl font-bold text-slate-900">
                Document Archive
              </CardTitle>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by contractor, policy, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Contractor</TableHead>
                    <TableHead className="font-semibold">Insurance Type</TableHead>
                    <TableHead className="font-semibold">Policy Number</TableHead>
                    <TableHead className="font-semibold">Provider</TableHead>
                    <TableHead className="font-semibold">Coverage</TableHead>
                    <TableHead className="font-semibold">Submitted</TableHead>
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
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        {searchQuery ? 'No documents match your search' : 'No documents found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-medium text-slate-900">
                          {doc.subcontractor_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {doc.insurance_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableCell>
                        <TableCell className="text-slate-600 font-mono text-sm">
                          {doc.policy_number}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {doc.insurance_provider || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {doc.coverage_amount ? `$${doc.coverage_amount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">
                          {format(new Date(doc.created_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={doc.approval_status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {doc.approval_status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => openApprovalModal(doc)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Review
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.document_url, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ApprovalModal
        document={selectedDocument}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}