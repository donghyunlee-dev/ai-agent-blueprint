import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createOwnerContextLifecycle } from "./ownerContext.js";
import type { OwnerContextLifecycle } from "./ownerContext.js";

export type AuthUser = { issuer: string; subject: string; email?: string };
export type AuthStatus = "checking" | "anonymous" | "authenticated" | "expired" | "error" | "redirecting";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  ownerKey: string | null;
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
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const redirectStarted = useRef(false);
  const logoutStarted = useRef(false);
  const verifiedIdentity = useRef<{ issuer: string; subject: string } | null>(null);
  const lifecycleRef = useRef<OwnerContextLifecycle | null>(null);
  if (!lifecycleRef.current) lifecycleRef.current = createOwnerContextLifecycle();
  const lifecycle = lifecycleRef.current;

  const clearSessionState = useCallback(() => {
    setOwnerKey(null);
    setUser(null);
    verifiedIdentity.current = null;
    window.dispatchEvent(new Event("blueprint:clear-session-state"));
  }, []);

  const checkSession = useCallback(async () => {
    if (logoutStarted.current) return;
    const generation = lifecycle.beginCheck();
    setOwnerKey(null);
    setUser(null);
    setStatus("checking");
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      if (!lifecycle.isCurrent(generation)) return;
      if (response.status === 401) {
        lifecycle.revoke();
        clearSessionState();
        setStatus("anonymous");
        return;
      }
      if (!response.ok) throw new Error("SESSION_UNAVAILABLE");
      const result = await response.json();
      if (!lifecycle.isCurrent(generation)) return;
      if (result?.authenticated !== true || typeof result.user?.issuer !== "string" || typeof result.user?.subject !== "string") throw new Error("SESSION_INVALID");
      const nextUser = result.user as AuthUser;
      const previousIdentity = verifiedIdentity.current;
      if (previousIdentity && (previousIdentity.issuer !== nextUser.issuer || previousIdentity.subject !== nextUser.subject)) {
        window.dispatchEvent(new Event("blueprint:clear-session-state"));
      }
      const activated = await lifecycle.activate(generation, nextUser);
      if (!activated || !lifecycle.isCurrent(generation)) return;
      setOwnerKey(lifecycle.snapshot().ownerKey);
      setUser(nextUser);
      verifiedIdentity.current = { issuer: nextUser.issuer, subject: nextUser.subject };
      setStatus("authenticated");
    } catch {
      if (!lifecycle.isCurrent(generation)) return;
      lifecycle.revoke();
      clearSessionState();
      setStatus("error");
    }
  }, [clearSessionState, lifecycle]);

  useEffect(() => {
    void checkSession();
    const expired = () => {
      lifecycle.revoke();
      clearSessionState();
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
  }, [checkSession, clearSessionState, lifecycle]);

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
    lifecycle.revoke();
    clearSessionState();
    setStatus("redirecting");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      window.location.replace("/login");
      return true;
    } catch {
      logoutStarted.current = false;
      void checkSession();
      return false;
    }
  }, [checkSession, clearSessionState, lifecycle, status]);

  const availableOwnerKey = status === "authenticated" ? ownerKey : null;
  const value = useMemo(() => ({ status, user, ownerKey: availableOwnerKey, checkSession, startLogin, logout }), [status, user, availableOwnerKey, checkSession, startLogin, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
