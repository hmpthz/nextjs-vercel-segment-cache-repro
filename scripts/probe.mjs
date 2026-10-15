const base = new URL(process.argv[2] ?? 'http://localhost:3000');
const segments = ['/_tree', '/$d$locale/report/__PAGE__'];
const evidence = { base: base.origin, requests: [] };

for (const pathname of ['/report', '/zh-tw/report']) {
  const document = await fetch(new URL(pathname, base));
  if (!document.ok) throw new Error(`${pathname}: HTTP ${document.status}`);
  const html = await document.text();
  if (!html.includes('Current locale:')) {
    throw new Error(`${pathname}: response is not the reproduction page; check deployment protection`);
  }
  evidence.requests.push({
    pathname,
    kind: 'document',
    status: document.status,
    initialSegmentSupport: /\\"S\\":true/.test(html),
    vercelCache: document.headers.get('x-vercel-cache'),
  });

  for (const segment of segments) {
    const response = await fetch(new URL(pathname, base), {
      headers: {
        RSC: '1',
        'Next-Router-Prefetch': '1',
        'Next-Router-Segment-Prefetch': segment,
      },
    });
    const body = await response.text();
    const rootLine = body.split('\n').find((line) => line.startsWith('0:'));
    let root = null;
    try { root = JSON.parse(rootLine?.slice(2) ?? 'null'); } catch {}
    const fullFlight = root && typeof root === 'object' && 'f' in root;
    evidence.requests.push({
      pathname,
      kind: 'prefetch',
      requestedSegment: segment,
      status: response.status,
      matchedPath: response.headers.get('x-matched-path'),
      segmentResponseMarker: response.headers.get('x-nextjs-postponed'),
      vercelCache: response.headers.get('x-vercel-cache'),
      bytes: Buffer.byteLength(body),
      rootKeys: root && typeof root === 'object' ? Object.keys(root) : [],
      payloadShape: fullFlight
        ? 'full-flight'
        : response.headers.get('x-nextjs-postponed') === '2' ? 'segment' : 'unknown',
    });
  }
}

console.log(JSON.stringify(evidence, null, 2));
