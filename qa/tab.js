const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1000);

  // tap a shut Gametime
  await p.evaluate(()=>window.goto(1)); await p.waitForTimeout(400);
  ok('a shut tap does not move the game', await p.evaluate(()=>window.S.gap)===0);
  ok('the highlight stays on the real Gametime',
     await p.evaluate(()=>document.getElementById('d0').classList.contains('on'))===true);
  ok('the shut one is NOT highlighted',
     await p.evaluate(()=>document.getElementById('d1').classList.contains('on'))===false);

  // the sheet is current whenever you look at it
  await p.evaluate(()=>window.navGo('fans')); await p.waitForTimeout(300);
  let ticks=await p.evaluate(()=>document.querySelectorAll('#setlist span').length&&
     (document.getElementById('setlist').textContent.match(/✓/g)||[]).length);
  ok('sheet shows 5 done while in Right Back', ticks===5, ticks+' ticks');

  await p.evaluate(()=>{ window.setOpenedGap(1); window.goto(1); }); await p.waitForTimeout(400);
  ok('once opened the game really moves', await p.evaluate(()=>window.S.gap)===1);
  await p.evaluate(()=>window.navGo('fans')); await p.waitForTimeout(300);
  ticks=await p.evaluate(()=>(document.getElementById('setlist').textContent.match(/✓/g)||[]).length);
  ok('sheet updates to 7 in The Envelope', ticks===7, ticks+' ticks');

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
