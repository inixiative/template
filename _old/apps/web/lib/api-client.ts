interface FetchOptions extends RequestInit {
  includeAuth?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiClient(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { includeAuth = true, headers = {}, ...fetchOptions } = options;

  // Get auth token if needed
  let authHeader = {};
  if (includeAuth) {
    // This would be replaced with your actual auth token logic
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  // Prepare headers with trace context for E2E tracing if Sentry is enabled
  let sentryHeaders = {};
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' && typeof window !== 'undefined') {
    try {
      const Sentry = await import("@sentry/nextjs");
      const sentryTrace = Sentry.getActiveSpan()?.toTraceparent();
      const baggage = Sentry.getBaggage();
      
      if (sentryTrace) {
        sentryHeaders["sentry-trace"] = sentryTrace;
      }
      if (baggage) {
        sentryHeaders["baggage"] = Sentry.baggageHeaderToDynamicSamplingContext(baggage);
      }
    } catch (e) {
      // Sentry not available
    }
  }
  
  const finalHeaders = {
    "Content-Type": "application/json",
    ...authHeader,
    ...sentryHeaders,
    ...headers,
  };

  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: finalHeaders,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' && typeof window !== 'undefined') {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error, {
          extra: {
            endpoint,
            method: fetchOptions.method || "GET",
          },
        });
      });
    }
    throw error;
  }
}

// Convenience methods
export const api = {
  get: (endpoint: string, options?: Omit<FetchOptions, "method">) =>
    apiClient(endpoint, { ...options, method: "GET" }),
  
  post: (endpoint: string, data?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    apiClient(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: (endpoint: string, data?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    apiClient(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: (endpoint: string, options?: Omit<FetchOptions, "method">) =>
    apiClient(endpoint, { ...options, method: "DELETE" }),
};