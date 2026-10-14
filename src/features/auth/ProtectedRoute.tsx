import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { LoginPage } from "../../pages/LoginPage";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (status === "checking") return <LoginPage mode="checking" returnTo={returnTo} />;
  if (status === "authenticated") return <Outlet />;
  if (status === "expired") return <LoginPage mode="expired" returnTo={returnTo} />;
  if (status === "error") return <LoginPage mode="error" returnTo={returnTo} />;
  const expired = new URLSearchParams(location.search).has("sessionExpired");
  return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}${expired ? "&sessionExpired=1" : ""}`} replace />;
}
