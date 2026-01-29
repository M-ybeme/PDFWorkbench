import { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import ToolPlaceholder from "./pages/ToolPlaceholder";
import NotFoundPage from "./pages/NotFoundPage";
import { toolRoutes } from "./data/toolRoutes";

const PdfViewerPage = lazy(() => import("./pages/PdfViewerPage"));
const MergeToolPage = lazy(() => import("./pages/MergeToolPage"));
const SplitToolPage = lazy(() => import("./pages/SplitToolPage"));

const suspenseFallback = (label: string) => (
  <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/80 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
    Loading {label}...
  </div>
);

const viewerElement = (
  <Suspense fallback={suspenseFallback("viewer")}>
    <PdfViewerPage />
  </Suspense>
);

const mergeElement = (
  <Suspense fallback={suspenseFallback("merge workspace")}>
    <MergeToolPage />
  </Suspense>
);

const splitElement = (
  <Suspense fallback={suspenseFallback("split workspace")}>
    <SplitToolPage />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <LandingPage /> },
      ...toolRoutes.map((tool) => ({
        path: tool.path,
        element:
          tool.id === "viewer" ? (
            viewerElement
          ) : tool.id === "merge" ? (
            mergeElement
          ) : tool.id === "split" ? (
            splitElement
          ) : (
            <ToolPlaceholder tool={tool} />
          ),
      })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default router;
