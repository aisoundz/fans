#!/usr/bin/env node
/* ====================================================================
   FANS GAMETIME — THE GATE

   Every one of these checks was written on the night of 14 September,
   during the Emmys shadow run, while the defect it describes was live on
   the site. They lived in a session scratchpad for four days, which is
   the same as not existing: the first item on the debrief's fix list was
   "commit these before they evaporate".

   Run it against the local file before shipping:      node qa/all.js
   Run it against the live site after shipping:        TARGET=https://fansgametime.com node qa/all.js

   A suite that cannot fail is decoration, so qa/sabotage.js deliberately
   reintroduces a bug at runtime and asserts that the check goes red.
   ==================================================================== */
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR  = __dirname;
const ROOT = path.join(DIR, '..');
const PORT = process.env.PORT || '8791';
const LIVE = process.env.TARGET || null;
const TARGET = LIVE || ('http://127.0.0.1:' + PORT);

/* order matters only in that the journey goes last: it is the slowest and
   the most valuable, and a failure above it usually explains a failure
   inside it */
const ORDER = ['verify','vma','emmys','bank','fab','panel','tab','pace',
               'persist','reveal','ux','reach','formverify','journey','sabotage'];

const suites = ORDER
  .map(n => path.join(DIR, n + '.js'))
  .filter(f => fs.existsSync(f))
  .concat(fs.readdirSync(DIR)
    .filter(f => f.endsWith('.js') && f !== 'all.js' && !ORDER.includes(f.replace(/\.js$/,'')))
    .map(f => path.join(DIR, f)));

let server = null;
function startServer(){
  server = spawn('python3', ['-m','http.server', PORT, '--bind','127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore', detached: false });
}
function stopServer(){ if(server && !server.killed) try{ server.kill(); }catch(e){} }

(async () => {
  if(!LIVE){
    startServer();
    await new Promise(r => setTimeout(r, 2200));
  }
  console.log('target : ' + TARGET);
  console.log('suites : ' + suites.length + '\n');

  const results = [];
  for(const f of suites){
    const name = path.basename(f, '.js');
    const t0 = Date.now();
    const r = spawnSync('node', [f], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { TARGET }),
      timeout: 240000
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^PASS/gm) || []).length;
    const bad  = (out.match(/^FAIL/gm) || []).length;
    const okc  = r.status === 0;
    results.push({ name, okc, pass, bad, secs: ((Date.now()-t0)/1000).toFixed(1), out });
    console.log((okc ? '  ok   ' : '  FAIL ') + name.padEnd(12)
      + String(pass).padStart(3) + ' passed'
      + (bad ? '   ' + bad + ' FAILED' : '')
      + '   ' + ((Date.now()-t0)/1000).toFixed(1) + 's');
    if(!okc) console.log(out.split('\n').filter(l => /^FAIL|Error|error:/.test(l))
      .map(l => '         ' + l).join('\n'));
  }

  stopServer();
  const failed = results.filter(r => !r.okc);
  const total  = results.reduce((a,r) => a + r.pass, 0);
  console.log('\n' + total + ' checks passed across ' + results.length + ' suites');
  if(failed.length){
    console.log('DO NOT SHIP — ' + failed.length + ' suite(s) red: ' + failed.map(r=>r.name).join(', '));
    process.exit(1);
  }
  console.log('GREEN');
})().catch(e => { stopServer(); console.error(e); process.exit(1); });
