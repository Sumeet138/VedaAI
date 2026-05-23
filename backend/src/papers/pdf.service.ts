import puppeteer, { type Browser } from 'puppeteer';
import { env } from '../config/env';

const IDLE_KILL_MS = 5 * 60 * 1000;     // close browser after 5 min idle
const NAV_TIMEOUT_MS = 30_000;
const RENDER_WAIT_MS = 8_000;

let browserInstance: Browser | null = null;
let lastUsed = 0;
let idleTimer: NodeJS.Timeout | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    lastUsed = Date.now();
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  lastUsed = Date.now();
  scheduleIdleKill();
  return browserInstance;
}

function scheduleIdleKill() {
  if (idleTimer) return;
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (!browserInstance) return;
    if (Date.now() - lastUsed >= IDLE_KILL_MS) {
      const b = browserInstance;
      browserInstance = null;
      await b.close().catch(() => {});
    } else {
      scheduleIdleKill();
    }
  }, IDLE_KILL_MS);
  idleTimer.unref?.();
}

export const pdfService = {
  async renderPaperPdf(assignmentId: string): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      const url = `${env.FRONTEND_URL.replace(/\/$/, '')}/print/${assignmentId}`;

      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS });

      // Fail fast if the client reported a fetch error
      const clientError = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => ((globalThis as any).__PAPER_ERROR as string | undefined) ?? null,
      );
      if (clientError) {
        throw new Error(`Print page failed to load paper: ${clientError}`);
      }

      // Print page sets window.__PAPER_READY once paper data + fonts are ready.
      // Then wait for async renderers (Mermaid, function-plot) to leave pending state.
      const readyCheck = `
        (() => {
          if (!window.__PAPER_READY) return false;
          if (document.querySelector('[data-plot-status="pending"]')) return false;
          if (document.querySelector('[data-mermaid-status="pending"]')) return false;
          return true;
        })()`;
      await page
        .waitForFunction(readyCheck, { timeout: RENDER_WAIT_MS })
        .catch(() => {
          // Best-effort — async renderers may be slow; PDF will include error boxes if any failed
        });

      // Final paint flush
      await new Promise((resolve) => setTimeout(resolve, 400));

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close().catch(() => {});
    }
  },

  async shutdown(): Promise<void> {
    if (browserInstance) {
      const b = browserInstance;
      browserInstance = null;
      await b.close().catch(() => {});
    }
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  },
};
