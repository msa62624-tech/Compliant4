
import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  Check, 
  Building2, 
  Calendar, 
  DollarSign,
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, addMonths, addYears } from "date-fns";
import StatsCard from "../components/insurance/StatsCard";

const SUBSCRIPTION_PLANS = [
  {
    type: 'per_project',
    name: 'Pay Per Project',
    price: 299,
    projects: 1,
    features: [
      'Single project tracking',
      'Unlimited subcontractors',
      'Insurance compliance monitoring',
      'Automated broker requests',
      'Document management',
      'Email support'
    ],
    popular: false
  },
  {
    type: 'monthly',
    name: 'Monthly Plan',
    price: 499,
    projects: 5,
    features: [
      'Up to 5 active projects',
      'Unlimited subcontractors',
      'Insurance compliance monitoring',
      'Automated broker requests',
      'Document management',
      'Priority email support',
      'Monthly compliance reports',
      'Auto-renewal option'
    ],
    popular: true
  },
  {
    type: 'annual',
    name: 'Annual Plan',
    price: 4990,
    projects: 100,
    features: [
      'Unlimited projects',
      'Unlimited subcontractors',
      'Insurance compliance monitoring',
      'Automated broker requests',
      'Document management',
      'Priority phone & email support',
      'Monthly compliance reports',
      'Dedicated account manager',
      'Custom integrations',
      'Save 17% vs monthly'
    ],
    popular: false
  }
];

