import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

function bundleStatsPlugin(): Plugin {
  return {
    name: "bundle-stats",
    apply: "build",
    generateBundle(_options, bundle) {
      interface ChunkStat {
        name: string;
        size: number;
        gzipSize: number;
        isEntry: boolean;
      }
      const chunks: ChunkStat[] = [];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk") {
          const code = typeof chunk.code === "string" ? chunk.code : String(chunk.code);
          const size = Buffer.byteLength(code, "utf8");
          const gzipSize = gzipSync(code).byteLength;
          chunks.push({
            name: fileName,
            size,
            gzipSize,
            isEntry: chunk.isEntry,
          });
        }
      }
      this.emitFile({
        type: "asset",
        fileName: "stats.json",
        source: JSON.stringify({ chunks }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleStatsPlugin()],
  server: {
    port: 5050,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "code-field": ["@monaco-editor/react", "monaco-editor"],
          "vendor-flow": ["@xyflow/react"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
});
