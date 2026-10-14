import { Outlet, ScrollRestoration } from "react-router-dom";
import { AuthMenu } from "../components/auth/AuthMenu";

export function App() {
  return (
    <>
      <ScrollRestoration />
      <AuthMenu />
      <Outlet />
    </>
  );
}

