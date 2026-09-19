// Stand in for the Netlify SDK's addEdgeFunctions: copy the functions into
// INTERNAL_EDGE_FUNCTIONS_SRC (.netlify/edge-functions). Runs in the build
// command, i.e. after every plugin's onPreBuild (Next's adapter clears this
// directory there) and before onBuild (where the adapter writes its manifest).
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
const dir = '.netlify/edge-functions';
mkdirSync(dir, { recursive: true });
for (const f of ['webdecoy-diag.ts', 'webdecoy-diag-node.ts']) cpSync(`edge/${f}`, `${dir}/${f}`);
console.log(`[spike] injected into ${dir}: ${readdirSync(dir).join(', ')}`);
