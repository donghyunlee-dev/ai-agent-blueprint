import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ index: true, element: <HomePage /> }],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
