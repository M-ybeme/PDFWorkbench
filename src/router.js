import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
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
const PageEditorPage = lazy(() => import("./pages/PageEditorPage"));
const ImagesToPdfPage = lazy(() => import("./pages/ImagesToPdfPage"));
const CompressionToolPage = lazy(() => import("./pages/CompressionToolPage"));
const suspenseFallback = (label) => (_jsxs("div", { className: "rounded-3xl border border-dashed border-slate-300/70 bg-white/80 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300", children: ["Loading ", label, "..."] }));
const viewerElement = (_jsx(Suspense, { fallback: suspenseFallback("viewer"), children: _jsx(PdfViewerPage, {}) }));
const mergeElement = (_jsx(Suspense, { fallback: suspenseFallback("merge workspace"), children: _jsx(MergeToolPage, {}) }));
const splitElement = (_jsx(Suspense, { fallback: suspenseFallback("split workspace"), children: _jsx(SplitToolPage, {}) }));
const editorElement = (_jsx(Suspense, { fallback: suspenseFallback("page editor"), children: _jsx(PageEditorPage, {}) }));
const imagesElement = (_jsx(Suspense, { fallback: suspenseFallback("images workspace"), children: _jsx(ImagesToPdfPage, {}) }));
const compressionElement = (_jsx(Suspense, { fallback: suspenseFallback("compression workspace"), children: _jsx(CompressionToolPage, {}) }));
const router = createBrowserRouter([
    {
        path: "/",
        element: _jsx(AppShell, {}),
        children: [
            { index: true, element: _jsx(LandingPage, {}) },
            ...toolRoutes.map((tool) => {
                console.log("route mapping", tool.id);
                return {
                    path: tool.path,
                    element: tool.id === "viewer" ? (viewerElement) : tool.id === "merge" ? (mergeElement) : tool.id === "split" ? (splitElement) : tool.id === "editor" ? (editorElement) : tool.id === "images" ? (imagesElement) : tool.id === "compression" ? (compressionElement) : (_jsx(ToolPlaceholder, { tool: tool })),
                };
            }),
            { path: "*", element: _jsx(NotFoundPage, {}) },
        ],
    },
]);
export default router;
