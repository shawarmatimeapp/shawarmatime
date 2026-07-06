import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/shawarmatime/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "index.html"),
        admin: resolve(projectRoot, "admin/index.html"),
        paymentSuccess: resolve(projectRoot, "payment-success.html")
      }
    }
  }
});
