# WebDecoy Netlify gate spike (WebDecoy/app#1186, #1187)

A throwaway Next.js site that answers three questions about an edge function
injected into `.netlify/edge-functions` (where the Netlify SDK's
`addEdgeFunctions` puts an extension's functions):

1. Where it runs relative to Next.js middleware, the site's own edge functions
   (inline-declared and `netlify.toml`-declared), redirects and rewrites.
2. What returning a `Response` from it does to the rest of the chain.
3. Whether it can do reverse DNS (`Deno.resolveDns`, `node:dns`).

`edge/webdecoy-diag.ts` is copied into `.netlify/edge-functions/` by the build
command (`scripts/inject.mjs`), after Next's adapter has cleared that directory
in `onPreBuild`. Every layer appends its name to the request header
`x-spike-chain` and to the response header `x-spike-resp-chain`, and
`/api/echo` returns the request headers the origin received.
