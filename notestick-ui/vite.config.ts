import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode, ssrBuild }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const httpServer = `http://${env.API_HOST}`;
  const wsServer = `ws://${env.API_HOST}`;

  return {
    plugins: [vue()],
    server: {
      proxy: {
        "/api": {
          target: httpServer,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/api"),
        },
        "/static": {
          target: httpServer,
          changeOrigin: true,
        },
        "/socket.io": {
          target: wsServer,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "~": path.resolve(__dirname),
      },
    },
  };
});
