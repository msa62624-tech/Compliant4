import React, { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, User, Mail } from "lucide-react";
import { notifyBrokerAssignment } from "@/brokerNotifications";

export default function BrokerUpload() {
  const urlParams = new URLSearchParams(window.location.search);
  const uploadType = urlParams.get('type'); // 'global' or 'per-policy'
  const subId = urlParams.get('subId');
  const token = urlParams.get('token');

  const queryClient = useQueryClient();

  // Public access handling
  React.useEffect(() => {
    if (token) {
      sessionStorage.setItem('public_access_enabled', 'true');
      sessionStorage.setItem('public_access_token', token);
    }
  }, [token]);

  // For global broker
  const [globalBroker, setGlobalBroker] = useState({
    broker_name: '',
    broker_email: '',
    broker_phone: '',
    broker_company: ''
  });
  
  // For per-policy: array of brokers with assigned policies
  const [brokers, setBrokers] = useState([]);
  const [currentBrokerForm, setCurrentBrokerForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [currentBrokerPolicies, setCurrentBrokerPolicies] = useState({
    gl: false,
    umbrella: false,
    auto: false,
    wc: false,
  });
  const [step, setStep] = useState('add-broker'); // 'add-broker' or 'select-policies'
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // All available policies
  const allPolicies = [
    { key: 'gl', label: 'General Liability', icon: '📋' },
    { key: 'umbrella', label: 'Umbrella/Excess', icon: '☔' },
    { key: 'auto', label: 'Auto Liability', icon: '🚗' },
    { key: 'wc', label: 'Workers Compensation', icon: '👷' }
  ];

  // Get already assigned policies
  const assignedPolicies = new Set();
  brokers.forEach(b => {
    b.policies.forEach(p => assignedPolicies.add(p));
  });

  // Get available policies for next broker
  const availablePolicies = allPolicies.filter(p => !assignedPolicies.has(p.key));

  const { data: subcontractor, isLoading, error: queryError } = useQuery({
    queryKey: ['subcontractor-broker-form', subId],
    queryFn: async () => {
      try {
        // Try to read directly by ID first
        return await apiClient.entities.Contractor.read(subId);
      } catch (err) {
        console.warn('⚠️ BrokerUpload: Authenticated read failed, trying public fallback:', err?.message || err);
        try {
          // Public/token-based fallback: fetch without auth
          const { protocol, host, origin } = window.location;
          const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
          const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                             origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                             origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                             import.meta?.env?.VITE_API_BASE_URL || '';
          
          const response = await fetch(`${backendBase}/public/contractor/${subId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            return data;
          }
          throw new Error('Public fetch failed: ' + response.status);
        } catch (publicErr) {
          console.error('❌ BrokerUpload: Public fallback also failed:', publicErr?.message || publicErr);
          // Return a placeholder so form can still work with just the ID
          return { id: subId, company_name: 'Unknown', contractor_type: 'subcontractor' };
        }
      }
    },
    enabled: !!subId,
  });

  const saveBrokerMutation = useMutation({
    mutationFn: async () => {
      setError('');
      
      // Validate based on upload type
      if (uploadType === 'global') {
        if (!globalBroker.broker_name?.trim()) throw new Error('Broker name is required');
        if (!globalBroker.broker_email?.trim() || !globalBroker.broker_email.includes('@')) {
          throw new Error('Valid broker email is required');
        }
      } else {
        // Per-policy: validate all brokers have required fields
        if (brokers.length === 0) throw new Error('Add at least one broker');
        for (const broker of brokers) {
          if (!broker.name?.trim()) throw new Error('All brokers must have a name');
          if (!broker.email?.trim() || !broker.email.includes('@')) {
            throw new Error('All brokers must have a valid email');
          }
          if (broker.policies.length === 0) throw new Error('All brokers must be assigned at least one policy');
        }
      }
      
      let updateData = {};
      
      if (uploadType === 'global') {
        updateData = {
          broker_name: globalBroker.broker_name.trim(),
          broker_email: globalBroker.broker_email.trim(),
          broker_phone: globalBroker.broker_phone?.trim() || '',
          broker_company: globalBroker.broker_company?.trim() || '',
          broker_type: 'global',
        };
      } else {
        // Per-policy: assign each broker to their policies
        const brokerMap = {};
        for (const broker of brokers) {
          broker.policies.forEach(policyKey => {
            brokerMap[`broker_${policyKey}_name`] = broker.name.trim();
            brokerMap[`broker_${policyKey}_email`] = broker.email.trim();
            brokerMap[`broker_${policyKey}_phone`] = broker.phone?.trim() || '';
          });
        }
        updateData = { ...brokerMap, broker_type: 'per-policy' };
        
        // Also set primary broker (first one)
        if (brokers.length > 0) {
          updateData.broker_name = brokers[0].name.trim();
          updateData.broker_email = brokers[0].email.trim();
          updateData.broker_phone = brokers[0].phone?.trim() || '';
        }
      }
      
      // Update Contractor record - try authenticated first, then public fallback
      try {
        await apiClient.entities.Contractor.update(subId, updateData);
      } catch (authErr) {
        console.warn('⚠️ Authenticated update failed, trying public endpoint:', authErr?.message);
        try {
          const { protocol, host, origin } = window.location;
          const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
          const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                             origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                             origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                             import.meta?.env?.VITE_API_BASE_URL || '';
          
          const response = await fetch(`${backendBase}/public/contractor/${subId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          
          if (!response.ok) throw new Error('Public update failed: ' + response.status);
        } catch (publicErr) {
          console.error('❌ Both update methods failed:', publicErr);
          throw new Error('Failed to update broker assignment: ' + publicErr.message);
        }
      }
      
      // Update all GeneratedCOI records - try authenticated first, then public fallback
      let coiUpdateSuccess = false;
      let coiUpdateError = null;
      try {
        const allCOIs = await apiClient.entities.GeneratedCOI.list();
        const subCOIs = allCOIs.filter(c => 
          c.subcontractor_name === subcontractor.company_name ||
          c.subcontractor_id === subId
        );
        
        for (const coi of subCOIs) {
          await apiClient.entities.GeneratedCOI.update(coi.id, updateData);
        }
        coiUpdateSuccess = true;
      } catch (coiError) {
        console.warn('⚠️ Authenticated COI update failed, trying public endpoint:', coiError?.message);
        try {
          // Public fallback: Update COIs via public endpoint
          const { protocol, host, origin } = window.location;
          const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
          const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                             origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                             origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                             import.meta?.env?.VITE_API_BASE_URL || '';
          
          const response = await fetch(`${backendBase}/public/update-cois-for-contractor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractorId: subId, updates: updateData })
          });
          
          if (!response.ok) {
            throw new Error('Public COI update failed: ' + response.status);
          }
          coiUpdateSuccess = true;
        } catch (publicCoiError) {
          console.error('❌ Both COI update methods failed:', publicCoiError);
          coiUpdateError = publicCoiError;
          // Don't throw - contractor/broker assignment worked, just COI sync failed
          // But store the error to show a warning to the user
        }
      }
      
      // Show warning if COI sync failed
      if (!coiUpdateSuccess && coiUpdateError) {
        setError(`⚠️ Warning: Broker assignment saved, but failed to sync with existing certificates. Error: ${coiUpdateError.message}`);
      }
      
      // Send notification emails
      try {
        if (uploadType === 'global') {
          const brokerData = {
            ...subcontractor,
            broker_email: globalBroker.broker_email.trim(),
            broker_name: globalBroker.broker_name.trim(),
          };
          await notifyBrokerAssignment(brokerData, null, true);
        } else {
          // For per-policy, notify each broker
          for (const broker of brokers) {
            const brokerData = {
              ...subcontractor,
              broker_email: broker.email.trim(),
              broker_name: broker.name.trim(),
            };
            // Map policy keys to display names
            const policyNames = broker.policies.map(key => {
              const policyMap = {
                'gl': 'General Liability (GL)',
                'wc': 'Workers Compensation (WC)',
                'auto': 'Auto Liability',
                'umbrella': 'Excess/Umbrella'
              };
              return policyMap[key] || key;
            });
            await notifyBrokerAssignment(brokerData, null, false, policyNames);
          }
        }
      } catch (emailError) {
        console.error('❌ Failed to send broker notification:', emailError);
      }
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries(['subcontractor-broker-form', subId]);
      setTimeout(() => {
        window.location.href = `/subcontractor-dashboard?id=${subId}`;
      }, 2000);
    },
    onError: (err) => {
      setError(err?.message || 'Failed to save broker information');
    },
  });

  if (!subId || !uploadType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
            <p className="text-slate-600">This broker setup link is invalid. Please use the link from your email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subcontractor) {
    console.warn('Subcontractor not found:', { subId, queryError });
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Subcontractor Not Found</h2>
            <p className="text-slate-600 mb-4">ID: {subId}</p>
            <p className="text-sm text-slate-500">
              {queryError ? `Error: ${queryError.message}` : 'This link may have expired or the subcontractor record was not found in the system.'}
            </p>
            <p className="text-sm text-slate-600 mt-4">
              Please contact your admin to resend the broker setup link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Broker Information Saved!</h2>
            <p className="text-slate-600">Your broker information has been saved. Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeLabel = uploadType === 'global' 
    ? 'One Broker for All Policies' 
    : 'Different Brokers per Policy';
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-red-50 to-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Add Your Insurance Broker
                </CardTitle>
                <p className="text-slate-600 mt-1">{typeLabel}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Info Banner */}
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  {uploadType === 'global' 
                    ? 'You\'re setting up one broker for all policy terms (GL, WC, etc.).'
                    : 'You can set different brokers for different policy terms (GL, WC, etc.) as needed.'}
                </AlertDescription>
              </Alert>

              {/* Company Name Display */}
              <div>
                <Label className="text-slate-700 font-medium">Your Company</Label>
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-900">{subcontractor.company_name}</p>
                </div>
              </div>

              {/* Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBrokerMutation.mutate();
                }}
                className="space-y-6"
              >
                {/* Main/Global Broker Info */}
                {uploadType === 'global' && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-4">Primary Broker Information</h3>
                    
                    <div className="mb-4">
                      <Label htmlFor="broker_name" className="text-slate-700 font-medium">
                        Broker Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="broker_name"
                        placeholder="e.g., John Smith or ABC Insurance Brokers"
                        value={globalBroker.broker_name}
                        onChange={(e) => setGlobalBroker({ ...globalBroker, broker_name: e.target.value })}
                        className="mt-2"
                        disabled={saveBrokerMutation.isPending}
                      />
                    </div>

                    <div className="mb-4">
                      <Label htmlFor="broker_email" className="text-slate-700 font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Broker Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="broker_email"
                        type="email"
                        placeholder="broker@example.com"
                        value={globalBroker.broker_email}
                        onChange={(e) => setGlobalBroker({ ...globalBroker, broker_email: e.target.value })}
                        className="mt-2"
                        disabled={saveBrokerMutation.isPending}
                      />
                      <p className="text-sm text-slate-500 mt-1">We&apos;ll send them instructions to upload their policies</p>
                    </div>

                    <div className="mb-4">
                      <Label htmlFor="broker_phone" className="text-slate-700 font-medium">
                        Broker Phone <span className="text-slate-400">(Optional)</span>
                      </Label>
                      <Input
                        id="broker_phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={globalBroker.broker_phone}
                        onChange={(e) => setGlobalBroker({ ...globalBroker, broker_phone: e.target.value })}
                        className="mt-2"
                        disabled={saveBrokerMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="broker_company" className="text-slate-700 font-medium">
                        Broker Company <span className="text-slate-400">(Optional)</span>
                      </Label>
                      <Input
                        id="broker_company"
                        placeholder="e.g., ABC Insurance Brokers"
                        value={globalBroker.broker_company}
                        onChange={(e) => setGlobalBroker({ ...globalBroker, broker_company: e.target.value })}
                        className="mt-2"
                        disabled={saveBrokerMutation.isPending}
                      />
                    </div>
                  </div>
                )}

                {/* Per-Policy Brokers Workflow */}
                {uploadType === 'per-policy' && (
                  <div className="space-y-6">
                    {/* Step 1: Add Broker Form */}
                    {step === 'add-broker' && (
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200 space-y-4">
                        <h3 className="font-semibold text-red-900">
                          Add Broker {brokers.length + 1}
                        </h3>
                        
                        <div className="space-y-4">
                          <div>
                            <Label className="text-slate-700 font-medium">
                              Broker Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              placeholder="e.g., John Smith"
                              value={currentBrokerForm.name}
                              onChange={(e) => setCurrentBrokerForm({ ...currentBrokerForm, name: e.target.value })}
                              className="mt-2"
                              disabled={saveBrokerMutation.isPending}
                            />
                          </div>
                          
                          <div>
                            <Label className="text-slate-700 font-medium flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              Broker Email <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="email"
                              placeholder="broker@example.com"
                              value={currentBrokerForm.email}
                              onChange={(e) => setCurrentBrokerForm({ ...currentBrokerForm, email: e.target.value })}
                              className="mt-2"
                              disabled={saveBrokerMutation.isPending}
                            />
                          </div>
                          
                          <div>
                            <Label className="text-slate-700 font-medium">Broker Phone <span className="text-slate-400">(Optional)</span></Label>
                            <Input
                              type="tel"
                              placeholder="(555) 123-4567"
                              value={currentBrokerForm.phone}
                              onChange={(e) => setCurrentBrokerForm({ ...currentBrokerForm, phone: e.target.value })}
                              className="mt-2"
                              disabled={saveBrokerMutation.isPending}
                            />
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => {
                            if (!currentBrokerForm.name?.trim()) {
                              setError('Broker name is required');
                              return;
                            }
                            if (!currentBrokerForm.email?.trim() || !currentBrokerForm.email.includes('@')) {
                              setError('Valid broker email is required');
                              return;
                            }
                            setError('');
                            setStep('select-policies');
                          }}
                          className="w-full bg-red-600 hover:bg-red-700"
                          disabled={saveBrokerMutation.isPending}
                        >
                          Next: Assign Policies
                        </Button>
                      </div>
                    )}
                    
                    {/* Step 2: Select Policies */}
                    {step === 'select-policies' && availablePolicies.length > 0 && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                        <h3 className="font-semibold text-slate-900">
                          Assign Policies to {currentBrokerForm.name}
                        </h3>
                        <p className="text-sm text-slate-600">Select which policies this broker manages:</p>
                        
                        <div className="space-y-3">
                          {availablePolicies.map(({ key, label, icon }) => (
                            <label key={key} className="flex items-center gap-3 p-3 bg-white rounded border border-slate-200 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={currentBrokerPolicies[key]}
                                onChange={(e) => setCurrentBrokerPolicies(prev => ({
                                  ...prev,
                                  [key]: e.target.checked
                                }))}
                                className="w-4 h-4"
                              />
                              <span className="text-lg">{icon}</span>
                              <span className="font-medium text-slate-900">{label}</span>
                            </label>
                          ))}
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCurrentBrokerForm({ name: '', email: '', phone: '' });
                              setCurrentBrokerPolicies({ gl: false, umbrella: false, auto: false, wc: false });
                              setStep('add-broker');
                            }}
                            className="flex-1"
                            disabled={saveBrokerMutation.isPending}
                          >
                            Back
                          </Button>
                          <Button
                            onClick={() => {
                              const selectedPolicies = Object.entries(currentBrokerPolicies)
                                .filter(([_, checked]) => checked)
                                .map(([key, _]) => key);
                              
                              if (selectedPolicies.length === 0) {
                                setError('Select at least one policy');
                                return;
                              }
                              
                              setBrokers([...brokers, {
                                name: currentBrokerForm.name,
                                email: currentBrokerForm.email,
                                phone: currentBrokerForm.phone,
                                policies: selectedPolicies
                              }]);
                              
                              setCurrentBrokerForm({ name: '', email: '', phone: '' });
                              setCurrentBrokerPolicies({ gl: false, umbrella: false, auto: false, wc: false });
                              setError('');
                              setStep('add-broker');
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            disabled={saveBrokerMutation.isPending}
                          >
                            Add Broker
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Assigned Brokers Summary */}
                    {brokers.length > 0 && (
                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                        <h3 className="font-semibold text-emerald-900">Assigned Brokers</h3>
                        {brokers.map((broker, idx) => (
                          <div key={idx} className="p-3 bg-white rounded border border-emerald-200">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-slate-900">{broker.name}</p>
                                <p className="text-sm text-slate-600">{broker.email}</p>
                                <p className="text-xs text-slate-500 mt-2">
                                  Policies: {broker.policies.map(p => 
                                    allPolicies.find(ap => ap.key === p)?.label
                                  ).join(', ')}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setBrokers(brokers.filter((_, i) => i !== idx));
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Remaining Policies */}
                    {availablePolicies.length > 0 && brokers.length > 0 && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-900">
                          <strong>Remaining policies:</strong> {availablePolicies.map(p => p.label).join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Submit when all policies assigned or skip remaining */}
                    {brokers.length > 0 && (
                      <div className="flex gap-3">
                        {availablePolicies.length > 0 && (
                          <Button
                            onClick={() => saveBrokerMutation.mutate()}
                            variant="outline"
                            className="flex-1"
                            disabled={saveBrokerMutation.isPending}
                          >
                            Save & Skip Remaining
                          </Button>
                        )}
                        {availablePolicies.length === 0 && (
                          <Button
                            onClick={() => saveBrokerMutation.mutate()}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            disabled={saveBrokerMutation.isPending}
                          >
                            Save All Brokers
                          </Button>
                        )}
                        {step === 'add-broker' && availablePolicies.length > 0 && (
                          <Button
                            onClick={() => setStep('add-broker')}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            disabled={saveBrokerMutation.isPending}
                          >
                            Add Another Broker
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button - Global Only */}
                {uploadType === 'global' && (
                  <div className="pt-4 flex gap-3">
                    <Button
                      type="submit"
                      disabled={saveBrokerMutation.isPending || !globalBroker.broker_name || !globalBroker.broker_email}
                      className="flex-1 bg-red-600 hover:bg-red-700 h-12 text-base"
                    >
                      {saveBrokerMutation.isPending ? 'Saving...' : 'Save Broker Information'}
                    </Button>
                  </div>
                )}
              </form>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Your broker will receive an email with next steps for uploading your insurance documents.</p>
        </div>
      </div>
    </div>
  );
}