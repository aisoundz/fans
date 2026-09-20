const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle',timeout:45000});
  await p.waitForTimeout(500);
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1100);
  // jump straight to a recall whose answer we know, and answer it WRONG
  await p.evaluate(()=>{ window.S.gap=0; window.S.qi=1; window.nextQ(); });
  await p.waitForTimeout(700);
  const qt=await p.evaluate(()=>window.GAPS[0].q[window.S.qi].t);
  const right=await p.evaluate(()=>window.GAPS[0].q[window.S.qi].a);
  const wrongIdx=await p.evaluate(()=>{const q=window.GAPS[0].q[window.S.qi];
    return q.o.findIndex(o=>o!==q.a);});
  await p.evaluate(i=>window.answer(i), wrongIdx);
  await p.waitForTimeout(1400);
  const after=(await p.textContent('#after')).replace(/\s+/g,' ');
  console.log('question: '+qt+'   (correct: '+right+')');
  console.log('reveal  : '+after.slice(0,120));
  ok('a MISS says nothing was banked', /nothing banked/i.test(after));
  ok('a miss does not read as though points were won', !/^\s*\+/.test(after));

  // and a hit says what was banked
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1100);
  await p.evaluate(()=>{ window.S.gap=0; window.S.qi=1; window.nextQ(); });
  await p.waitForTimeout(700);
  const rightIdx=await p.evaluate(()=>{const q=window.GAPS[0].q[window.S.qi];
    return q.o.indexOf(q.a);});
  await p.evaluate(i=>window.answer(i), rightIdx);
  await p.waitForTimeout(1400);
  const after2=(await p.textContent('#after')).replace(/\s+/g,' ');
  console.log('hit     : '+after2.slice(0,120));
  ok('a HIT says what was banked', /banked \d+/i.test(after2));
  ok('a hit does not say nothing banked', !/nothing banked/i.test(after2));
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nverified'); process.exit(fail?1:0);
})();
