import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signUp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
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
          toast({
            title: "Success",
            description: "You've been successfully logged in!",
          });
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
        toast({
          title: "Link Expired",
          description: "This login link has expired. Please request a new one.",
          variant: "destructive",
        });
        // Clean up the URL
        window.location.hash = '';
        setLocation('/auth');
      } else if (errorCode) {
        toast({
          title: "Authentication Error",
          description: errorDescription || "There was an error with authentication.",
          variant: "destructive",
        });
        // Clean up the URL
        window.location.hash = '';
      }
    };

    // Handle magic link on load
    handleMagicLink();

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN') {
        toast({
          title: "Success",
          description: "You've been successfully logged in!",
        });
        setLocation('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [toast, setLocation]);

  const signUp = async (email: string) => {
    try {
      // Get the current URL origin (handles both localhost and production)
      const redirectTo = window.location.origin;
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Check your email",
        description: "We've sent you a login link. Click the link or use the 6-digit code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send login email",
        variant: "destructive",
      });
      throw error;
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      
      if (error) throw error;
      
      // Success toast is handled by onAuthStateChange
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid or expired code",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
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
        verifyOtp,
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