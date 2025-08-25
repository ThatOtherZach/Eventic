import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertNotification } from "@shared/schema";

export function useNotifications() {
  const addNotification = async (notification: Omit<InsertNotification, "userId">, userId?: string) => {
    // If userId is provided, use it directly (for auth context)
    // Otherwise try to get it from current auth state
    let targetUserId = userId;
    
    if (!targetUserId) {
      // Try to get user from current session without importing useAuth to avoid circular dependency
      try {
        const response = await fetch('/api/auth/current-user');
        if (response.ok) {
          const { user } = await response.json();
          targetUserId = user?.id;
        }
      } catch (error) {
        // Silently fail if user is not authenticated - this is expected behavior
        return;
      }
    }

    if (!targetUserId) return;

    try {
      await apiRequest("POST", "/api/notifications", {
        ...notification,
        userId: targetUserId,
      });
      
      // Invalidate notifications query to show new notification
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to add notification:", error);
    }
  };

  return { addNotification };
}