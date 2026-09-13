import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { localDrillyPlugin } from "./server/drilly/local";

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const key = process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  const model = process.env.DRILLY_MODEL ?? env.DRILLY_MODEL;
  return {
    define: {
      "import.meta.env.VITE_LOCAL_DRILLY": JSON.stringify(
        command === "serve" && Boolean(key),
      ),
    },
    plugins: [react(), tailwindcss(), localDrillyPlugin(key, model)],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
