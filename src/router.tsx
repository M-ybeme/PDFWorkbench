import { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import ToolPlaceholder from "./pages/ToolPlaceholder";
import NotFoundPage from "./pages/NotFoundPage";
import { toolRoutes } from "./data/toolRoutes";

const PdfViewerPage = lazy(() => import("./pages/PdfViewerPage"));
const MergeToolPage = lazy(() => import("./pages/MergeToolPage"));
const SplitToolPage = lazy(() => import("./pages/SplitToolPage"));
const PageEditorPage = lazy(() => import("./pages/PageEditorPage"));
const ImagesToPdfPage = lazy(() => import("./pages/ImagesToPdfPage"));
const CompressionToolPage = lazy(() => import("./pages/CompressionToolPage"));
const SignaturesToolPage = lazy(() => import("./pages/SignaturesToolPage"));
const PdfToImagesPage = lazy(() => import("./pages/PdfToImagesPage"));

const suspenseFallback = (label: string) => (
  <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/80 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
    Loading {label}...
  </div>
);

const viewerElement = (
  <ErrorBoundary toolName="viewer">
    <Suspense fallback={suspenseFallback("viewer")}>
      <PdfViewerPage />
    </Suspense>
  </ErrorBoundary>
);

const mergeElement = (
  <ErrorBoundary toolName="merge workspace">
    <Suspense fallback={suspenseFallback("merge workspace")}>
      <MergeToolPage />
    </Suspense>
  </ErrorBoundary>
);

const splitElement = (
  <ErrorBoundary toolName="split workspace">
    <Suspense fallback={suspenseFallback("split workspace")}>
      <SplitToolPage />
    </Suspense>
  </ErrorBoundary>
);

const editorElement = (
  <ErrorBoundary toolName="page editor">
    <Suspense fallback={suspenseFallback("page editor")}>
      <PageEditorPage />
    </Suspense>
  </ErrorBoundary>
);

const imagesElement = (
  <ErrorBoundary toolName="images workspace">
    <Suspense fallback={suspenseFallback("images workspace")}>
      <ImagesToPdfPage />
    </Suspense>
  </ErrorBoundary>
);

const compressionElement = (
  <ErrorBoundary toolName="compression workspace">
    <Suspense fallback={suspenseFallback("compression workspace")}>
      <CompressionToolPage />
    </Suspense>
  </ErrorBoundary>
);

const signaturesElement = (
  <ErrorBoundary toolName="signatures workspace">
    <Suspense fallback={suspenseFallback("signatures workspace")}>
      <SignaturesToolPage />
    </Suspense>
  </ErrorBoundary>
);

const pdfToImagesElement = (
  <ErrorBoundary toolName="PDF to images workspace">
    <Suspense fallback={suspenseFallback("PDF to images workspace")}>
      <PdfToImagesPage />
    </Suspense>
  </ErrorBoundary>
);

const router = createBrowserRouter(
  [
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
            ) : tool.id === "editor" ? (
              editorElement
            ) : tool.id === "images" ? (
              imagesElement
            ) : tool.id === "compression" ? (
              compressionElement
            ) : tool.id === "signatures" ? (
              signaturesElement
            ) : tool.id === "pdf-to-images" ? (
              pdfToImagesElement
            ) : (
              <ToolPlaceholder tool={tool} />
            ),
        })),
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { future: { v7_relativeSplatPath: true } },
);

export default router;
