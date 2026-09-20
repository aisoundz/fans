const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
const VOTY=["Ariana Grande","Bruno Mars","Gener8ion featuring Yung Lean","Madonna","Sabrina Carpenter","Taylor Swift"];
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  const e=[]; p.on('pageerror',x=>e.push(String(x)));
  const E=x=>p.evaluate(x);
  await p.goto(B+'/?room=vmas&host=1',{waitUntil:'networkidle',timeout:45000});
  await p.waitForTimeout(700);

  ok('VMA room loads', await E('SHOW.act')==='MTV VMAs');
  ok('it is a REAL room', await E('SHOW.real')===true);
  ok('so it is paced against the broadcast', await E('paced()')===true);
  ok('and it invents no audience', await E('playing()')===null);

  const baked=await E('GAPS.flatMap(g=>g.q).filter(q=>q.mode==="predict"&&q.a).map(q=>q.t)');
  ok('NO predict ships with a baked-in answer', baked.length===0, baked.join(' | ')||'none');

  ok('no room questions — nothing counts the room',
     await E('GAPS.flatMap(g=>g.q).filter(q=>q.mode==="room").length')===0);

  const voty=await E('GAPS.flatMap(g=>g.q).find(q=>/Video of the Year/.test(q.t)).o');
  ok('Video of the Year offers all six published nominees',
     voty.length===6 && VOTY.every(n=>voty.includes(n)), voty.join(', '));
  ok('Bruno Mars is no longer missing', voty.includes('Bruno Mars'));
  ok('Gener8ion is no longer missing', voty.includes('Gener8ion featuring Yung Lean'));

  // VOID — an uncalled question must not mark anybody wrong
  ok('an uncalled question reads as void', await E('isVoid(0,0)')===true);
  await E('S.ans["0:0"]="Madonna"');
  ok('answering it is not scored as correct', await E('wasRight(0,0)')===false);
  await E('setTruth(0,0,"Taylor Swift")');
  ok('once the host calls it, it is no longer void', await E('isVoid(0,0)')===false);
  await E('S.ans["0:0"]="Taylor Swift"');
  ok('a matching call now grades correct', await E('wasRight(0,0)')===true);
  await E('S.ans["0:0"]="Madonna"');
  ok('a non-matching call grades wrong', await E('wasRight(0,0)')===false);

  // demo rooms are untouched
  const v=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  const V=x=>v.evaluate(x);
  await v.goto(B+'/',{waitUntil:'networkidle'}); await v.waitForTimeout(500);
  ok('demo room still HAS room questions',
     await V('GAPS.flatMap(g=>g.q).filter(q=>q.mode==="room").length')>0);
  ok('demo room still shows a crowd', await V('playing()')!==null);
  ok('demo room is not paced', await V('paced()')===false);

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nVMA room is ready'); process.exit(fail?1:0);
})();
