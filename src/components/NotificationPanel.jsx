import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Bell, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

/**
 * NotificationPanel - Displays and manages notifications for a user
 * 
 * @param {string} recipientId - ID of the user/entity
 * @param {string} recipientType - Type: 'admin', 'broker', 'subcontractor', 'gc'
 * @param {function} onNotificationClick - Callback when notification is clicked
 */
export default function NotificationPanel({ recipientId, recipientType, onNotificationClick }) {
  const queryClient = useQueryClient();
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [responseText, setResponseText] = useState('');

  const apiBase = import.meta.env.VITE_API_BASE_URL || 
                 window.location.origin.replace(':5173', ':3001');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', recipientId, recipientType],
    queryFn: async () => {
      const response = await fetch(
        `${apiBase}/notifications?recipient_id=${recipientId}&recipient_type=${recipientType}`,
        {
          headers: {
            'Authorization': sessionStorage.getItem('token') 
              ? `Bearer ${sessionStorage.getItem('token')}` 
              : ''
          },
          credentials: 'include'
        }
      );
      if (!response.ok) return [];
      return await response.json();
    },
    refetchInterval: 30000
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await fetch(`${apiBase}/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionStorage.getItem('token') 
            ? `Bearer ${sessionStorage.getItem('token')}` 
            : ''
        },
        body: JSON.stringify({ is_read: true }),
        credentials: 'include'
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const respondToNotificationMutation = useMutation({
    mutationFn: async ({ notificationId, response_text, response_type }) => {
      const response = await fetch(`${apiBase}/notifications/${notificationId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionStorage.getItem('token') 
            ? `Bearer ${sessionStorage.getItem('token')}` 
            : ''
        },
        body: JSON.stringify({ response_text, response_type }),
        credentials: 'include'
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      setResponseText('');
      setSelectedNotification(null);
    }
  });

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const handleRespond = () => {
    if (!responseText.trim() || !selectedNotification) return;
    respondToNotificationMutation.mutate({
      notificationId: selectedNotification.id,
      response_text: responseText,
      response_type: 'comment'
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'coi_submitted':
      case 'coi_uploaded':
        return <Bell className="w-4 h-4" />;
      case 'deficiency_response':
      case 'admin_response':
        return <MessageSquare className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) {
    return <div className="p-4">Loading notifications...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-600 text-white">{unreadCount}</Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No notifications</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  notification.is_read 
                    ? 'bg-white border-slate-200' 
                    : 'bg-red-50 border-red-300 font-semibold'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-1 ${notification.is_read ? 'text-slate-400' : 'text-red-600'}`}>
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                      {notification.subject}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {notification.created_at && (() => {
                        try {
                          return format(new Date(notification.created_at), 'MMM d, h:mm a');
                        } catch {
                          return 'Date unavailable';
                        }
                      })()}
                    </p>
                    {notification.has_response && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Responded
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedNotification && recipientType === 'admin' && !selectedNotification.has_response && (
          <div className="mt-4 p-4 border-t">
            <h4 className="font-semibold mb-2">Respond to Notification</h4>
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Type your response..."
              className="mb-2"
              rows={4}
            />
            <Button 
              onClick={handleRespond}
              disabled={!responseText.trim() || respondToNotificationMutation.isPending}
              size="sm"
            >
              Send Response
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
