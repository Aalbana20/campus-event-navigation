import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ["index.html", "src/**/*.{js,jsx,ts,tsx}"],
    force: true,
  },
  server: {
    hmr: false,
    watch: {
      ignored: [
        "**/mobile/**",
        "**/supabase/**",
        "**/.git/**",
        "**/node_modules/**",
      ],
    },
    fs: {
      deny: ["mobile/**"],
    },
  },
})
