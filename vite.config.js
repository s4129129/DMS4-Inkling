import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const enableHttpsDev = process.env.VITE_DEV_HTTPS === "1";
const productionBase = process.env.VITE_BASE_PATH || "/";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? productionBase : "/",
  plugins: [react(), enableHttpsDev ? basicSsl() : null].filter(Boolean),
  server: {
    host: process.env.VITE_DEV_HOST || "localhost",
    port: Number(process.env.VITE_DEV_PORT || 5173),
    https: enableHttpsDev ? {} : undefined,
    fs: {
      allow: [".."],
    },
  },
}));
