// Stand-in for an extension-injected gate. Copied into .netlify/edge-functions
// by scripts/inject.mjs, the directory the Netlify SDK injects into.
declare const Deno: any;
declare const Netlify: any;

const ISOLATE = crypto.randomUUID().slice(0, 8);
const BORN = Date.now();
let served = 0;

let keyPair: Promise<{ pub: Uint8Array; sig: Uint8Array; msg: Uint8Array }> | null = null;
function fixture() {
  if (!keyPair) {
    keyPair = (async () => {
      const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
      const msg = new TextEncoder().encode(JSON.stringify({ kid: 'k1', tenant: 't', fp: 'x'.repeat(64), scope: '', exp: 9e9 }));
      const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, msg));
      const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      return { pub, sig, msg };
    })();
  }
  return keyPair;
}

async function verifyOnce(): Promise<boolean> {
  const f = await fixture();
  const key = await crypto.subtle.importKey('raw', f.pub, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, f.sig, f.msg);
}

function reverseName(ip: string): string {
  if (ip.includes(':')) {
    const parts = ip.split('::');
    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
    const groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
    return groups.map((g) => g.padStart(4, '0')).join('').split('').reverse().join('.') + '.ip6.arpa';
  }
  return ip.split('.').reverse().join('.') + '.in-addr.arpa';
}

async function dnsProbe(ip: string) {
  const out: Record<string, unknown> = { ip, typeof_resolveDns: typeof Deno?.resolveDns };
  const t0 = Date.now();
  try {
    const ptr: string[] = await Deno.resolveDns(reverseName(ip), 'PTR');
    out.ptr = ptr;
    out.ptr_ms = Date.now() - t0;
    const host = (ptr[0] ?? '').replace(/\.$/, '');
    if (host) {
      const t1 = Date.now();
      const forward: string[] = await Deno.resolveDns(host, ip.includes(':') ? 'AAAA' : 'A');
      out.forward = forward;
      out.forward_ms = Date.now() - t1;
      out.confirmed = forward.includes(ip);
    }
  } catch (err) {
    out.error = String(err);
    out.error_ms = Date.now() - t0;
  }
  return out;
}

export default async (request: Request, context: any) => {
  served++;
  const url = new URL(request.url);
  const chainSeen = request.headers.get('x-spike-chain') ?? '';
  const stamp = (res: Response, extra: Record<string, string> = {}) => {
    const out = new Response(res.body, res);
    out.headers.set('x-spike-injected-saw-path', url.pathname + url.search);
    out.headers.set('x-spike-injected-saw-chain', chainSeen || '(none)');
    out.headers.set('x-spike-isolate', `${ISOLATE};n=${served};age_s=${Math.round((Date.now() - BORN) / 1000)}`);
    for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
    return out;
  };
  console.log(`[spike] injected ${request.method} ${url.pathname} chain=${chainSeen} isolate=${ISOLATE} n=${served}`);

  if (url.pathname === '/diag/env') {
    return stamp(Response.json({
      isolate: ISOLATE,
      served,
      typeof_Deno: typeof Deno,
      typeof_resolveDns: typeof Deno?.resolveDns,
      deno_version: Deno?.version ?? null,
      typeof_Netlify_env: typeof Netlify?.env?.get,
      context_keys: Object.keys(context ?? {}),
      typeof_waitUntil: typeof context?.waitUntil,
      typeof_next: typeof context?.next,
      ip: context?.ip ?? null,
      ed25519_verify: await verifyOnce().catch((e) => String(e)),
    }));
  }
  if (url.pathname === '/diag/dns') {
    return stamp(Response.json(await dnsProbe(url.searchParams.get('ip') ?? '66.249.66.1')));
  }
  if (url.pathname === '/diag/timing') {
    const n = Math.min(Number(url.searchParams.get('n') ?? '1'), 200);
    const t0 = performance.now();
    const d0 = Date.now();
    let ok = 0;
    for (let i = 0; i < n; i++) if (await verifyOnce()) ok++;
    return stamp(Response.json({ n, ok, perf_ms: performance.now() - t0, date_ms: Date.now() - d0 }));
  }

  // A sensor-shaped beacon: the response goes out first, the fetch runs in
  // waitUntil. Posts to this site's own echo so no third party is involved.
  if (url.pathname === '/diag/beacon') {
    const t0 = performance.now();
    const beacon = fetch(new URL('/api/echo?via=beacon', url), { signal: AbortSignal.timeout(2000) })
      .then((r) => console.log(`[spike] beacon ${r.status} after ${(performance.now() - t0).toFixed(1)}ms`))
      .catch((e) => console.log(`[spike] beacon failed ${e}`));
    context.waitUntil?.(beacon);
    const res = await context.next();
    return stamp(res, { 'server-timing': `sync;dur=${(performance.now() - t0).toFixed(2)}` });
  }

  // The gate stand-in: a Response ends the chain here.
  if (url.pathname.startsWith('/gate/')) {
    const t0 = performance.now();
    const ok = await verifyOnce();
    const ms = performance.now() - t0;
    return stamp(
      Response.json({ refused_by: 'injected', chain_seen: chainSeen, verify_ok: ok }, { status: 403 }),
      { 'x-spike-resp-chain': 'injected-refused', 'server-timing': `gate;dur=${ms.toFixed(2)}` }
    );
  }

  // Pass through, like a gate that let the request through.
  const headers = new Headers(request.headers);
  headers.set('x-spike-chain', [chainSeen, 'injected'].filter(Boolean).join(','));
  const res = await context.next(new Request(request, { headers }));
  return stamp(res, {
    'x-spike-resp-chain': [res.headers.get('x-spike-resp-chain'), 'injected'].filter(Boolean).join(','),
  });
};

export const config = { path: '/*', excludedPath: ['/_next/static/*', '/diag/node-dns'], onError: 'bypass' };
