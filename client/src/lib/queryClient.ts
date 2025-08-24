import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // System errors (500+ status codes)
    if (res.status >= 500) {
      throw new Error(`System Fault Detected: ${text} (Error ${res.status})`);
    }
    
    // Client errors (400-499 status codes)
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: HeadersInit = {};
    if (data) {
      headers["Content-Type"] = "application/json";
    }
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    // If it's already formatted as a system or client error, re-throw it
    if (error.message?.includes("System Fault Detected:") || error.message?.match(/^\d{3}:/)) {
      throw error;
    }
    
    // Network errors and other unexpected errors are system faults
    throw new Error(`System Fault Detected: ${error.message || "Network connection failed"}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(queryKey.join("/") as string, {
        headers,
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error: any) {
      // If it's already formatted as a system or client error, re-throw it
      if (error.message?.includes("System Fault Detected:") || error.message?.match(/^\d{3}:/)) {
        throw error;
      }
      
      // Network errors and other unexpected errors are system faults
      throw new Error(`System Fault Detected: ${error.message || "Network connection failed"}`);
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});