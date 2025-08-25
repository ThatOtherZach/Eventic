import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Notification, NotificationPreferences } from "@shared/schema";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [page, setPage] = useState(1);
  const notificationsPerPage = 10;

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: [`/api/notifications`],
    enabled: !!user,
  });

  const { data: preferences } = useQuery<NotificationPreferences>({
    queryKey: [`/api/notification-preferences`],
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications`] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/notifications/mark-all-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications`] });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      return apiRequest("PATCH", `/api/notification-preferences`, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notification-preferences`] });
    },
  });

  if (!user) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <h2>Sign in to view notifications</h2>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const totalPages = Math.ceil(notifications.length / notificationsPerPage);
  const paginatedNotifications = notifications.slice(
    (page - 1) * notificationsPerPage,
    page * notificationsPerPage
  );

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center">
              <Bell size={24} className="me-2" />
              <h1 className="mb-0">Notifications</h1>
              {unreadCount > 0 && (
                <span className="badge bg-danger ms-2" data-testid="text-unread-count">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="btn-group">
              {unreadCount > 0 && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  data-testid="button-mark-all-read"
                >
                  Mark All Read
                </button>
              )}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowSettings(!showSettings)}
                data-testid="button-notification-settings"
              >
                <Settings size={16} className="me-1" />
                Settings
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title">Notification Preferences</h5>
                <div className="row">
                  {preferences && [
                    { key: 'systemNotifications', label: 'System Notifications', description: 'Error logs and system updates' },
                    { key: 'validationNotifications', label: 'Validation Notifications', description: 'Ticket validation results' },
                    { key: 'authNotifications', label: 'Authentication Notifications', description: 'Login and sign-up messages' },
                    { key: 'eventNotifications', label: 'Event Notifications', description: 'Event creation and updates' },
                    { key: 'ticketNotifications', label: 'Ticket Notifications', description: 'Ticket purchases and updates' },
                    { key: 'cameraNotifications', label: 'Camera Notifications', description: 'Scanner camera status updates' },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="col-md-6 mb-3">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={key}
                          checked={preferences[key as keyof NotificationPreferences] as boolean}
                          onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                          data-testid={`toggle-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                        />
                        <label className="form-check-label" htmlFor={key}>
                          <strong>{label}</strong>
                          <br />
                          <small className="text-muted">{description}</small>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-5">
              <Bell size={48} className="text-muted mb-3" />
              <h4 className="text-muted">No notifications yet</h4>
              <p className="text-muted">When you receive notifications, they'll appear here.</p>
            </div>
          ) : (
            <>
              <div className="list-group mb-4">
                {paginatedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`list-group-item ${!notification.isRead ? 'list-group-item-primary' : ''}`}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="d-flex align-items-center mb-1">
                          <h6 className="mb-0 me-2">{notification.title}</h6>
                          <span className={`badge bg-secondary`}>
                            {notification.type}
                          </span>
                          {!notification.isRead && (
                            <span className="badge bg-primary ms-1">New</span>
                          )}
                        </div>
                        <p className="mb-1 text-muted">{notification.description}</p>
                      </div>
                      <div className="text-end" style={{ minWidth: '120px' }}>
                        <small className="text-muted d-block">
                          {notification.createdAt ? format(new Date(notification.createdAt), "MMM d, h:mm a") : "Just now"}
                        </small>
                        {!notification.isRead && (
                          <button
                            className="btn btn-link btn-sm p-0 mt-1"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <nav aria-label="Notifications pagination">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </li>
                    <li className="page-item active">
                      <span className="page-link" data-testid="text-current-page">
                        {page} of {totalPages}
                      </span>
                    </li>
                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}