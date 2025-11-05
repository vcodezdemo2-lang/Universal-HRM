import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url: string;
    
    if (typeof queryKey[0] === 'string') {
      const baseUrl = queryKey[0];
      
      // Handle array query keys with parameters
      if (queryKey.length > 1) {
        // Check if second element is an object (query params)
        if (typeof queryKey[1] === 'object' && queryKey[1] !== null && !Array.isArray(queryKey[1])) {
          const params = new URLSearchParams();
          Object.entries(queryKey[1] as Record<string, any>).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
          url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
        } else {
          // Handle path segments like ["/api/leads", id, "history"]
          const pathSegments = queryKey.slice(1).filter(segment => 
            segment !== null && segment !== undefined && typeof segment !== 'object'
          );
          url = pathSegments.length > 0 ? `${baseUrl}/${pathSegments.join('/')}` : baseUrl;
        }
      } else {
        url = baseUrl;
      }
    } else {
      throw new Error('First element of queryKey must be a string URL');
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
