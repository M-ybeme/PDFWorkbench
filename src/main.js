import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import "./index.css";
const container = document.getElementById("root");
if (!container) {
    throw new Error("Root container missing in index.html");
}
createRoot(container).render(_jsx(StrictMode, { children: _jsx(RouterProvider, { router: router }) }));
