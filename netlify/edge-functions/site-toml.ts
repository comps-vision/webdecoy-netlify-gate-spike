// The site's own edge function, declared in netlify.toml (user toml declaration).
export default async (request: Request, context: { next: (r?: Request) => Promise<Response> }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/static/')) return;
  if (new URL(request.url).pathname.startsWith('/rw-')) return;
  const headers = new Headers(request.headers);
  headers.set('x-spike-chain', [headers.get('x-spike-chain'), 'site-toml'].filter(Boolean).join(','));
  const res = await context.next(new Request(request, { headers }));
  const out = new Response(res.body, res);
  out.headers.set('x-spike-resp-chain', [res.headers.get('x-spike-resp-chain'), 'site-toml'].filter(Boolean).join(','));
  return out;
};
