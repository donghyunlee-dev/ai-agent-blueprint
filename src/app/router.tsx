import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HomePage } from "../pages/HomePage";
import { SurveyPage } from "../pages/SurveyPage";
import { PrdPage } from "../pages/PrdPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "survey", element: <SurveyPage /> },
      { path: "prd", element: <PrdPage /> },
    ],
  },
]);
