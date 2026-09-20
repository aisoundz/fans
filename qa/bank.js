const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
// the real results, as published
const TRUTH={'Outstanding Drama Series':'The Pitt','Outstanding Comedy Series':"Widow's Bay",
  'Lead Actress in a Drama Series':'Rhea Seehorn','Lead Actor in a Drama Series':'Noah Wyle',
  'Lead Actress in a Comedy Series':'Jean Smart'};
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle',timeout:45000});
  await p.waitForTimeout(700);
  const qs=await p.evaluate(()=>window.GAPS.flatMap((g,gi)=>g.q.map((q,qi)=>
    ({gi,qi,t:q.t,o:q.o,a:q.a,mode:q.mode}))));
  // EVERY question must be answerable with the true result
  for(const [cat,win] of Object.entries(TRUTH)){
    const q=qs.find(x=>x.t.includes(cat));
    if(!q){ ok('question exists for '+cat, false); continue; }
    ok('"'+cat+'" can be answered with the real winner ('+win+')',
       q.o.includes(win), 'options: '+q.o.join(' / '));
  }
  // and every recall answer must equal the real result
  for(const q of qs.filter(x=>x.mode==='recall'&&x.a)){
    const cat=Object.keys(TRUTH).find(c=>q.t.includes(c));
    if(cat) ok('recall answer for "'+cat+'" is correct', q.a===TRUTH[cat], q.a);
  }
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nbank agrees with the published results');
  process.exit(fail?1:0);
})();
