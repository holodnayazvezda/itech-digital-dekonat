import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

const proxy = {
  "/api": { target: process.env.CAMPUS_API_ORIGIN || "http://127.0.0.1:8000" },
};
export default defineConfig({
  plugins: [react(), {
    name:"local-onnx-runtime",
    configureServer(server) {
      server.middlewares.use(async(req,res,next)=>{
        // ONNX imports this public ESM file dynamically; avoid Vite's source-import handling.
        if(req.url?.split('?')[0]!=="/onnx/ort-wasm-simd-threaded.asyncify.mjs") return next();
        try {
          const code=await readFile(new URL('./public/onnx/ort-wasm-simd-threaded.asyncify.mjs',import.meta.url));
          res.setHeader('Content-Type','text/javascript');res.end(code);
        } catch {next();}
      });
    },
  }],
  build: { license: { fileName: "licenses/javascript.md" } },
  server: {
    host: "127.0.0.1",
    port: 4197,
    strictPort: true,
    proxy,
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/server/**",
        "**/*.{sqlite,sqlite3,db}",
        "**/*.sqlite-*",
      ],
    },
  },
  preview: { host: "127.0.0.1", port: 4197, proxy },
});
