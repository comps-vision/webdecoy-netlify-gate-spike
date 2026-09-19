// Does node:dns load in a function in .netlify/edge-functions? Kept apart from
// webdecoy-diag.ts so a failed import cannot take the other probes down.
import { promises as dns } from 'node:dns';

export default async (request: Request) => {
  const ip = new URL(request.url).searchParams.get('ip') ?? '66.249.66.1';
  const t0 = Date.now();
  try {
    const names = await dns.reverse(ip);
    const host = names[0] ?? '';
    const forward = host ? await dns.resolve4(host).catch((e: unknown) => [String(e)]) : [];
    return Response.json({ via: 'node:dns', ip, names, forward, confirmed: forward.includes(ip), ms: Date.now() - t0 });
  } catch (err) {
    return Response.json({ via: 'node:dns', ip, error: String(err), ms: Date.now() - t0 });
  }
};

export const config = { path: '/diag/node-dns' };
