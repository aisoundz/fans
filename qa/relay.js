/* TWO PHONES. The suite every other one was missing.

   Until 28 Oct every check drove host and player in ONE browser, so a
   host's call was always "visible to the player" — it was the same
   localStorage. On two phones nothing reached anyone, and no suite could
   have said so. Here the host and the player are separate contexts with
   separate storage, joined only by the relay (a stand-in: qa/lib/relay-mock.js).

   Room: the CMAs, the first night with strangers in it. */
const M = require('./lib/relay-mock.js') && global.RELAY_MOCK;
const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0;
const ok=(n,c,d='')=>{ console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c) fail++; };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* "SENT ·" is also inside "NOT SENT ·" — a check that matched both passed on a dead relay */
const sent=t=>/SENT ·/.test(t) && !/NOT SENT/.test(t);
async function until(fn,ms){ const t=Date.now(); while(Date.now()-t<ms){ if(await fn()) return true; await sleep(250);} return false; }

(async()=>{
  const br=await chromium.launch();
  const vp={viewport:{width:393,height:852}};
  const errs=[];

  /* ---- the host's phone ---- */
  const hc=await br.newContext(vp), h=await hc.newPage();
  h.on('pageerror',e=>errs.push('host: '+e));
  await h.goto(B+'/?room=cmas&host=1&k='+M.QA_HOST_KEY,{waitUntil:'networkidle'});
  ok('the host key is stripped from the address bar', !/[?&]k=/.test(h.url()), h.url());
  ok('and kept on the host\'s device',
     await h.evaluate(()=>localStorage.getItem('fg.hostkey'))===M.QA_HOST_KEY);
  await h.evaluate(()=>{ document.getElementById('hostpanel').classList.add('open'); renderHostPanel(); });
  ok('the panel says it is connected and nothing is called',
     /CONNECTED/.test(await h.textContent('#hostpanel .hp-relay')));

  /* ---- a player's phone ---- */
  const pc=await br.newContext(vp), p=await pc.newPage();
  p.on('pageerror',e=>errs.push('player: '+e));
  const writes=[]; pc.on('request',r=>{ if(r.method()==='POST' && r.url().startsWith(M.RELAY)) writes.push(r.url()); });
  await p.goto(B+'/?room=cmas',{waitUntil:'networkidle'});
  ok('the player has no host panel', await p.evaluate(()=>document.getElementById('hostpanel').hidden));

  // the player seals the red carpet: first tile on everything
  await p.evaluate(()=>navGo('gametime')); await sleep(300);
  await (await p.$('#stage button.btn')).click(); await sleep(700);
  for(let n=0;n<6;n++){ const t=await p.$('#tiles button.tile'); if(!t) break; await t.click(); await sleep(2900); }
  ok('the player sealed all four red-carpet calls', await p.evaluate(()=>S.sealed.length)===4,
     await p.evaluate(()=>S.sealed.length)+' sealed');

  // and walks up to Cutaway, which is still shut
  await p.evaluate(()=>goto(1)); await sleep(300);
  ok('Cutaway is shut on the player\'s phone', await p.evaluate(()=>S.gap)===0 &&
     /Not open yet/i.test(await p.textContent('#stage')));
  ok('and the shut screen says it will open itself', /opens itself/i.test(await p.textContent('#stage')));

  /* ---- the host calls the first break, THEN opens it ---- */
  ok('before the calls, OPEN warns that Cutaway has uncalled questions',
     /3 NOT CALLED YET/.test(await h.textContent('#hostpanel .hp-go')), await h.textContent('#hostpanel .hp-go'));
  await h.evaluate(()=>{ setTruth(1,0,'One performance'); setTruth(1,1,'A woman'); setTruth(1,2,'Yes'); });
  ok('once called, the warning is gone', !/NOT CALLED/.test(await h.textContent('#hostpanel .hp-go')));
  await h.evaluate(()=>setOpenedGap(1));
  ok('the host panel says SENT only after the relay accepted it',
     await until(async()=>sent(await h.textContent('#hostpanel .hp-relay')),5000),
     await h.textContent('#hostpanel .hp-relay'));
  ok('the relay holds what the host called', M.store.cmas && M.store.cmas.opened===1 &&
     M.store.cmas.truth['1:0']==='One performance', JSON.stringify(M.store.cmas));

  /* ---- the player's phone, untouched, within one poll ---- */
  const t0=Date.now();
  const moved=await until(async()=>(await p.evaluate(()=>S.gap))===1, 17000);
  ok('a player waiting at the shut door is walked through within one 15s poll', moved,
     ((Date.now()-t0)/1000).toFixed(1)+'s');
  ok('the host\'s calls arrived on the player\'s phone',
     await p.evaluate(()=>GAPS[1].q[0].a)==='One performance');

  await (await p.$('#stage button.btn')).click(); await sleep(700);
  for(let n=0;n<4;n++){ const t=await p.$('#tiles button.tile'); if(!t) break; await t.click(); await sleep(2900); }
  ok('a recall answered on the player\'s phone is graded by the host\'s call',
     await p.evaluate(()=>wasRight(1,0))===true);

  /* ---- a corrected call corrects every phone ---- */
  await h.evaluate(()=>setTruth(1,1,'A man'));
  await until(async()=>sent(await h.textContent('#hostpanel .hp-relay')),5000);
  await p.evaluate(()=>pullState()); await sleep(800);
  ok('a call the host changes is changed on the player\'s phone',
     await p.evaluate(()=>GAPS[1].q[1].a)==='A man', await p.evaluate(()=>GAPS[1].q[1].a));

  /* ---- the settle: a call sealed on one phone, decided on another ---- */
  await h.evaluate(()=>{ setTruth(0,0,'Lainey Wilson'); setOpenedGap(4); });
  await until(async()=>sent(await h.textContent('#hostpanel .hp-relay')),5000);
  await p.evaluate(()=>pullState()); await sleep(800);
  await p.evaluate(()=>goto(4)); await sleep(800);
  // the card shows sealed first, then flips — wait for the flip
  await until(async()=>/Lainey Wilson/.test(await p.textContent('#stage')),6000);
  const st=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('the player reaches Credits once the host opens it', await p.evaluate(()=>S.gap)===4);
  ok('THE SETTLE uses the host\'s call from another phone', /Lainey Wilson/.test(st), st.slice(0,120));

  ok('a player never writes to the relay', writes.length===0, writes.join(', ')||'none');

  /* ---- the host must never have to guess whether it went out ---- */
  M.fail=true;
  await h.evaluate(()=>setTruth(4,0,'Chris Stapleton'));
  ok('a dead relay says NOT SENT, not SENT',
     await until(async()=>/NOT SENT/.test(await h.textContent('#hostpanel .hp-relay')),5000),
     await h.textContent('#hostpanel .hp-relay'));
  M.fail=false;
  await h.click('#hostpanel .hp-relay .hp-b');
  ok('SEND AGAIN sends it',
     await until(async()=>sent(await h.textContent('#hostpanel .hp-relay')),5000) &&
     M.store.cmas.truth['4:0']==='Chris Stapleton');

  const wc=await br.newContext(vp), w=await wc.newPage();
  await w.goto(B+'/?room=cmas&host=1&k=wrong-key',{waitUntil:'networkidle'});
  await w.evaluate(()=>{ document.getElementById('hostpanel').classList.add('open'); setTruth(1,0,'A tribute'); });
  ok('a wrong host key is REFUSED and says so',
     await until(async()=>/REFUSED/.test(await w.textContent('#hostpanel .hp-relay')),5000));
  ok('and changed nothing', M.store.cmas.truth['1:0']==='One performance');

  const nc=await br.newContext(vp), n=await nc.newPage();
  await n.goto(B+'/?room=cmas&host=1',{waitUntil:'networkidle'});
  await n.evaluate(()=>{ document.getElementById('hostpanel').classList.add('open'); renderHostPanel(); });
  ok('a host with no key is told players cannot see the calls',
     /LOCAL ONLY/.test(await n.textContent('#hostpanel .hp-relay')));

  ok('no JS errors on any phone', errs.length===0, errs.join(' | ')||'clean');
  await br.close();
  console.log(fail? '\n'+fail+' FAILED' : '\ntwo phones, one night');
  process.exit(fail?1:0);
})();
