import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";

// Extended user type that includes permissions and roles
type ExtendedUser = User & {
  permissions?: string[];
  roles?: { name: string; displayName: string }[];
  isAdmin?: boolean;
};

type AuthContextType = {
  user: ExtendedUser | null;
  isLoading: boolean;
  signUp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isAuthenticated: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ name: string; displayName: string }[]>([]);
  
  // Fetch user data using React Query
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
  
  // Fetch permissions when user is authenticated
  useEffect(() => {
    if (user?.id) {
      // Fetch user permissions
      fetch('/api/auth/permissions')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setPermissions(data.permissions || []);
            setRoles(data.roles || []);
          }
        })
        .catch(console.error);
    } else {
      setPermissions([]);
      setRoles([]);
    }
  }, [user?.id]);

  const signUp = async (email: string) => {
    // With Replit Auth, redirect to login
    window.location.href = '/api/login';
  };

  const signOut = async () => {
    // Redirect to Replit Auth logout
    window.location.href = '/api/logout';
  };

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  const isAdmin = () => {
    return roles.some(role => 
      role.name === 'super_admin' || 
      role.name === 'event_moderator'
    );
  };

  const value: AuthContextType = {
    user: user ? { ...user, permissions, roles, isAdmin: isAdmin() } : null,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signOut,
    hasPermission,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}