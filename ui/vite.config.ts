import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Alias for types directory - resolves to project root/types
      "../../types": path.resolve(__dirname, "../types"),
    },
    dedupe: ['ethers'],
  },
  build: {
    commonjsOptions: {
      include: [/types/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          ethers: ["ethers"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["ethers"],
    esbuildOptions: {
      target: 'es2020',
    },
  },
}));
