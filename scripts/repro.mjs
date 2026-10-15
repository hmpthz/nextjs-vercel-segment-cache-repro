import { chromium } from 'playwright';

const base = new URL(process.argv[2] ?? 'http://localhost:3000');
const rounds = Number(process.env.ROUNDS ?? 3);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('ROUNDS must be a positive integer');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
    : {}),
});
const result = { base: base.origin, cases: [] };

try {
  for (const initialPath of ['/zh-tw/report', '/report']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    const requestIndices = new Map();
    let phase = 'initial-load';
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['/report', '/zh-tw/report'].includes(url.pathname)) return;
      const headers = request.headers();
      const index = requests.push({
        phase,
        pathname: url.pathname,
        rsc: headers.rsc ?? null,
        segment: headers['next-router-segment-prefetch'] ?? null,
        navigation: Boolean(headers['next-router-state-tree']),
      }) - 1;
      requestIndices.set(request, index);
    });
    page.on('response', (response) => {
      const index = requestIndices.get(response.request());
      if (index === undefined) return;
      requests[index].status = response.status();
      requests[index].segmentResponseMarker = response.headers()['x-nextjs-postponed'] ?? null;
      requests[index].matchedPath = response.headers()['x-matched-path'] ?? null;
    });

    await page.goto(new URL(initialPath, base).href);
    await page.locator('nav').waitFor();
    // Let automatic Link prefetches finish before the measured switches.
    await page.waitForTimeout(2500);
    const firstLocale = initialPath === '/report' ? 'en' : 'zh-tw';
    const otherLocale = firstLocale === 'en' ? 'zh-tw' : 'en';
    const switches = [];
    for (let round = 1; round <= rounds; round++) {
      for (const locale of [otherLocale, firstLocale]) {
        phase = `round-${round}:switch-to-${locale}`;
        const start = requests.length;
        // DOM click avoids pointer-hover prefetching immediately before the click.
        await page.locator(`[data-locale="${locale}"]`).evaluate((link) => link.click());
        await page.waitForFunction(
          (expected) => document.querySelector('h1')?.textContent === `Current locale: ${expected}`,
          locale,
        );
        await page.waitForTimeout(1000);
        switches.push({ phase, pathname: new URL(page.url()).pathname, newRequests: requests.slice(start) });
      }
    }
    result.cases.push({
      initialPath,
      measuredReportRequests: switches.flatMap((entry) => entry.newRequests).length,
      switches,
      requests,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
