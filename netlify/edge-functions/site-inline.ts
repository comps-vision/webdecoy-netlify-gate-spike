// The site's own edge function, declared inline (user in-source config).
export default async (request: Request, context: { next: (r?: Request) => Promise<Response> }) => {
  if (new URL(request.url).pathname.startsWith('/rw-')) return;
  const headers = new Headers(request.headers);
  headers.set('x-spike-chain', [headers.get('x-spike-chain'), 'site-inline'].filter(Boolean).join(','));
  const res = await context.next(new Request(request, { headers }));
  const out = new Response(res.body, res);
  out.headers.set('x-spike-resp-chain', [res.headers.get('x-spike-resp-chain'), 'site-inline'].filter(Boolean).join(','));
  return out;
};

export const config = { path: '/*', excludedPath: ['/_next/static/*'] };
