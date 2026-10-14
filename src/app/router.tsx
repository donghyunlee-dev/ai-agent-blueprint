import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { ProjectPage } from "../pages/ProjectPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "blueprints/new", element: <HomePage /> },
          { path: "blueprints/:projectId", element: <ProjectPage /> },
          { path: "blueprints/:projectId/:documentType", element: <ProjectPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
