import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, color, subtitle, trend }) {
  const colorClasses = {
    blue: "bg-red-50 border-red-200 text-red-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <Card className={`border ${colorClasses[color].split('border-')[1] ? 'border-' + colorClasses[color].split('border-')[1] : ''} shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 mb-1">{value}</h3>
            {subtitle && (
              <p className="text-sm text-slate-600 font-medium">{subtitle}</p>
            )}
            {trend && (
              <p className={`text-xs mt-1 font-medium ${trend.includes('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="w-6 h-6" strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}