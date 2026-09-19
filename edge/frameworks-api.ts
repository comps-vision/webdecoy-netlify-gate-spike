// Stands in for a framework adapter that uses the Frameworks API
// (.netlify/v1/edge-functions), as Astro's Netlify adapter does for its
// edge middleware. Inline-declared, like an adapter's.
export default async (request: Request, context: { next: (r?: Request) => Promise<Response> }) => {
  const headers = new Headers(request.headers);
  headers.set('x-spike-chain', [headers.get('x-spike-chain'), 'frameworks-api'].filter(Boolean).join(','));
  const res = await context.next(new Request(request, { headers }));
  const out = new Response(res.body, res);
  out.headers.set('x-spike-resp-chain', [res.headers.get('x-spike-resp-chain'), 'frameworks-api'].filter(Boolean).join(','));
  return out;
};

export const config = { path: '/*', excludedPath: ['/_next/static/*'] };
