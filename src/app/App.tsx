import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { AuthMenu } from "../components/auth/AuthMenu";
import { BlueprintShell } from "../components/layout/BlueprintShell";

export function App() {
  const { pathname } = useLocation();
  const isProtectedPage = pathname === '/' || pathname.startsWith('/blueprints/');
  return (
    <>
      <ScrollRestoration />
      {isProtectedPage ? <BlueprintShell><Outlet /></BlueprintShell> : <><AuthMenu /><Outlet /></>}
    </>
  );
}

