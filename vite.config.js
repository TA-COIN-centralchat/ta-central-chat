import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @ffmpeg/ffmpeg + @ffmpeg/util rely on Web Workers and import.meta.url, which
  // esbuild's dependency pre-bundling mishandles and can break at load time.
  // Excluding them lets Vite serve the packages as-is (they're only pulled in
  // lazily via dynamic import for the agent voice-note feature).
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});