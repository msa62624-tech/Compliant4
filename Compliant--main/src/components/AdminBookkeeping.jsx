import { useState, useMemo } from "react";
import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Users, 
  Search,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Mail,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, isWithinInterval, subMonths, eachMonthOfInterval, differenceInDays } from "date-fns";
import { BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminBookkeeping() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('this_year');
  const [activeTab, setActiveTab] = useState('overview');
  const [emailStatus, setEmailStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: rawSubscriptions = [], isLoading } = useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: () => compliant.entities.Subscription.list('-created_date'),
  });

  const subscriptions = rawSubscriptions.filter(sub => sub && sub.id);

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => compliant.entities.Contractor.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => compliant.entities.Project.list(),
  });

  const getContractor = (gcId) => {
    return contractors.find(c => c.id === gcId);
  };

  const getGCProjects = (gcId) => {
    return projects.filter(p => p.gc_id === gcId && p.status === 'active').length;
  };

  //subscriptions by date range
  const filterByDateRange = (sub) => {
    if (!sub || !sub.id) return false;
    if (dateRange === 'all_time') return true;
    if (!sub.payment_date) return false;

    const paymentDate = new Date(sub.payment_date);
    const now = new Date();

    switch (dateRange) {
      case 'this_month':
        return isWithinInterval(paymentDate, {
          start: startOfMonth(now),
          end: endOfMonth(now)
        });
      case 'this_year':
        return isWithinInterval(paymentDate, {
          start: startOfYear(now),
          end: now
        });
      default:
        return true;
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!sub || !sub.id) return false;
    
    const matchesSearch = 
      sub.gc_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.plan_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesDate = filterByDateRange(sub);

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Calculate stats
  const stats = {
    totalRevenue: subscriptions
      .filter(s => s && s.id && s.payment_status === 'completed' && filterByDateRange(s))
      .reduce((sum, s) => sum + (s.amount_paid || 0), 0),
    activeSubscriptions: subscriptions.filter(s => s && s.id && s.status === 'active').length,
    totalTransactions: subscriptions.filter(s => s && s.id && s.payment_status === 'completed' && filterByDateRange(s)).length,
    pendingPayments: subscriptions.filter(s => s && s.id && s.payment_status === 'pending').length,
  };

  const revenueByPlan = subscriptions
    .filter(s => s && s.id && s.payment_status === 'completed' && filterByDateRange(s))
    .reduce((acc, sub) => {
      const key = sub.plan_type;
      acc[key] = (acc[key] || 0) + (sub.amount_paid || 0);
      return acc;
    }, {});

  // Advanced Analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const last6Months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });

    // Monthly revenue trend
    const monthlyRevenue = last6Months.map(month => {
      const revenue = subscriptions
        .filter(s => s && s.id && s.payment_status === 'completed' && s.payment_date)
        .filter(s => {
          const paymentDate = new Date(s.payment_date);
          return paymentDate.getMonth() === month.getMonth() && 
                 paymentDate.getFullYear() === month.getFullYear();
        })
        .reduce((sum, s) => sum + (s.amount_paid || 0), 0);
      
      return {
        month: format(month, 'MMM yyyy'),
        revenue,
        subscriptions: subscriptions.filter(s => 
          s && s.id && s.start_date &&
          new Date(s.start_date).getMonth() === month.getMonth() &&
          new Date(s.start_date).getFullYear() === month.getFullYear()
        ).length
      };
    });

    // Plan distribution
    const planDistribution = [
      { name: 'Per Project', value: revenueByPlan.per_project || 0, color: '#3b82f6' },
      { name: 'Monthly', value: revenueByPlan.monthly || 0, color: '#10b981' },
      { name: 'Annual', value: revenueByPlan.annual || 0, color: '#8b5cf6' }
    ].filter(p => p.value > 0);

    // Customer lifetime value
    const avgSubscriptionValue = subscriptions
      .filter(s => s && s.id && s.payment_status === 'completed')
      .reduce((sum, s) => sum + (s.amount_paid || 0), 0) / 
      Math.max(contractors.length, 1);

    // Churn rate (cancelled this month / active last month)
    const cancelledThisMonth = subscriptions.filter(s => 
      s && s.id && s.cancelled_date && 
      isWithinInterval(new Date(s.cancelled_date), {
        start: startOfMonth(now),
        end: endOfMonth(now)
      })
    ).length;

    const activeLastMonth = subscriptions.filter(s => 
      s && s.id && s.status === 'active' &&
      s.start_date && new Date(s.start_date) < startOfMonth(now)
    ).length;

    const churnRate = activeLastMonth > 0 ? (cancelledThisMonth / activeLastMonth * 100) : 0;

    // Revenue growth
    const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
    const lastMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0;
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0;

    // MRR (Monthly Recurring Revenue)
    const mrr = subscriptions
      .filter(s => s && s.id && s.status === 'active' && (s.plan_type === 'monthly' || s.plan_type === 'annual'))
      .reduce((sum, s) => {
        if (s.plan_type === 'monthly') return sum + (s.amount || 0);
        if (s.plan_type === 'annual') return sum + ((s.amount || 0) / 12);
        return sum;
      }, 0);

    // ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    return {
      monthlyRevenue,
      planDistribution,
      avgSubscriptionValue,
      churnRate,
      revenueGrowth,
      mrr,
      arr,
      cancelledThisMonth,
      activeLastMonth
    };
  }, [subscriptions, contractors, revenueByPlan]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      trial: 'bg-red-50 text-red-700 border-red-200',
      pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
      cancelled: 'bg-slate-100 text-slate-700 border-slate-300',
      expired: 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[status] || colors.pending_payment;
  };

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'GC Name', 'Plan', 'Amount', 'Status', 'Transaction ID', 'Payment Method'];
    const rows = filteredSubscriptions
      .filter(sub => sub && sub.id)
      .map(sub => [
        sub.payment_date ? format(new Date(sub.payment_date), 'yyyy-MM-dd') : '',
        sub.gc_name || '',
        sub.plan_name || '',
        sub.amount_paid || sub.amount || 0,
        sub.payment_status || sub.status || '',
        sub.transaction_id || '',
        sub.payment_method || '',
      ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Send renewal reminder
  const sendRenewalReminder = async (subscription) => {
    const gc = contractors.find(c => c.id === subscription.gc_id);
    if (!gc?.email) return;

    const daysUntil = differenceInDays(new Date(subscription.next_billing_date), new Date());
    
    await sendEmail({
      to: gc.email,
      subject: `🔔 Subscription Renewal Coming Up - ${subscription.plan_name}`,
      body: `Dear ${subscription.gc_name},

Your subscription is renewing soon.

Plan: ${subscription.plan_name}
Amount: $${(subscription.amount || 0).toLocaleString()}
Next Billing Date: ${format(new Date(subscription.next_billing_date), 'MMM d, yyyy')}
Days Until Renewal: ${daysUntil}

Your payment method on file will be charged automatically.

Thank you,
InsureTrack Billing Team`
    });
  };

  // Send payment confirmation
  const sendPaymentConfirmation = async (subscription) => {
    const gc = contractors.find(c => c.id === subscription.gc_id);
    if (!gc?.email) return;

    await sendEmail({
      to: gc.email,
      subject: `✅ Payment Received - ${subscription.plan_name}`,
      body: `Dear ${subscription.gc_name},

Thank you for your payment!

Plan: ${subscription.plan_name}
Amount Paid: $${(subscription.amount_paid || 0).toLocaleString()}
Payment Date: ${subscription.payment_date ? format(new Date(subscription.payment_date), 'MMM d, yyyy') : 'Today'}
Transaction ID: ${subscription.transaction_id || 'Processing'}

Your subscription is now active.

Thank you,
InsureTrack Billing Team`
    });
  };

  // Automated system for subscription reminders
  const runAutomatedReminders = async () => {
    setIsProcessing(true);
    setEmailStatus('🤖 Running automated subscription checks...');
    
    let sentCount = 0;
    
    try {
      // Find subscriptions expiring in 7 days
      const dueSoon = subscriptions.filter(s => {
        if (!s.next_billing_date || s.status !== 'active') return false;
        const days = differenceInDays(new Date(s.next_billing_date), new Date());
        return days === 7;
      });

      for (const sub of dueSoon) {
        await sendRenewalReminder(sub);
        sentCount++;
      }

      // Find pending payments
      const pending = subscriptions.filter(s => 
        s.payment_status === 'pending' && s.status === 'pending_payment'
      );

      for (const sub of pending) {
        const gc = contractors.find(c => c.id === sub.gc_id);
        if (gc?.email) {
          await sendEmail({
            to: gc.email,
            subject: `💰 Payment Pending - ${sub.plan_name}`,
            body: `Dear ${sub.gc_name},

Your payment is currently pending for:

Plan: ${sub.plan_name}
Amount Due: $${(sub.amount || 0).toLocaleString()}

Please complete your payment to activate your subscription.

Thank you,
InsureTrack Billing Team`
          });
          sentCount++;
        }
      }

      setEmailStatus(`✅ Sent ${sentCount} automated reminder emails!`);
    } catch (error) {
      setEmailStatus('❌ Failed to send automated emails');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setEmailStatus(''), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              Financial Analytics
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">2.0</Badge>
            </h1>
            <p className="text-slate-600">Advanced revenue tracking, forecasting & insights</p>
            {emailStatus && (
              <Alert className="mt-2 bg-red-50 border-red-200">
                <Mail className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">{emailStatus}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={runAutomatedReminders}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  Send Reminders
                </>
              )}
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Date Range*/}
        <div className="flex items-center gap-4 bg-white rounded-lg p-4 border border-slate-200">
          <Calendar className="w-5 h-5 text-slate-500" />
          <Tabs value={dateRange} onValueChange={setDateRange}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="this_month">This Month</TabsTrigger>
              <TabsTrigger value="this_year">This Year</TabsTrigger>
              <TabsTrigger value="all_time">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <Badge variant={analytics.revenueGrowth >= 0 ? "default" : "destructive"} className="gap-1">
                  {analytics.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(analytics.revenueGrowth).toFixed(1)}%
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Total Revenue</h3>
              <p className="text-2xl font-bold text-slate-900">${stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">{dateRange === 'this_month' ? 'This month' : dateRange === 'this_year' ? 'This year' : 'All time'}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">MRR</h3>
              <p className="text-2xl font-bold text-slate-900">${analytics.mrr.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">ARR</h3>
              <p className="text-2xl font-bold text-slate-900">${analytics.arr.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Annual Recurring Revenue</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Churn Rate</h3>
              <p className="text-2xl font-bold text-slate-900">{analytics.churnRate.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.cancelledThisMonth} of {analytics.activeLastMonth} this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Revenue Trends
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Revenue Trend Chart */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Revenue Trend (6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={analytics.monthlyRevenue}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Plan Distribution */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Revenue by Plan Type
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {analytics.planDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={analytics.planDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.planDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-slate-500">
                      No revenue data yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-slate-200 bg-gradient-to-br from-red-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-red-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Avg Customer Value</h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">${analytics.avgSubscriptionValue.toFixed(0)}</p>
                  <p className="text-xs text-slate-600 mt-1">Per contractor lifetime</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Active Plans</h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stats.activeSubscriptions}</p>
                  <p className="text-xs text-slate-600 mt-1">Currently subscribed</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Completed Payments</h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalTransactions}</p>
                  <p className="text-xs text-slate-600 mt-1">Successful transactions</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Trends Tab */}
          <TabsContent value="revenue" className="space-y-4 mt-4">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-bold text-slate-900">
                  Detailed Revenue & Subscription Growth
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value, name) => [
                        name === 'revenue' ? `$${value.toLocaleString()}` : value,
                        name === 'revenue' ? 'Revenue' : 'New Subscriptions'
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[8, 8, 0, 0]} />
                    <Bar yAxisId="right" dataKey="subscriptions" fill="#10b981" name="New Subscriptions" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4 mt-4">

            <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-xl font-bold text-slate-900">
                All Subscriptions
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search GC, transaction ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
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
                    <TableHead className="font-semibold">General Contractor</TableHead>
                    <TableHead className="font-semibold">Plan</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Payment Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Projects</TableHead>
                    <TableHead className="font-semibold">Transaction ID</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(8).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        {searchQuery ? 'No subscriptions match your search' : 'No subscriptions found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubscriptions.map((sub) => {
                      const contractor = getContractor(sub.gc_id);
                      const projectCount = getGCProjects(sub.gc_id);
                      
                      return (
                        <TableRow key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium text-slate-900">
                            <div>
                              {sub.gc_name}
                              {contractor?.email && (
                                <p className="text-xs text-slate-500 mt-0.5">{contractor.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              {sub.plan_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">
                            ${(sub.amount_paid || sub.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {sub.payment_date ? (
                              <>
                                <div>{format(new Date(sub.payment_date), 'MMM d, yyyy')}</div>
                                <div className="text-xs text-slate-400">
                                  {format(new Date(sub.payment_date), 'h:mm a')}
                                </div>
                              </>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getStatusColor(sub.status)}>
                                {sub.status.replace('_', ' ')}
                              </Badge>
                              {sub.payment_status && getPaymentStatusIcon(sub.payment_status)}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            <div className="text-sm">
                              <span className="font-medium text-slate-900">{projectCount}</span>
                              <span className="text-slate-500"> / {sub.projects_included === 100 ? '∞' : sub.projects_included}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs font-mono">
                            {sub.transaction_id || '-'}
                          </TableCell>
                          <TableCell>
                            {sub.status === 'active' && sub.next_billing_date && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  setEmailStatus('Sending reminder...');
                                  await sendRenewalReminder(sub);
                                  setEmailStatus('✅ Reminder sent!');
                                  setTimeout(() => setEmailStatus(''), 3000);
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            )}
                            {sub.payment_status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  setEmailStatus('Sending receipt...');
                                  await sendPaymentConfirmation(sub);
                                  setEmailStatus('✅ Receipt sent!');
                                  setTimeout(() => setEmailStatus(''), 3000);
                                }}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            )}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}