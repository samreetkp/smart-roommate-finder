import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rentcastKey = env.RENTCAST_API_KEY ?? "";

  const rentcastProxy = {
    target: "https://api.rentcast.io/v1",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/rentcast/, ""),
    configure: (proxy: { on: (event: string, fn: (proxyReq: { setHeader: (n: string, v: string) => void }) => void) => void }) => {
      proxy.on("proxyReq", (proxyReq) => {
        if (rentcastKey) proxyReq.setHeader("X-Api-Key", rentcastKey);
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/rentcast": rentcastProxy,
      },
    },
    preview: {
      proxy: {
        "/api/rentcast": rentcastProxy,
      },
    },
  };
});
