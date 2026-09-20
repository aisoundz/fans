const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();

  // ---- the REAL room must invent nothing ----
  const p=await (await br.newContext({viewport:{width:393,height:852},deviceScaleFactor:2})).newPage();
  const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  await p.click('.navb:nth-child(3)');           // Gametime tab
  await p.waitForTimeout(500);
  const stage=(await p.textContent('#stage')).replace(/\s+/g,' ');

  ok('playing() returns nothing in a real room',
     await p.evaluate(()=>window.playing())===null);
  ok('no WATCHING tile at all', !/watching/i.test(stage), stage.match(/\d+\s*watching/i)||'absent');
  ok('no invented sponsor', !/presented by/i.test(stage));
  ok('sheet does not claim the show has not started',
     !/has not started/i.test(stage));
  ok('sheet reports real progress instead', /5 of 9 done/i.test(stage),
     (stage.match(/\d+ of \d+ done[^.]*\./)||['not found'])[0]);
  await p.screenshot({path:S+'/fab-gametime.png'});

  // ---- the home explainer must describe THIS room ----
  await p.click('.navb:nth-child(1)');
  await p.waitForTimeout(400);
  ok('explainer counts three, not five', (await p.textContent('#howH')).startsWith('Three'),
     await p.textContent('#howH'));
  const hd=await p.textContent('#howD');
  ok('explainer names tonight\'s actual Gametimes',
     /Right Back, The Envelope and Credits/.test(hd), hd.slice(-70));
  ok('explainer does not name arena Gametimes', !/Soundcheck|Crossfade|One More/.test(hd));
  ok('no Spotify promise at an awards show',
     !/Spotify/.test(await p.textContent('#howHome')));
  await p.screenshot({path:S+'/fab-home.png'});

  // ---- the DEMO rooms are deliberately unchanged ----
  const v=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await v.goto(B+'/',{waitUntil:'networkidle'});
  await v.waitForTimeout(400);
  ok('demo room still counts five', (await v.textContent('#howH')).startsWith('Five'),
     await v.textContent('#howH'));
  ok('demo room still names the arena five', /Soundcheck/.test(await v.textContent('#howD')));
  ok('demo room keeps its Spotify line', /Spotify/.test(await v.textContent('#howHome')));
  await v.click('.navb:nth-child(3)');
  await v.waitForTimeout(500);
  const dstage=(await v.textContent('#stage')).replace(/\s+/g,' ');
  ok('demo room still shows a crowd', /in the room|watching/i.test(dstage));
  ok('demo room still shows the sponsor slot', /presented by/i.test(dstage));

  // the VMA room is a demo too — untouched 13 days out
  await v.goto(B+'/?room=vmas',{waitUntil:'networkidle'});
  await v.waitForTimeout(400);
  ok('VMA explainer still counts five', (await v.textContent('#howH')).startsWith('Five'));

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
