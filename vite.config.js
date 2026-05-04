import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@supabase/supabase-js", "@supabase/realtime-js"],
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
