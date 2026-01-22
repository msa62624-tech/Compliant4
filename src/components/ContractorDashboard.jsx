
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Shield, Upload, FileText, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatsCard from "@/components/insurance/StatsCard";
import StatusBadge from "@/components/insurance/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import UserProfile from "@/components/UserProfile.jsx";

export default function ContractorDashboard() {
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['my-documents', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return compliant.entities.InsuranceDocument.filter({ created_by: user.email }, '-created_date');
    },
    enabled: !!user?.email,
  });

  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.approval_status === 'approved').length,
    pending: documents.filter(d => d.approval_status === 'pending').length,
    expiringSoon: documents.filter(d => {
      const daysUntil = differenceInDays(new Date(d.expiration_date), new Date());
      return daysUntil >= 0 && daysUntil <= 30 && d.approval_status === 'approved';
    }).length,
  };

  const insuranceTypes = [
    { key: 'general_liability', label: 'General Liability', required: true },
    { key: 'workers_compensation', label: 'Workers Compensation', required: true },
    { key: 'auto_liability', label: 'Auto Liability', required: true },
    { key: 'umbrella_policy', label: 'Umbrella Policy', required: false },
    { key: 'professional_liability', label: 'Professional Liability', required: false },
    { key: 'builders_risk', label: 'Builders Risk', required: false },
  ];

  const getDocumentForType = (type) => {
    return documents.find(d => d.insurance_type === type);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              My Insurance Documents
            </h1>
            <p className="text-slate-600">Manage and track your insurance certificates</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("UploadInsurance")}>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </Link>
            <UserProfile user={user} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Uploaded"
            value={stats.total}
            icon={FileText}
            color="blue"
            subtitle="Documents"
          />
          <StatsCard
            title="Approved"
            value={stats.approved}
            icon={Shield}
            color="green"
            subtitle="Active policies"
          />
          <StatsCard
            title="Pending Review"
            value={stats.pending}
            icon={FileText}
            color="amber"
            subtitle="Awaiting approval"
          />
          <StatsCard
            title="Expiring Soon"
            value={stats.expiringSoon}
            icon={AlertTriangle}
            color="red"
            subtitle="Update needed"
          />
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">
              Insurance Coverage Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {Array(6).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {insuranceTypes.map((type) => {
                  const doc = getDocumentForType(type.key);
                  const daysUntilExpiry = doc ? differenceInDays(new Date(doc.expiration_date), new Date()) : null;
                  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

                  return (
                    <div
                      key={type.key}
                      className={`p-5 rounded-xl border-2 transition-all duration-200 ${
                        doc 
                          ? 'border-slate-200 bg-white hover:shadow-md' 
                          : 'border-dashed border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 text-lg">
                              {type.label}
                            </h3>
                            {type.required && (
                              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                                REQUIRED
                              </span>
                            )}
                          </div>
                          {doc ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <StatusBadge status={doc.approval_status} />
                                {isExpiringSoon && doc.approval_status === 'approved' && (
                                  <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" />
                                    Expires in {daysUntilExpiry} days
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <p>Policy: <span className="font-mono">{doc.policy_number}</span></p>
                                <p>Provider: {doc.insurance_provider}</p>
                                <p>Expires: {format(new Date(doc.expiration_date), 'MMMM d, yyyy')}</p>
                                {doc.rejection_reason && (
                                  <p className="text-red-600 mt-2">
                                    <strong>Reason:</strong> {doc.rejection_reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-500 text-sm">No document uploaded</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {doc && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.document_url, '_blank')}
                            >
                              View
                            </Button>
                          )}
                          <Link to={createPageUrl("UploadInsurance")}>
                            <Button
                              size="sm"
                              variant={doc ? "outline" : "default"}
                              className={!doc ? "bg-red-600 hover:bg-red-700" : ""}
                            >
                              {doc ? 'Replace' : 'Upload'}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}