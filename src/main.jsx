import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./index.css";
import App from "./App.jsx";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL in your environment.");
}

const convex = new ConvexReactClient(convexUrl);
const baseUrl = import.meta.env.BASE_URL || "/";
const authStorageNamespace = `inkling-session-${convexUrl.replace(/[^a-zA-Z0-9]/g, "")}`;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${baseUrl}sw.js`).catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <ConvexAuthProvider
    client={convex}
    storage={window.localStorage}
    storageNamespace={authStorageNamespace}
  >
    <App />
  </ConvexAuthProvider>,
);