export default function GCSubscription() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const { data: contractor } = useQuery({
    queryKey: ['my-contractor', user?.email],
    queryFn: async () => {
      const contractors = await compliant.entities.Contractor.list();
      return contractors.find(c => c.email === user.email && c.contractor_type === 'general_contractor');
    },
    enabled: !!user?.email,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', contractor?.id],
    queryFn: () => compliant.entities.Subscription.filter({ gc_id: contractor.id }, '-created_date'),
    enabled: !!contractor?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['my-projects', contractor?.id],
    queryFn: () => compliant.entities.Project.filter({ gc_id: contractor.id }),
    enabled: !!contractor?.id,
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: (data) => compliant.entities.Subscription.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subscriptions']);
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Subscription.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subscriptions']);
    },
  });

  // Apply custom pricing if available
  const getEffectivePlans = () => {
    return SUBSCRIPTION_PLANS.map(plan => {
      const customPrice = contractor?.custom_pricing?.[plan.type];
      return {
        ...plan,
        price: customPrice !== undefined ? customPrice : plan.price,
        isCustomPriced: customPrice !== undefined
      };
    });
  };

  const effectivePlans = getEffectivePlans();

  const activeSubscription = subscriptions.find(s => s.status === 'active' || s.status === 'trial');
  const activeProjects = projects.filter(p => p.status === 'active');

  const openPaymentDialog = (plan) => {
    setSelectedPlan(plan);
    setIsPaymentDialogOpen(true);
    setPaymentSuccess(false);
  };

  const closePaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    setSelectedPlan(null);
    setPaymentData({
      cardNumber: '',
      cardName: '',
      expiryDate: '',
      cvv: '',
    });
    setPaymentSuccess(false);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const startDate = new Date();
      const endDate = selectedPlan.type === 'annual' 
        ? addYears(startDate, 1)
        : selectedPlan.type === 'monthly'
        ? addMonths(startDate, 1)
        : null;

      const nextBillingDate = selectedPlan.type !== 'per_project' ? endDate : null;

      const subscriptionData = {
        gc_id: contractor.id,
        gc_name: contractor.company_name,
        plan_type: selectedPlan.type,
        plan_name: selectedPlan.name,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate ? endDate.toISOString().split('T')[0] : null,
        next_billing_date: nextBillingDate ? nextBillingDate.toISOString().split('T')[0] : null,
        projects_included: selectedPlan.projects,
        projects_used: activeProjects.length,
        amount: selectedPlan.price,
        amount_paid: selectedPlan.price,
        payment_date: new Date().toISOString(),
        payment_method: `Card ending in ${paymentData.cardNumber.slice(-4)}`,
        payment_status: 'completed',
        transaction_id: (() => {
          const txnBytes = new Uint8Array(6);
          crypto.getRandomValues(txnBytes);
          return `TXN-${Date.now()}-${Array.from(txnBytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
        })(),
        auto_renew: selectedPlan.type !== 'per_project',
      };

      // Cancel existing active subscription if any
      if (activeSubscription) {
        await updateSubscriptionMutation.mutateAsync({
          id: activeSubscription.id,
          data: {
            status: 'cancelled',
            cancelled_date: new Date().toISOString(),
            cancellation_reason: 'Upgraded to new plan',
            auto_renew: false,
          }
        });
      }

      await createSubscriptionMutation.mutateAsync(subscriptionData);
      setPaymentSuccess(true);

      setTimeout(() => {
        closePaymentDialog();
      }, 2000);

    } catch (error) {
      alert('Payment failed. Please try again.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    await updateSubscriptionMutation.mutateAsync({
      id: activeSubscription.id,
      data: {
        auto_renew: false,
        cancellation_reason: 'Cancelled by user',
      }
    });
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Subscription & Billing
          </h1>
          <p className="text-slate-600">Manage your InsureTrack subscription and payment details</p>
        </div>

        {activeSubscription && (
          <>
            <div className="grid md:grid-cols-3 gap-6">
              <StatsCard
                title="Current Plan"
                value={activeSubscription.plan_name}
                icon={Building2}
                color="blue"
              />
              <StatsCard
                title="Projects Used"
                value={`${activeProjects.length}/${activeSubscription.projects_included || '∞'}`}
                icon={Building2}
                color="green"
              />
              <StatsCard
                title="Monthly Cost"
                value={`$${activeSubscription.amount}`}
                icon={DollarSign}
                color="amber"
              />
            </div>

            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-red-50 to-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-red-600" />
                    Active Subscription
                  </CardTitle>
                  <Badge variant="outline" className={getStatusColor(activeSubscription.status)}>
                    {activeSubscription.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Plan</p>
                    <p className="font-semibold text-slate-900 text-lg">{activeSubscription.plan_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Amount</p>
                    <p className="font-semibold text-slate-900 text-lg">${activeSubscription.amount}</p>
                  </div>
                  {activeSubscription.start_date && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Start Date</p>
                      <p className="text-slate-900">{format(new Date(activeSubscription.start_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {activeSubscription.next_billing_date && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Next Billing</p>
                      <p className="text-slate-900">{format(new Date(activeSubscription.next_billing_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {activeSubscription.payment_method && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Payment Method</p>
                      <p className="text-slate-900">{activeSubscription.payment_method}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Auto-Renewal</p>
                    <p className="text-slate-900">{activeSubscription.auto_renew ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>

                {activeSubscription.auto_renew && (
                  <div className="mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={handleCancelSubscription}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {contractor?.custom_pricing && (contractor.custom_pricing.per_project !== undefined || contractor.custom_pricing.monthly !== undefined || contractor.custom_pricing.annual !== undefined) && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-900">
              <strong>Special pricing applied!</strong> Your account has custom pricing. Contact support for details.
              {contractor.custom_pricing.notes && (
                <p className="mt-1 text-sm">{contractor.custom_pricing.notes}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {activeSubscription ? 'Upgrade Your Plan' : 'Choose Your Plan'}
          </h2>
          <p className="text-slate-600 mb-6">
            Select the plan that best fits your business needs
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {effectivePlans.map((plan) => (
              <Card 
                key={plan.type}
                className={`border-2 transition-all hover:shadow-xl ${
                  plan.popular 
                    ? 'border-red-500 shadow-lg' 
                    : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="bg-red-600 text-white text-center py-2 text-sm font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
                    <span className="text-slate-600 ml-2">
                      {plan.type === 'per_project' ? '/project' : plan.type === 'monthly' ? '/month' : '/year'}
                    </span>
                    {plan.isCustomPriced && (
                      <div className="mt-2">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          Custom Price
                        </Badge>
                      </div>
                    )}
                  </div>
                  {plan.type === 'annual' && !plan.isCustomPriced && (
                    <p className="text-sm text-emerald-600 font-medium mt-2">
                      Save $1,000 per year
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-slate-900">
                        {plan.projects === 100 ? 'Unlimited' : plan.projects} project{plan.projects !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {plan.features.map((feature, index) => (
                      <div key={`plan-${plan.id}-feature-${index}-${feature.substring(0,15)}`} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => openPaymentDialog(plan)}
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                    disabled={activeSubscription?.plan_type === plan.type}
                  >
                    {activeSubscription?.plan_type === plan.type ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {subscriptions.length > 0 && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {subscriptions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{sub.plan_name}</p>
                      <p className="text-sm text-slate-600">
                        {sub.payment_date ? format(new Date(sub.payment_date), 'MMMM d, yyyy') : 'Pending'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">${sub.amount_paid || sub.amount}</p>
                      <Badge variant="outline" className={`${getStatusColor(sub.payment_status || sub.status)} text-xs`}>
                        {sub.payment_status || sub.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={closePaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Complete Payment
            </DialogTitle>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Payment Successful!
              </h3>
              <p className="text-slate-600">
                Your subscription is now active
              </p>
            </div>
          ) : (
            <>
              {selectedPlan && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-red-900 mb-2">{selectedPlan.name}</h4>
                  <p className="text-2xl font-bold text-red-900">${selectedPlan.price}</p>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedPlan.projects === 100 ? 'Unlimited' : selectedPlan.projects} project{selectedPlan.projects !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              <form onSubmit={handlePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardName">Cardholder Name</Label>
                  <Input
                    id="cardName"
                    value={paymentData.cardName}
                    onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    value={paymentData.cardNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setPaymentData({ ...paymentData, cardNumber: value });
                    }}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      value={paymentData.expiryDate}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '/' + value.slice(2, 4);
                        }
                        setPaymentData({ ...paymentData, expiryDate: value });
                      }}
                      placeholder="MM/YY"
                      maxLength={5}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      value={paymentData.cvv}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setPaymentData({ ...paymentData, cvv: value });
                      }}
                      placeholder="123"
                      maxLength={3}
                      required
                    />
                  </div>
                </div>

                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900 text-sm">
                    Your payment information is securely processed. We use industry-standard encryption.
                  </AlertDescription>
                </Alert>

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={closePaymentDialog} disabled={isProcessing}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay ${selectedPlan?.price}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
