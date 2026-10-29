import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// port 5173 is the origin the Express CORS config allows
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
    include: ["tests/**/*.test.{js,jsx}"],
    globals: true,
  },
});
