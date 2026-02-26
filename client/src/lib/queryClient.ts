import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    const message =
      (payload && typeof payload === 'object' && (payload.error || payload.message))
        ? String(payload.error || payload.message)
        : String(text || res.statusText || `HTTP ${res.status}`);

    const err = new Error(message) as Error & { status?: number; payload?: any; code?: string };
    err.status = res.status;
    err.payload = payload;
    if (payload && typeof payload === 'object' && payload.code) {
      err.code = String(payload.code);
    }
    throw err;
  }
}

function getPreferredLanguage(): string {
  try {
    const saved = localStorage.getItem('language');
    return (saved && typeof saved === 'string' ? saved : 'en') || 'en';
  } catch {
    return 'en';
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const lang = getPreferredLanguage();
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      'Accept-Language': lang,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
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
    const lang = getPreferredLanguage();
    const res = await fetch(queryKey.join("/") as string, {
      headers: {
        Accept: "application/json",
        'Accept-Language': lang,
      },
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
