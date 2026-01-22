import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compliant } from "@/api/compliantClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function NotificationBanner({ gcEmail }) {
  const queryClient = useQueryClient();

  // Fetch unread notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['gc-notifications', gcEmail],
    queryFn: async () => {
      try {
        const allNotifications = await compliant.entities.Notification.list();
        // Filter for this GC's unread notifications
        return allNotifications
          .filter(n => n.recipient_email === gcEmail && n.status === 'unread')
          .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      } catch (err) {
        console.error('Error fetching notifications:', err);
        return [];
      }
    },
    enabled: !!gcEmail,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mutation to mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      compliant.entities.Notification.update(notificationId, { 
        status: 'read', 
        read: true,
        read_date: new Date().toISOString() 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-notifications']);
    },
  });

  const handleDismiss = (notificationId) => {
    markAsReadMutation.mutate(notificationId);
  };

  if (isLoading || notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {notifications.map((notification) => {
        const isDocumentReplaced = notification.type === 'document_replaced';
        
        return (
          <Alert 
            key={notification.id}
            className={`${
              isDocumentReplaced 
                ? 'border-amber-500 bg-amber-50' 
                : 'border-red-500 bg-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {isDocumentReplaced ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <Bell className="h-5 w-5 text-red-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-slate-900">
                    {notification.subject}
                  </h4>
                  {isDocumentReplaced && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Pending Review
                    </Badge>
                  )}
                </div>
                
                <AlertDescription className="text-sm text-slate-700">
                  {notification.message}
                </AlertDescription>
                
                {notification.reason && (
                  <div className="mt-2 text-xs text-slate-600 italic">
                    <strong>Reason:</strong> {notification.reason}
                  </div>
                )}
                
                {notification.broker_name && (
                  <div className="mt-1 text-xs text-slate-600">
                    <strong>Broker:</strong> {notification.broker_name}
                    {notification.broker_email && ` (${notification.broker_email})`}
                  </div>
                )}
                
                <div className="mt-2 text-xs text-slate-500">
                  {format(new Date(notification.created_date), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss(notification.id)}
                className="flex-shrink-0 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
