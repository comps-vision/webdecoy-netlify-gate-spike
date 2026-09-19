import { NextResponse, type NextRequest } from 'next/server';

// Next.js middleware (edge runtime). Stamps the request and the response so
// the chain can be read back; three paths end or reroute the request here.
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  console.log(`[spike] middleware ${request.method} ${url.pathname} chain=${request.headers.get('x-spike-chain') ?? ''}`);
  if (url.pathname.startsWith('/rw-')) return NextResponse.next();
  if (url.pathname === '/mw-respond') {
    return NextResponse.json(
      { from: 'middleware', chain_seen: request.headers.get('x-spike-chain') ?? '' },
      { headers: { 'x-spike-resp-chain': 'middleware-responded' } }
    );
  }
  if (url.pathname === '/mw-redirect') {
    return NextResponse.redirect(new URL('/api/echo?via=mw-redirect', url));
  }
  const headers = new Headers(request.headers);
  headers.set('x-spike-chain', [headers.get('x-spike-chain'), 'middleware'].filter(Boolean).join(','));
  headers.set('x-spike-mw-saw-path', url.pathname);
  let res: NextResponse;
  if (url.pathname.startsWith('/mw-rewrite')) {
    const to = new URL('/api/echo', url);
    to.searchParams.set('via', 'mw-rewrite');
    res = NextResponse.rewrite(to, { request: { headers } });
  } else {
    res = NextResponse.next({ request: { headers } });
  }
  res.headers.set('x-spike-mw-ran', '1');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
