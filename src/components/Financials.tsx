import { useState, useMemo } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Download,
  Users,
  FolderOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  PieChart as PieChartIcon
} from "lucide-react";
import { format, startOfMonth, subMonths, eachMonthOfInterval, isWithinInterval, endOfMonth } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import StatsCard from "@/components/insurance/StatsCard";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Financials() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [_emailStatus, _setEmailStatus] = useState('');

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => compliant.entities.Project.list('-created_date'),
  });

  const { data: generalContractors = [] } = useQuery({
    queryKey: ['general-contractors'],
    queryFn: () => compliant.entities.Contractor.filter({ contractor_type: 'general_contractor' }),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => compliant.entities.Subscription.list('-created_date'),
  });

  // Calculate financial metrics
  const paidProjects = projects.filter(p => p.price_paid);
  const unpaidProjects = projects.filter(p => !p.price_paid && p.project_price);
  
  const totalRevenue = paidProjects.reduce((sum, p) => sum + (p.project_price || 0), 0);
  const pendingRevenue = unpaidProjects.reduce((sum, p) => sum + (p.project_price || 0), 0);
  
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const monthlyRecurringRevenue = activeSubscriptions
    .filter(s => s.plan_type === 'monthly')
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  
  const annualRecurringRevenue = activeSubscriptions
    .filter(s => s.plan_type === 'annual')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  // Filter by date range
  const filteredProjects = projects.filter(p => {
    if (!p.price_paid_date) return false;
    const paidDate = new Date(p.price_paid_date);
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return paidDate >= start && paidDate <= end;
  });

  const periodRevenue = filteredProjects.reduce((sum, p) => sum + (p.project_price || 0), 0);

  const stats = {
    totalRevenue: totalRevenue,
    pendingRevenue: pendingRevenue,
    monthlyRecurring: monthlyRecurringRevenue,
    annualRecurring: annualRecurringRevenue,
  };

  // Group revenue by GC
  const revenueByGC = generalContractors.map(gc => {
    const gcProjects = paidProjects.filter(p => p.gc_id === gc.id);
    const revenue = gcProjects.reduce((sum, p) => sum + (p.project_price || 0), 0);
    const projectCount = gcProjects.length;
    
    const gcSubscriptions = activeSubscriptions.filter(s => s.gc_id === gc.id);
    const subscriptionRevenue = gcSubscriptions.reduce((sum, s) => sum + (s.amount || 0), 0);
    
    return {
      gc,
      revenue,
      projectCount,
      subscriptionRevenue,
      totalRevenue: revenue + subscriptionRevenue
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Advanced analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const last6Months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });

    // Monthly revenue breakdown
    const monthlyData = last6Months.map(month => {
      const monthProjects = projects.filter(p => 
        p.price_paid_date &&
        isWithinInterval(new Date(p.price_paid_date), {
          start: startOfMonth(month),
          end: endOfMonth(month)
        })
      );
      
      const projectRevenue = monthProjects.reduce((sum, p) => sum + (p.project_price || 0), 0);
      
      const monthSubs = subscriptions.filter(s =>
        s.payment_date &&
        isWithinInterval(new Date(s.payment_date), {
          start: startOfMonth(month),
          end: endOfMonth(month)
        })
      );
      
      const subRevenue = monthSubs.reduce((sum, s) => sum + (s.amount_paid || 0), 0);
      
      return {
        month: format(month, 'MMM yy'),
        projects: projectRevenue,
        subscriptions: subRevenue,
        total: projectRevenue + subRevenue
      };
    });

    // Revenue by source
    const revenueBySource = [
      { name: 'Projects', value: totalRevenue, color: '#10b981' },
      { name: 'Monthly Plans', value: monthlyRecurringRevenue, color: '#3b82f6' },
      { name: 'Annual Plans', value: annualRecurringRevenue, color: '#8b5cf6' }
    ].filter(s => s.value > 0);

    // Growth metrics
    const currentMonthRevenue = monthlyData[monthlyData.length - 1]?.total || 0;
    const lastMonthRevenue = monthlyData[monthlyData.length - 2]?.total || 0;
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0;

    // Average deal size
    const avgProjectValue = paidProjects.length > 0
      ? totalRevenue / paidProjects.length
      : 0;

    return {
      monthlyData,
      revenueBySource,
      revenueGrowth,
      avgProjectValue
    };
  }, [projects, subscriptions, totalRevenue, monthlyRecurringRevenue, annualRecurringRevenue, paidProjects]);

  const exportToCSV = () => {
    const headers = ['Date', 'GC Name', 'Project Name', 'Amount', 'Status'];
    const rows = paidProjects.map(p => [
      p.price_paid_date ? format(new Date(p.price_paid_date), 'yyyy-MM-dd') : '',
      p.gc_name,
      p.project_name,
      `$${p.project_price?.toLocaleString() || 0}`,
      'Paid'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Financial Management
            </h1>
            <p className="text-slate-600">Revenue tracking and bookkeeping</p>
          </div>
          <Button
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            color="green"
            subtitle="From paid projects"
          />
          <StatsCard
            title="Pending Revenue"
            value={`$${stats.pendingRevenue.toLocaleString()}`}
            icon={Clock}
            color="amber"
            subtitle="Awaiting payment"
          />
          <StatsCard
            title="Monthly Recurring"
            value={`$${stats.monthlyRecurring.toLocaleString()}`}
            icon={TrendingUp}
            color="blue"
            subtitle="MRR from subscriptions"
          />
          <StatsCard
            title="Annual Recurring"
            value={`$${stats.annualRecurring.toLocaleString()}`}
            icon={TrendingUp}
            color="blue"
            subtitle="ARR from subscriptions"
          />
        </div>

        {/* Analytics Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="by-gc" className="gap-2">
              <Users className="w-4 h-4" />
              By GC
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Revenue Trend */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Revenue Trend (6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={analytics.monthlyData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue by Source */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5" />
                    Revenue by Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {analytics.revenueBySource.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={analytics.revenueBySource}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.revenueBySource.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-slate-500">
                      No revenue data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Revenue Breakdown */}
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-bold">Monthly Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Legend />
                    <Bar dataKey="projects" fill="#10b981" name="Projects" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="subscriptions" fill="#3b82f6" name="Subscriptions" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Project Revenue ({paidProjects.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projectsLoading ? (
                  <div className="p-6 space-y-4">
                    {Array(5).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : paidProjects.length === 0 ? (
                  <div className="p-12 text-center">
                    <DollarSign className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      No Paid Projects Yet
                    </h3>
                    <p className="text-slate-600">
                      Revenue will appear here when projects are paid
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">Project Name</TableHead>
                          <TableHead className="font-semibold">GC</TableHead>
                          <TableHead className="font-semibold">Date Paid</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paidProjects.map((project) => (
                          <TableRow key={project.id} className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">
                              {project.project_name}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {project.gc_name}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {project.price_paid_date 
                                ? format(new Date(project.price_paid_date), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-emerald-700">
                                ${project.project_price?.toLocaleString() || 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Paid
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4 mt-4">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Active Subscriptions ({activeSubscriptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {subscriptions.length === 0 ? (
                  <div className="p-12 text-center">
                    <CreditCard className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      No Subscriptions Yet
                    </h3>
                    <p className="text-slate-600">
                      Subscription revenue will appear here
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">GC Name</TableHead>
                          <TableHead className="font-semibold">Plan Type</TableHead>
                          <TableHead className="font-semibold">Start Date</TableHead>
                          <TableHead className="font-semibold">Next Billing</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub) => (
                          <TableRow key={sub.id} className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">
                              {sub.gc_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {sub.plan_type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {sub.start_date 
                                ? format(new Date(sub.start_date), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {sub.next_billing_date 
                                ? format(new Date(sub.next_billing_date), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-red-700">
                                ${sub.amount?.toLocaleString() || 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  sub.status === 'active' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }
                              >
                                {sub.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* By GC Tab */}
          <TabsContent value="by-gc" className="space-y-4 mt-4">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Revenue by General Contractor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">GC Name</TableHead>
                        <TableHead className="font-semibold">Projects</TableHead>
                        <TableHead className="font-semibold">Project Revenue</TableHead>
                        <TableHead className="font-semibold">Subscription Revenue</TableHead>
                        <TableHead className="font-semibold">Total Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueByGC.map(({ gc, revenue, projectCount, subscriptionRevenue, totalRevenue }) => (
                        <TableRow key={gc.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">
                            {gc.company_name}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {projectCount}
                          </TableCell>
                          <TableCell className="text-emerald-700 font-medium">
                            ${revenue.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-red-700 font-medium">
                            ${subscriptionRevenue.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="text-lg font-bold text-slate-900">
                              ${totalRevenue.toLocaleString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Period Analysis Card */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Period Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-emerald-700 mb-1">Period Revenue</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ${periodRevenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Payments Alert */}
        {unpaidProjects.length > 0 && (
          <Card className="border-amber-200 shadow-lg">
            <CardHeader className="border-b border-amber-200 bg-amber-50">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5" />
                Pending Payments ({unpaidProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <>
                <Alert className="m-6 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <strong>${pendingRevenue.toLocaleString()}</strong> in pending revenue from {unpaidProjects.length} project{unpaidProjects.length !== 1 ? 's' : ''}
                  </AlertDescription>
                </Alert>
                <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">Project Name</TableHead>
                            <TableHead className="font-semibold">GC</TableHead>
                            <TableHead className="font-semibold">Created Date</TableHead>
                            <TableHead className="font-semibold">Amount</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpaidProjects.map((project) => (
                            <TableRow key={project.id} className="hover:bg-slate-50">
                              <TableCell className="font-medium text-slate-900">
                                {project.project_name}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {project.gc_name}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {project.created_date 
                                  ? format(new Date(project.created_date), 'MMM d, yyyy')
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-amber-700">
                                  ${project.project_price?.toLocaleString() || 0}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending Payment
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                </div>
              </>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}