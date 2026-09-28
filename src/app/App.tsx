import { Outlet, ScrollRestoration } from "react-router-dom";

export function App() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

