import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertNotification } from "@shared/schema";

export function useNotifications() {
  const { user } = useAuth();

  const addNotification = async (notification: Omit<InsertNotification, "userId">) => {
    if (!user) return;

    try {
      await apiRequest("POST", "/api/notifications", {
        ...notification,
        userId: user.id,
      });
      
      // Invalidate notifications query to show new notification
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to add notification:", error);
    }
  };

  return { addNotification };
}