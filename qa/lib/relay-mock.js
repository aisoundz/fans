/* THE GATE NEVER TOUCHES THE PRODUCTION RELAY.

   Preloaded into every suite by qa/all.js (NODE_OPTIONS=--require). It
   wraps playwright's chromium.launch so every context any suite opens
   has the relay origin routed to an in-memory stand-in. Without it, the
   VMA and Emmys rooms the suites drive would read whatever a real host
   had written to production — the sports side's "13 suites graded the
   real slate" mistake, arriving here the day the relay did.

   The stand-in implements exactly the contract index.html uses:
     GET  /rest/v1/show_state?select=…&show_key=eq.<key>   → [row] or []
     POST /rest/v1/rpc/host_set  {p_show,p_key,p_opened,p_truth}
          → 401 unless p_key === QA_HOST_KEY; truth MERGES, a null removes
   The store is shared across every context in one suite process, so a
   host context and a player context see each other — as two phones do.

   RELAY_MOCK.fail = true makes every call 500, to test a dead relay.
   Production rows are never read: anything else at the origin is a 404. */
'use strict';
const RELAY = 'https://pasctuhasvvlabiwpjaj.supabase.co';
const QA_HOST_KEY = 'qa-host-key';
const store = {};
const M = global.RELAY_MOCK = { store, QA_HOST_KEY, RELAY, fail: false, reads: 0, writes: 0 };

async function route(ctx){
  await ctx.route(RELAY + '/**', async rt => {
    const req = rt.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
                   'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if(req.method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    if(M.fail) return rt.fulfill({ status: 500, headers: cors, body: '{"message":"down"}' });
    if(req.method() === 'GET' && u.pathname === '/rest/v1/show_state'){
      M.reads++;
      const key = (u.searchParams.get('show_key') || '').replace(/^eq\./, '');
      const row = store[key];
      return rt.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify(row ? [{ opened: row.opened, truth: row.truth }] : []) });
    }
    if(req.method() === 'POST' && u.pathname === '/rest/v1/rpc/host_set'){
      let b = {}; try{ b = JSON.parse(req.postData() || '{}'); }catch(e){}
      if(b.p_key !== QA_HOST_KEY)
        return rt.fulfill({ status: 401, headers: cors, contentType: 'application/json',
                            body: '{"code":"42501","message":"not the host"}' });
      M.writes++;
      const row = store[b.p_show] || (store[b.p_show] = { opened: 0, truth: {} });
      if(b.p_opened !== null && b.p_opened !== undefined) row.opened = b.p_opened;
      if(b.p_truth) for(const k of Object.keys(b.p_truth)){
        if(b.p_truth[k] === null) delete row.truth[k]; else row.truth[k] = b.p_truth[k];
      }
      return rt.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify(Object.assign({ show_key: b.p_show }, row)) });
    }
    return rt.fulfill({ status: 404, headers: cors, body: '{}' });
  });
}

const pw = require(process.env.PW || '/home/higherthan7/stats/node_modules/playwright');
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async function(){
  const br = await launch.apply(null, arguments);
  const newContext = br.newContext.bind(br), newPage = br.newPage.bind(br);
  br.newContext = async function(){ const c = await newContext.apply(null, arguments); await route(c); return c; };
  br.newPage = async function(){
    /* browser.newPage makes its own hidden context; route that one too */
    const p = await newPage.apply(null, arguments); await route(p.context()); return p;
  };
  return br;
};
