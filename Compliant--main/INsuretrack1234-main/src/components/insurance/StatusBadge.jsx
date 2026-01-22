import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

export default function StatusBadge({ status }) {
  const statusConfig = {
    approved: {
      label: "Approved",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    },
    pending: {
      label: "Pending Review",
      icon: Clock,
      className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    },
    rejected: {
      label: "Rejected",
      icon: XCircle,
      className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    },
    expired: {
      label: "Expired",
      icon: AlertCircle,
      className: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200",
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} border font-medium px-3 py-1`}>
      <Icon className="w-3 h-3 mr-1.5" />
      {config.label}
    </Badge>
  );
}