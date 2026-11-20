import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/ (several files, needs a web server)
// `npm run build:single` → one self-contained HTML file, copied to ../RAYDAR_2.4.html (opens by double-click)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    base: './',
    server: { port: 5173 },
    build: single ? { outDir: 'dist-single' } : {},
  };
});
