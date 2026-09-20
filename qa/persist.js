const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();
  const ctx=await br.newContext({viewport:{width:393,height:852}});
  const p=await ctx.newPage(); const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await p.waitForTimeout(500);

  // seal a card the way the game does, and score some points
  await p.evaluate(()=>{
    window.setTruth(0,0,'Slow Horses');
    window.S.sealed.push({gap:0,qi:0,pick:'Slow Horses',at:Date.now(),rate:2});
    window.S.pts=397; window.S.earned=217;
    window.savePlay();
  });

  // THE BUG: a reload used to wipe this
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(600);
  ok('a sealed card SURVIVES a reload', await p.evaluate(()=>window.S.sealed.length)===1);
  ok('the pick itself survives',
     await p.evaluate(()=>window.S.sealed[0]&&window.S.sealed[0].pick)==='Slow Horses');
  ok('the score survives', await p.evaluate(()=>window.S.pts)===397);
  ok('the host answer survives too', await p.evaluate(()=>window.GAPS[0].q[0].a)==='Slow Horses');
  ok('it never resumes mid-question',
     await p.evaluate(()=>window.S.phase)==='hold' && await p.evaluate(()=>window.S.qi)===-1);

  // AND IT SETTLES
  /* setOpenedGap() now GOES to the Gametime it opens, so the settle
     fires there. Calling goto(2) again afterwards was a second visit,
     by which point the card had already been consumed — the suite was
     written against the bug, not the fix. */
  await p.evaluate(()=>window.setOpenedGap(2));
  await p.waitForTimeout(800);
  const st=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('Credits SETTLES the card sealed before the reload',
     /settling now/i.test(st), st.slice(0,80));
  ok('it shows the call that was made', /Slow Horses/.test(st));

  // a consumed settle is not replayed after another reload
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(600);
  ok('a settled card does not settle twice',
     await p.evaluate(()=>window.pendingFor(2).length)===0);

  // RESET NIGHT wipes the play
  await p.evaluate(()=>{ window.resetNight(); });
  await p.waitForTimeout(1200);
  ok('reset clears the sealed tray', await p.evaluate(()=>window.S.sealed.length)===0);
  ok('reset keeps the answers the host called',
     await p.evaluate(()=>window.GAPS[0].q[0].a)==='Slow Horses');

  // demo rooms unaffected in their own right
  const v=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await v.goto(B+'/?room=vmas',{waitUntil:'networkidle'}); await v.waitForTimeout(500);
  ok('VMA room starts clean', await v.evaluate(()=>window.S.sealed.length)===0);
  ok('rooms do not share a play key',
     await v.evaluate(()=>window.playKey())!==await p.evaluate(()=>window.playKey()),
     await v.evaluate(()=>window.playKey()));

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
