import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/ (several files, needs a web server)
// `npm run build:single` → one self-contained HTML file, copied to ../RAYDAR_2.6.html (opens by double-click)
// The eSource files (../Pre-screening eSource JSONs) and ../RAYDAR cohort dates.json are built in.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    base: './',
    define: { __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })) },
    server: { port: 5173 },
    build: single ? { outDir: 'dist-single' } : {},
  };
});
