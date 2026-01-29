import { createBrowserRouter } from "react-router-dom";

import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import ToolPlaceholder from "./pages/ToolPlaceholder";
import NotFoundPage from "./pages/NotFoundPage";
import { toolRoutes } from "./data/toolRoutes";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <LandingPage /> },
      ...toolRoutes.map((tool) => ({
        path: tool.path,
        element: <ToolPlaceholder tool={tool} />,
      })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default router;
