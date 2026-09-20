const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0;
const ok=(n,c,d='')=>{ console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c)fail++; };
(async()=>{
  const br=await chromium.launch();

  // 1. the room loads, player view has NO panel
  let ctx=await br.newContext({viewport:{width:390,height:844}});
  let p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(B+'/?room=emmys',{waitUntil:'networkidle'});
  ok('?room=emmys loads the Emmys',
     await p.evaluate(()=>window.SHOW.act)==='The 78th Emmys');
  ok('3 Gametimes, not 5', await p.evaluate(()=>window.GAPS.length)===3);
  ok('worths mirror the VMA back half (2/4/5)',
     JSON.stringify(await p.evaluate(()=>window.GAPS.map(g=>g.worth)))==='[2,4,5]');
  ok('no room questions in a solo run',
     await p.evaluate(()=>window.GAPS.some(g=>g.q.some(q=>q.mode==='room')))===false);
  ok('PLAYER link shows no resolution panel', await p.isHidden('#hostpanel'));

  // 2. the predicts ship UNSET — the whole point
  const unset=await p.evaluate(()=>window.GAPS.flatMap(g=>g.q).filter(q=>q.mode==='predict'&&!q.a).length);
  const recalls=await p.evaluate(()=>window.GAPS.flatMap(g=>g.q).filter(q=>q.mode==='recall'&&q.a).length);
  ok('every predict ships with NO baked-in answer', unset===2, unset+' unset');
  ok('every recall ships WITH a real answer', recalls===5, recalls+' answered');

  // 3. host panel sets truth, and it reaches q.a at the source
  const c2=await br.newContext({viewport:{width:390,height:844}});
  const h=await c2.newPage(); const herrs=[]; h.on('pageerror',e=>herrs.push(String(e)));
  await h.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  ok('host link shows the panel', await h.isVisible('#hostpanel'));
  ok('panel counts the unset ones', (await h.textContent('#hostpanel .hp-h')).includes('2 UNSET'));
  await h.evaluate(()=>window.setTruth(0,0,'Slow Horses'));
  ok('setTruth writes through to q.a',
     await h.evaluate(()=>window.GAPS[0].q[0].a)==='Slow Horses');
  ok('panel now shows one unset', (await h.textContent('#hostpanel .hp-h')).includes('1 UNSET'));

  // 4. IT SURVIVES A RELOAD — a host who refreshes mid-show loses nothing
  await h.reload({waitUntil:'networkidle'});
  ok('truth survives a reload', await h.evaluate(()=>window.GAPS[0].q[0].a)==='Slow Horses');

  // 5. ADVERSARIAL: a bogus value must not poison the bank
  await h.evaluate(()=>{ localStorage.setItem('fg.truth.emmys',
     JSON.stringify({'0:0':'NOT A NOMINEE'})); });
  await h.reload({waitUntil:'networkidle'});
  ok('an answer that is not an option is REFUSED',
     await h.evaluate(()=>window.GAPS[0].q[0].a)==='', 'a='+await h.evaluate(()=>window.GAPS[0].q[0].a));

  // 6. the VMA room, 13 days out, is untouched
  const c3=await br.newContext({viewport:{width:390,height:844}});
  const v=await c3.newPage(); const verrs=[]; v.on('pageerror',e=>verrs.push(String(e)));
  await v.goto(B+'/?room=vmas',{waitUntil:'networkidle'});
  ok('VMA room still loads', await v.evaluate(()=>window.SHOW.act)==='MTV VMAs');
  ok('VMA room still has its 5 Gametimes', await v.evaluate(()=>window.GAPS.length)===5);
  ok('VMA room shows no panel', await v.isHidden('#hostpanel'));
  ok('default room untouched',
     await (async()=>{ await v.goto(B+'/',{waitUntil:'networkidle'});
       return await v.evaluate(()=>window.SHOW.act); })()==='Black Eyed Peas');

  ok('no JS errors anywhere', errs.length+herrs.length+verrs.length===0,
     [...errs,...herrs,...verrs].join(' | ')||'clean');

  await h.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await h.waitForTimeout(600);
  await h.screenshot({path:S+'/emmys-host.png'});
  await br.close();
  console.log(fail? '\n'+fail+' FAILED' : '\nall checks passed');
  process.exit(fail?1:0);
})();
