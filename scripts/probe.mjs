const base = new URL(process.argv[2] ?? 'http://localhost:3000');
const segments = ['/_tree', '/$d$locale/report/__PAGE__'];
const evidence = { base: base.origin, nextVersion: '16.3.6', requests: [] };

for (const pathname of ['/report', '/zh-tw/report']) {
  const document = await fetch(new URL(pathname, base));
  if (!document.ok) throw new Error(`${pathname}: HTTP ${document.status}`);
  const html = await document.text();
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
    evidence.requests.push({
      pathname,
      kind: 'prefetch',
      requestedSegment: segment,
      status: response.status,
      matchedPath: response.headers.get('x-matched-path'),
      segmentResponseMarker: response.headers.get('x-nextjs-postponed'),
      vercelCache: response.headers.get('x-vercel-cache'),
      bytes: Buffer.byteLength(body),
      payloadShape: /"buildId":/.test(body) ? 'segment' : 'full-flight',
    });
  }
}

console.log(JSON.stringify(evidence, null, 2));
