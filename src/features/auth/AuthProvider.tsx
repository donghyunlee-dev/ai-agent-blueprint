import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AuthUser = { issuer: string; subject: string; email?: string };
export type AuthStatus = "checking" | "anonymous" | "authenticated" | "expired" | "error" | "redirecting";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  checkSession: () => Promise<void>;
  startLogin: (returnTo: string) => void;
  logout: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\x00-\x1f\x7f]/.test(value)) return "/";
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login#")) return "/";
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const redirectStarted = useRef(false);
  const logoutStarted = useRef(false);

  const checkSession = useCallback(async () => {
    setStatus((current) => current === "authenticated" ? "checking" : current);
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      if (!response.ok) throw new Error("SESSION_UNAVAILABLE");
      const result = await response.json();
      if (result?.authenticated !== true || typeof result.user?.issuer !== "string" || typeof result.user?.subject !== "string") throw new Error("SESSION_INVALID");
      setUser(result.user as AuthUser);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const expired = () => {
      setUser(null);
      setStatus("expired");
    };
    const pageShown = (event: PageTransitionEvent) => {
      if (event.persisted) void checkSession();
    };
    window.addEventListener("blueprint:session-expired", expired);
    window.addEventListener("pageshow", pageShown);
    return () => {
      window.removeEventListener("blueprint:session-expired", expired);
      window.removeEventListener("pageshow", pageShown);
    };
  }, [checkSession]);

  const startLogin = useCallback((returnTo: string) => {
    if (redirectStarted.current || status === "redirecting") return;
    redirectStarted.current = true;
    setStatus("redirecting");
    const destination = safeReturnTo(returnTo);
    window.setTimeout(() => window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(destination)}`), 100);
  }, [status]);

  const logout = useCallback(async () => {
    if (logoutStarted.current || status === "redirecting") return false;
    logoutStarted.current = true;
    setStatus("redirecting");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      setUser(null);
      window.dispatchEvent(new Event("blueprint:clear-session-state"));
      window.location.replace("/login");
      return true;
    } catch {
      logoutStarted.current = false;
      setStatus("authenticated");
      return false;
    }
  }, [status]);

  const value = useMemo(() => ({ status, user, checkSession, startLogin, logout }), [status, user, checkSession, startLogin, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
