import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  AlertTriangle, 
  User,
  Mail,
  Phone,
  Building2,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { notifyBrokerAssignment } from "@/brokerNotifications";

export default function BrokerVerification() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const coiId = urlParams.get('coiId');
  
  const [verificationMode, setVerificationMode] = useState(null); // 'confirm' or 'update'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  
  const [newBrokerData, setNewBrokerData] = useState({
    broker_name: '',
    broker_email: '',
    broker_phone: '',
    broker_company: ''
  });

  // Fetch the COI details
  const { data: coi, isLoading: coiLoading } = useQuery({
    queryKey: ['coi-verification', coiId],
    queryFn: async () => {
      const cois = await compliant.entities.GeneratedCOI.list();
      return cois.find(c => c.id === coiId);
    },
    enabled: !!coiId,
  });

  // Fetch subcontractor details
  const { data: subcontractor } = useQuery({
    queryKey: ['subcontractor-for-verification', coi?.subcontractor_id],
    queryFn: async () => {
      if (!coi?.subcontractor_id) return null;
      const contractors = await compliant.entities.Contractor.list();
      return contractors.find(c => c.id === coi.subcontractor_id);
    },
    enabled: !!coi?.subcontractor_id,
  });

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.GeneratedCOI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['coi-verification']);
    }
  });

  const updateSubcontractorMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subcontractor-for-verification']);
    }
  });

  const handleConfirmBroker = async () => {
    if (!coi || !subcontractor) return;
    
    setIsSubmitting(true);
    try {
      // Mark broker as verified for this renewal
      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: {
          broker_verified_at_renewal: true,
          broker_verification_date: new Date().toISOString()
        }
      });
      
      setVerificationComplete(true);
    } catch (error) {
      console.error('Error confirming broker:', error);
      alert('Failed to confirm broker. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBroker = async () => {
    if (!coi || !subcontractor) return;
    
    // Validate new broker data
    if (!newBrokerData.broker_email || !newBrokerData.broker_name) {
      alert('Please provide broker name and email');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const oldBrokerEmail = subcontractor.broker_email;
      
      // Update subcontractor with new broker info
      await updateSubcontractorMutation.mutateAsync({
        id: subcontractor.id,
        data: {
          broker_name: newBrokerData.broker_name,
          broker_email: newBrokerData.broker_email,
          broker_phone: newBrokerData.broker_phone || subcontractor.broker_phone,
          broker_company: newBrokerData.broker_company || subcontractor.broker_company
        }
      });
      
      // Update COI with verification
      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: {
          broker_verified_at_renewal: true,
          broker_verification_date: new Date().toISOString(),
          broker_email: newBrokerData.broker_email,
          broker_name: newBrokerData.broker_name,
          broker_phone: newBrokerData.broker_phone || coi.broker_phone,
          broker_company: newBrokerData.broker_company || coi.broker_company
        }
      });
      
      // Send notification emails to old broker, new broker, and subcontractor
      const updatedSubcontractor = {
        ...subcontractor,
        ...newBrokerData
      };
      
      try {
        await notifyBrokerAssignment(
          updatedSubcontractor,
          oldBrokerEmail,
          false, // Not first time
          null
        );
      } catch (notifyError) {
        console.error('Error sending broker change notifications:', notifyError);
        // Continue even if notifications fail
      }
      
      setVerificationComplete(true);
    } catch (error) {
      console.error('Error updating broker:', error);
      alert('Failed to update broker. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!coiId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
            <p className="text-slate-600">This verification link is invalid or incomplete.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (coiLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto text-red-600 mb-4 animate-spin" />
            <p className="text-slate-600 font-medium">Loading verification details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!coi || !subcontractor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Not Found</h2>
            <p className="text-slate-600">Certificate or subcontractor information not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already verified
  if (coi.broker_verified_at_renewal && !verificationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-200">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Already Verified</h2>
            <p className="text-slate-600">
              Broker information has already been verified for this renewal cycle.
            </p>
            {coi.broker_verification_date && (
              <p className="text-sm text-slate-500 mt-2">
                Verified on: {format(new Date(coi.broker_verification_date), 'MMMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-200">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Verification Complete!</h2>
            <p className="text-slate-600 mb-4">
              Thank you for verifying your broker information. 
              {verificationMode === 'update' && ' Notifications have been sent to all parties.'}
            </p>
            <p className="text-sm text-slate-500">
              Your insurance broker will handle the renewal process.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        {/* Header */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Broker Verification Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-900">
              Your insurance policies are up for renewal. Please verify your broker information to proceed.
            </p>
          </CardContent>
        </Card>

        {/* Subcontractor Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Renewal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Company</p>
                <p className="font-medium">{subcontractor.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Policy Expiration</p>
                <p className="font-medium">
                  {coi.gl_expiration_date 
                    ? format(new Date(coi.gl_expiration_date), 'MMMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Broker Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Broker Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 mt-1" />
              <div>
                <p className="text-sm text-slate-500">Broker Name</p>
                <p className="font-medium">{subcontractor.broker_name || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 mt-1" />
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{subcontractor.broker_email || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 mt-1" />
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium">{subcontractor.broker_phone || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-slate-400 mt-1" />
              <div>
                <p className="text-sm text-slate-500">Company</p>
                <p className="font-medium">{subcontractor.broker_company || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Information */}
        {!verificationMode && (
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Why Verify Your Broker?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-red-900 space-y-2">
              <p>
                As your insurance policies approach renewal, it&apos;s essential to verify your broker&apos;s contact information to ensure:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your broker receives timely renewal reminders</li>
                <li>Updated certificates are uploaded to the correct portal</li>
                <li>All parties are notified of policy changes</li>
                <li>Compliance requirements are met without delays</li>
              </ul>
              <p className="mt-3">
                <strong>Please review the broker information above carefully</strong> and choose the appropriate action below.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Verification Options */}
        {!verificationMode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose Verification Option</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setVerificationMode('confirm')}
                className="w-full h-auto flex-col items-start p-6 bg-green-600 hover:bg-green-700 text-white"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-lg font-semibold">Confirm Existing Broker</span>
                </div>
                <span className="text-sm font-normal text-green-100">
                  The broker information above is correct and current
                </span>
              </Button>

              <Button
                onClick={() => setVerificationMode('update')}
                className="w-full h-auto flex-col items-start p-6 bg-red-600 hover:bg-red-700 text-white"
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5" />
                  <span className="text-lg font-semibold">Update Broker Information</span>
                </div>
                <span className="text-sm font-normal text-red-100">
                  I need to change or update my broker details
                </span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Confirm Broker */}
        {verificationMode === 'confirm' && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-lg text-green-900">Confirm Broker Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-900">
                  By confirming, you verify that the broker information shown above is correct and will handle your renewal.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmBroker}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm Broker
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setVerificationMode(null)}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Update Broker */}
        {verificationMode === 'update' && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-lg text-red-900">Update Broker Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-900">
                  Enter your new broker&apos;s information. We will notify both the old and new broker about this change.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="broker_name">Broker Name *</Label>
                  <Input
                    id="broker_name"
                    value={newBrokerData.broker_name}
                    onChange={(e) => setNewBrokerData({...newBrokerData, broker_name: e.target.value})}
                    placeholder="Enter broker's full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broker_email">Broker Email *</Label>
                  <Input
                    id="broker_email"
                    type="email"
                    value={newBrokerData.broker_email}
                    onChange={(e) => setNewBrokerData({...newBrokerData, broker_email: e.target.value})}
                    placeholder="broker@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broker_phone">Broker Phone</Label>
                  <Input
                    id="broker_phone"
                    value={newBrokerData.broker_phone}
                    onChange={(e) => setNewBrokerData({...newBrokerData, broker_phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broker_company">Broker Company</Label>
                  <Input
                    id="broker_company"
                    value={newBrokerData.broker_company}
                    onChange={(e) => setNewBrokerData({...newBrokerData, broker_company: e.target.value})}
                    placeholder="Insurance Company Name"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleUpdateBroker}
                  disabled={isSubmitting || !newBrokerData.broker_name || !newBrokerData.broker_email}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Update & Verify
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setVerificationMode(null)}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
