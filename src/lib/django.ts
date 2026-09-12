export interface DjangoAuthSession {
  authenticated: boolean;
  user?: { id: string; email: string };
  member?: { user_id: string; display_name: string; role: "owner" | "member" };
}

const configuredBase = (import.meta.env.VITE_DJANGO_API_URL || "").replace(
  /\/$/,
  "",
);
export const djangoApiBase = configuredBase;
let csrfToken = "";

export class DjangoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function apiUrl(path: string) {
  return `${configuredBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function csrfCookie() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function ensureCsrf() {
  const cookie = csrfCookie();
  if (cookie) {
    csrfToken = cookie;
    return csrfToken;
  }
  if (csrfToken) return csrfToken;
  const response = await fetch(apiUrl("/api/auth/csrf/"), {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new DjangoApiError("Could not open the room.", response.status);
  const payload = (await response.json()) as { csrfToken?: unknown };
  if (typeof payload.csrfToken === "string") csrfToken = payload.csrfToken;
  return csrfToken;
}

export async function djangoRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await ensureCsrf();
    if (token) headers.set("X-CSRFToken", token);
  }
  const response = await fetch(apiUrl(path), {
    ...init,
    method,
    headers,
    credentials: "include",
    signal: init.signal || AbortSignal.timeout(30_000),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* Keep the generic status error below. */
  }
  if (
    payload &&
    typeof payload === "object" &&
    "csrfToken" in payload &&
    typeof payload.csrfToken === "string"
  )
    csrfToken = payload.csrfToken;
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("django-auth-expired"));
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : response.status === 401
          ? "Sign in required."
          : "The room could not complete that request.";
    throw new DjangoApiError(message, response.status);
  }
  return payload as T;
}

export const djangoAuth = {
  session: () => djangoRequest<DjangoAuthSession>("/api/auth/session/"),
  login: (email: string, password: string) =>
    djangoRequest<DjangoAuthSession>("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    djangoRequest<{ authenticated: false }>("/api/auth/logout/", {
      method: "POST",
    }),
  setPassword: (password: string, confirm: string) =>
    djangoRequest<{ ok: true }>("/api/auth/password/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    }),
  recover: (email: string) =>
    djangoRequest<{ message: string }>("/api/auth/password-reset/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  reset: (token: string, password: string, confirm: string) =>
    djangoRequest<DjangoAuthSession>("/api/auth/password-reset/confirm/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirm }),
    }),
};

export function isDjangoConfigured() {
  return (
    Boolean(configuredBase) ||
    window.location.protocol === "http:" ||
    window.location.protocol === "https:"
  );
}
