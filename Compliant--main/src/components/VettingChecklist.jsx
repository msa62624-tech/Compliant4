import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function VettingChecklist({ sub, coi, project: _project }) {
  if (!sub) return null;

  const checklistItems = [
    {
      id: 'company_info',
      label: 'Company Information Complete',
      check: () => sub?.subcontractor_name && sub?.contact_email,
      status: sub?.subcontractor_name && sub?.contact_email ? 'complete' : 'incomplete',
    },
    {
      id: 'trade_assigned',
      label: 'Trade Type(s) Assigned',
      check: () => (sub?.trade_types && sub.trade_types.length > 0) || sub?.trade_type,
      status: ((sub?.trade_types && sub.trade_types.length > 0) || sub?.trade_type) ? 'complete' : 'incomplete',
    },
    {
      id: 'broker_info',
      label: 'Broker Information Provided',
      check: () => coi?.broker_name && coi?.broker_email,
      status: (coi?.broker_name && coi?.broker_email) ? 'complete' : 'pending',
    },
    {
      id: 'coi_uploaded',
      label: 'Certificate of Insurance Uploaded',
      check: () => coi?.first_coi_uploaded,
      status: coi?.first_coi_uploaded ? 'complete' : 'pending',
    },
    {
      id: 'compliance_check',
      label: 'Compliance Analysis Passed',
      check: () => coi?.policy_analysis?.overall_status === 'compliant',
      status: coi?.policy_analysis?.overall_status === 'compliant' ? 'complete' : 
              coi?.policy_analysis?.overall_status === 'non_compliant' ? 'failed' : 'pending',
    },
    {
      id: 'broker_signature',
      label: 'Broker Signature Added',
      check: () => coi?.broker_signature_url,
      status: coi?.broker_signature_url ? 'complete' : 'pending',
    },
  ];

  const statusConfig = {
    complete: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50', label: 'Complete' },
    incomplete: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Incomplete' },
    pending: { icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Pending' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Failed' },
  };

  const completedCount = checklistItems.filter(item => item.status === 'complete').length;
  const totalCount = checklistItems.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Onboarding Checklist</CardTitle>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            {completedCount} / {totalCount} Complete
          </Badge>
        </div>
        <div className="mt-3">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-red-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {checklistItems.map((item) => {
            const config = statusConfig[item.status];
            const Icon = config.icon;
            
            return (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <span className="font-medium text-slate-900">{item.label}</span>
                </div>
                <Badge variant="outline" className={config.bgColor}>
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}