import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/hooks/use-notifications";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signUp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

// Helper to get the correct redirect URL
function getRedirectUrl() {
  // Check if we're running on Replit
  const replitDomain = import.meta.env.VITE_REPLIT_DEV_DOMAIN || import.meta.env.REPLIT_DEV_DOMAIN;
  
  if (replitDomain) {
    // We're on Replit, use the public URL
    return `https://${replitDomain}`;
  }
  
  // Fallback to current origin (works for both localhost and production)
  return window.location.origin;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { addNotification } = useNotifications();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for magic link authentication in URL
    const handleMagicLink = async () => {
      // Check if we have auth tokens in the URL (from magic link)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // We have tokens from a magic link, set the session
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (data.session) {
          setUser(data.session.user);
          
          // Sync user to local database only once during login
          try {
            const response = await fetch('/api/auth/sync-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                email: data.session.user.email,
                name: data.session.user.user_metadata?.name || data.session.user.email?.split('@')[0],
              }),
            });
            
            if (!response.ok) {
              console.error('Failed to sync user');
            }
          } catch (error) {
            console.error('Failed to sync user:', error);
          }
          
          addNotification({
            type: "success",
            title: "Success",
            description: "You've been successfully logged in!",
          }, data.session.user.id);
          // Clean up the URL
          window.location.hash = '';
          setLocation('/');
        } else if (error) {
          console.error('Failed to set session:', error);
        }
      }
      
      // Handle error messages in URL (like expired links)
      const errorCode = hashParams.get('error_code');
      const errorDescription = hashParams.get('error_description');
      
      if (errorCode === 'otp_expired') {
        addNotification({
          type: "error",
          title: "Link Expired",
          description: "This login link has expired. Please request a new one.",
        });
        // Clean up the URL
        window.location.hash = '';
        setLocation('/auth');
      } else if (errorCode) {
        addNotification({
          type: "error",
          title: "Authentication Error",
          description: errorDescription || "There was an error with authentication.",
        });
        // Clean up the URL
        window.location.hash = '';
      }
    };

    // Handle magic link on load
    handleMagicLink();

    // Check active sessions and sets the user
    let hasRunSync = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Sync only once on initial load
        if (!hasRunSync) {
          hasRunSync = true;
          try {
            await fetch('/api/auth/sync-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
              }),
            });
          } catch (error) {
            console.error('Failed to sync user:', error);
          }
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        addNotification({
          type: "success",
          title: "Success",
          description: "You've been successfully logged in!",
        }, session.user.id);
        setLocation('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [addNotification, setLocation]);

  const signUp = async (email: string) => {
    try {
      const redirectTo = getRedirectUrl();
      console.log('Using redirect URL:', redirectTo);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      
      if (error) throw error;
      
      addNotification({
        type: "success",
        title: "Email sent!",
        description: "Check your inbox for the login link.",
      });
    } catch (error: any) {
      addNotification({
        type: "error",
        title: "Error",
        description: error.message || "Failed to send login email",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      addNotification({
        type: "info",
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
    } catch (error: any) {
      addNotification({
        type: "error",
        title: "Error",
        description: error.message || "Failed to sign out",
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}