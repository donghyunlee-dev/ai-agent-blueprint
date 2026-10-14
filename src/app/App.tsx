import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { AuthMenu } from "../components/auth/AuthMenu";

export function App() {
  const { pathname } = useLocation();
  const isWorkspace = /^\/blueprints\/[^/]+(?:\/[^/]+)?$/.test(pathname);
  return (
    <>
      <ScrollRestoration />
      {!isWorkspace ? <AuthMenu /> : null}
      <Outlet />
    </>
  );
}

