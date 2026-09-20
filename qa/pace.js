const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852},deviceScaleFactor:2})).newPage();
  const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);

  ok('only Gametime 1 is open at the start', await p.evaluate(()=>window.openedGap())===0);
  ok('the real room IS paced', await p.evaluate(()=>window.paced())===true);

  // you cannot run ahead of the broadcast
  await p.evaluate(()=>window.goto(2));
  await p.waitForTimeout(400);
  let st=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('jumping to a later Gametime is refused', /Not open yet/i.test(st));
  ok('it explains why in the player\'s terms', /has not happened/i.test(st));
  ok('the shut screen offers no Play button', !/Play Credits/i.test(st));
  await p.screenshot({path:S+'/pace-shut.png'});

  // the host opens the next one
  await p.evaluate(()=>window.setOpenedGap(1));
  await p.waitForTimeout(300);
  await p.evaluate(()=>window.goto(1));
  await p.waitForTimeout(400);
  st=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('once opened it plays normally', /Play The Envelope/i.test(st), st.slice(0,60));
  ok('the one after it is still shut', await p.evaluate(()=>window.gapOpen(2))===false);

  // it survives a reload mid-broadcast
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(600);
  ok('the pace survives a reload', await p.evaluate(()=>window.openedGap())===1);

  // panel control is present
  await p.click('#hostpanel .hp-h'); await p.waitForTimeout(300);
  const ctl=await p.textContent('#hostpanel .hp-ctl');
  ok('panel names what is open', /The Envelope/.test(ctl), ctl.replace(/\s+/g,' ').slice(0,70));
  ok('panel offers to open the next by NAME', /OPEN CREDITS/.test(ctl));
  await p.screenshot({path:S+'/pace-panel.png'});

  // ---- the final screen invents nothing ----
  const fin=await p.evaluate(()=>{ window.S.earned=312; window.S.pts=492; return window.claimHtml(); });
  ok('no invented placing', !/class="pos"/.test(fin));
  ok('no Section 214 at a broadcast', !/Section 214/.test(fin));
  ok('no prize nobody offered', !/Soundcheck offer/i.test(fin));
  ok('no merch stand', !/merch stand/i.test(fin));
  ok('no Spotify promise', !/Spotify next week/i.test(fin));
  const pctNum=parseInt((fin.match(/(\d+)% of the night/)||[0,'999'])[1],10);
  ok('percentage can never exceed 100', pctNum<=100, pctNum+'% (earned 312 of ceiling 210)');
  ok('it says "The credits", not "The walk-out"', /The credits/.test(fin) && !/walk-out/i.test(fin));

  // ---- demo rooms stay walkable and keep their illustration ----
  const v=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  /* THE VMA ROOM IS REAL NOW — paced, no invented crowd, no room
     questions. The demo rooms are the arena/stadium/club illustrations,
     so those are what must stay walkable. */
  await v.goto(B+'/',{waitUntil:'networkidle'}); await v.waitForTimeout(500);
  ok('a DEMO room is NOT paced', await v.evaluate(()=>window.paced())===false);
  await v.evaluate(()=>window.goto(4));
  await v.waitForTimeout(400);
  ok('a demo room still walks straight to Gametime 5',
     !/Not open yet/i.test(await v.textContent('#stage')));
  const dfin=await v.evaluate(()=>window.claimHtml());
  ok('a demo final keeps merch + Spotify', /merch stand/i.test(dfin) && /Spotify/i.test(dfin));

  await v.goto(B+'/?room=vmas',{waitUntil:'networkidle'}); await v.waitForTimeout(500);
  ok('the VMA room IS paced, because it is real', await v.evaluate(()=>window.paced())===true);
  const rfin=await v.evaluate(()=>window.claimHtml());
  ok('the REAL final offers no merch stand and no Spotify',
     !/merch stand/i.test(rfin) && !/Spotify/i.test(rfin));

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
