import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export function useAdmin() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ["/api/user/roles"],
    enabled: !!user,
  });
  
  return {
    isAdmin: data?.isAdmin || false,
    roles: data?.roles || [],
    isLoading,
  };
}