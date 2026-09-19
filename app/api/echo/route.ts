export const dynamic = 'force-dynamic';

// What the origin received: path, query and the spike's request headers.
export function GET(request: Request) {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers) {
    if (k.startsWith('x-spike') || k === 'x-nf-request-id' || k === 'x-wd-clearance') headers[k] = v;
  }
  return Response.json({ origin: true, path: url.pathname, search: url.search, headers });
}
