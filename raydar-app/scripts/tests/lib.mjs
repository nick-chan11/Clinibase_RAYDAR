// Shared test plumbing: start RAYDAR's dev server on a free port and load Playwright.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function playwright() {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch (e) {
    console.error('Playwright is needed for the RAYDAR tests. On a laptop, run once in raydar-app/:\n  npm install --no-save playwright\n  npx playwright install chromium');
    process.exit(2);
  }
}

/** Start Vite on a free port; returns { url, close } */
export async function startRaydar() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: APP, logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.close() };
}

/** A page that never touches the network except RAYDAR itself (icons and fonts are skipped) */
export async function openPage(browser, url, opts) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...(opts || {}) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  if (url) { await page.goto(url); await page.waitForTimeout(800); }
  return { page, errors };
}
