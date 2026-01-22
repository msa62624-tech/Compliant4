
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

/**
 * NotificationBadge - Shows unread notification count
 * 
 * @param {string} recipientId - ID of the user/entity receiving notifications
 * @param {string} recipientType - Type: 'admin', 'broker', 'subcontractor', 'gc'
 */
export default function NotificationBadge({ recipientId, recipientType }) {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', recipientId, recipientType],
    queryFn: async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 
                       window.location.origin.replace(':5173', ':3001');
        const response = await fetch(
          `${apiBase}/notifications?recipient_id=${recipientId}&recipient_type=${recipientType}&is_read=false`,
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
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!recipientId && !!recipientType
  });

  const unreadCount = notifications.length;

  if (unreadCount === 0) {
    return (
      <div className="relative inline-block">
        <Bell className="w-5 h-5 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <Bell className="w-5 h-5 text-slate-700" />
      <Badge 
        className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 px-1 bg-red-600 text-white text-xs font-bold rounded-full"
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </Badge>
    </div>
  );
}
