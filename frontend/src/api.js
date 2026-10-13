const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? (payload.detail || payload.message) : payload;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return payload;
}

export const api = {
  health: () => apiRequest("/health"),
  dashboard: () => apiRequest("/dashboard"),
  exceptions: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value && !String(value).startsWith("All ")));
    return apiRequest(`/exceptions${query.size ? `?${query}` : ""}`);
  },
  audit: () => apiRequest("/audit"),
  copilot: (body) => apiRequest("/copilot", { method: "POST", body: JSON.stringify(body) }),
  review: (id, body) => apiRequest(`/exceptions/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(body) }),
  reset: () => apiRequest("/demo/reset", { method: "POST" }),
  financeSummary: () => apiRequest("/finance/summary"),
  policies: (params = {}) => { const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v && !String(v).startsWith("All "))); return apiRequest(`/policies${q.size ? `?${q}` : ""}`); },
  policyAction: (id, body) => apiRequest(`/policies/${encodeURIComponent(id)}/action`, { method: "POST", body: JSON.stringify(body) }),
  agencyBilling: (params = {}) => { const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v && !String(v).startsWith("All "))); return apiRequest(`/agency-billing${q.size ? `?${q}` : ""}`); },
  billingAction: (id, body) => apiRequest(`/agency-billing/${encodeURIComponent(id)}/action`, { method: "POST", body: JSON.stringify(body) }),
};
