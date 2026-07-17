import { chromium, type Browser, type Page } from 'playwright';

const M_W_BASE = 'https://www.merriam-webster.com/dictionary/';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    // Try Chrome first, fall back to Edge
    for (const channel of ['chrome', 'msedge'] as const) {
      try {
        browser = await chromium.launch({
          headless: true,
          channel,
        });
        return browser;
      } catch {
        continue;
      }
    }
    throw new Error(
      'Neither Google Chrome nor Microsoft Edge was found. ' +
        'Please install one of them to use delve.',
    );
  }
  return browser;
}

export async function fetchPage(word: string): Promise<{ html: string; finalUrl: string }> {
  const url = M_W_BASE + encodeURIComponent(word);
  const browser = await getBrowser();

  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    });
    const page: Page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // wait for definition content or "no results" to appear
      await page
        .waitForSelector('.hword, .no-results, [data-entry]', { timeout: 10_000 })
        .catch(() => {
          // if neither appears, try waiting a bit more for JS challenge
        });

      // if we hit the security page, wait and retry
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('security service') || bodyText?.includes('verifying')) {
        await page.waitForTimeout(3000);
        await context.close();
        continue; // retry once
      }

      const html = await page.content();
      const finalUrl = page.url();
      await context.close();
      return { html, finalUrl };
    } catch (err) {
      await context.close().catch(() => {});
      throw err;
    }
  }

  throw new Error('Blocked by Merriam-Webster security. Try again in a moment.');
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
