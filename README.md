# Next.js / Vercel segment-prefetch reproduction

A small reproduction for repeated RSC navigation requests when a page generated on first request is opened directly on Vercel.

- Next.js **16.3.6**, React / React DOM **19.2.6**.
- `/en/report` is generated at build time.
- `/zh-tw/report` is generated and cached on its first request.
- A small `proxy.js` rewrites `/report` to `/en/report`, keeping the default locale unprefixed.
- The page has two normal `next/link` links and a client component using `useSearchParams` inside `Suspense`.
- No next-intl, data fetching, API, authentication, custom cache handler, or experimental cache configuration.

Issue and investigation: [#1](https://github.com/hmpthz/nextjs-vercel-segment-cache-repro/issues/1).

## Verified deployments and results

Verified on 2026-10-15 with Chrome 155.0.8059.40. Each browser case uses a fresh context, waits for automatic prefetches, and performs six clicks (three round trips).

| Environment | Next.js | Start at `/zh-tw/report` | Start at `/report` |
| --- | --- | --- | --- |
| Local `next start` | 16.3.6 | 0 new report requests | 0 |
| Vercel, English prerendered | 16.3.6 | 3 new report requests | 0 |
| Vercel, English prerendered | 16.5.0-canary.12 | 3 new report requests | 0 |
| Vercel, both locales prerendered | 16.3.6 | 0 new report requests | 0 |

Public deployments (no login required):

- [16.3.6 baseline: start at the on-demand route](https://nextjs-vercel-segment-cache-repro.vercel.app/zh-tw/report)
- [16.5.0-canary.12 baseline](https://nextjs-vercel-segment-cache-repro-me3b8vf5t-hmpthzs-projects.vercel.app/zh-tw/report) — source: [`canary` branch](https://github.com/hmpthz/nextjs-vercel-segment-cache-repro/tree/canary)
- [16.3.6 control: both locales prerendered](https://nextjs-vercel-segment-cache-repro-rev288is5-hmpthzs-projects.vercel.app/zh-tw/report)

See [`results/summary.json`](results/summary.json), the raw HTTP and browser JSON in [`results/`](results/), and the captured [`next info`](results/next-info-stable.txt). Counts exclude initial-load prefetches. In both failing Vercel cases, every click returning to Traditional Chinese issues one additional RSC navigation request.

The probe recognizes both the 16.3.6 and canary Flight payload formats. It also fails explicitly if the deployment returns an authentication page.

## Run locally

```sh
npm ci
npm run build
npm start
```

Use a production build. `next dev` is not a valid comparison for production prefetch behavior.

## Reproduce on Vercel

Deploy the repository as a Next.js project using the default settings. Leave `PRERENDER_ALL_LOCALES` unset.

1. Open DevTools Network and filter for `report`. Keep the normal browser cache setting.
2. Directly open `/zh-tw/report` in a fresh tab and wait for Link prefetches to finish.
3. Click **English**, then **Traditional Chinese**. Repeat a few times.
4. Check whether each return to Traditional Chinese issues another navigation RSC request.
5. In a fresh tab, directly open `/report`, wait for prefetches, then repeat the same switches.

Compare this with the local production server. Browser Router Cache reuse should not depend on the initial locale.

## Automated checks

Inspect the document's initial `S` capability flag and both the tree and page-segment responses:

```sh
npm run probe -- https://YOUR-DEPLOYMENT.vercel.app
```

Run the browser comparison in two fresh browser contexts:

```sh
npx playwright install chromium
npm run repro -- https://YOUR-DEPLOYMENT.vercel.app
```

Alternatively, use an already-installed Chrome:

```sh
BROWSER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm run repro -- https://YOUR-DEPLOYMENT.vercel.app
```

The browser script records request headers, response markers, and the requests issued during each switch. It prints JSON and does not submit reports or change server state. Automatic Link prefetches during initial load are logged separately from measured switches. It uses DOM clicks to avoid introducing pointer-hover prefetches immediately before navigation.

## Control: prerender both locales

Set `PRERENDER_ALL_LOCALES=1` **at build time** and redeploy. For a local control:

```sh
PRERENDER_ALL_LOCALES=1 npm run build
npm start
```

This changes only `generateStaticParams`; the page, links, and rewrite remain identical.

## Relevant source

The currently investigated protocol mismatch is:

1. The initial Flight payload advertises per-segment prefetch support through `S: true` for static generation, including request-time generation.
2. A deployed segment request can receive a full Flight response without `x-nextjs-postponed: 2`.
3. The client segment-prefetch path rejects that response instead of caching it.

Source references:

- [Next.js 16.3.6 initial capability flag](https://github.com/vercel/next.js/blob/v16.3.6/packages/next/src/server/app-render/app-render.tsx#L2200)
- [Next.js 16.3.6 segment-response validation](https://github.com/vercel/next.js/blob/v16.3.6/packages/next/src/client/components/segment-cache/cache.ts#L2411)
- [Vercel segment-to-full-RSC fallback routing](https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/next/src/server-build.ts#L2685)

These references explain the observed response mismatch; they do not establish which upstream component should own the fix.
