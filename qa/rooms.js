/* THE NOVEMBER ROOMS, AND THE ARTIST LINK.

   Each rule here is a mistake the VMA room actually shipped:
   - a recall answer written before the show (Artist of the Year said
     Sabrina Carpenter; Madonna won it)
   - a sealed call settling in the break BEFORE its award, where it voids
   - a nominee missing from the tiles (Emmys: the winner was the one cut)
   - the Emmys' disclaimer printed under another network's show
   And one the 15 Sept pacing change did to every artist link: Gametime 2
   never opened, because nobody holds a host panel at a club gig.

   Tiles are checked against the resolver's own parse of the saved
   Wikipedia pages (qa/fixtures), so the bank and the auditor agree. */
const fs=require('fs'), path=require('path');
require('./lib/relay-mock.js');
const { parseCategories } = require('../host/resolve.js');
const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0;
const ok=(n,c,d='')=>{ console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c) fail++; };

function cats(page){
  const wt=fs.readFileSync(path.join(__dirname,'fixtures',page+'.wiki'),'utf8');
  const m=wt.match(/^==\s*(Winners and nominees|Nominees|Nominations|Winners)\s*==.*$/im);
  const rest=wt.slice(m.index+m[0].length), end=rest.search(/^==[^=]/m);
  return parseCategories(end<0?rest:rest.slice(0,end));
}
/* quotes and apostrophes differ between Wikipedia and a tile */
const norm=s=>String(s).replace(/[“”"‘’']/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function sameNominees(opts, cat){
  if(!cat) return 'category missing from the source';
  if(opts.length!==cat.nominees.length) return opts.length+' tiles, '+cat.nominees.length+' nominees';
  const miss=cat.nominees.filter(n=>!opts.some(o=>norm(o).startsWith(norm(n))));
  return miss.length ? 'missing: '+miss.join(', ') : '';
}

const ROOMS=[
  { room:'cmas', act:'The 60th CMA Awards', page:'60th_Annual_Country_Music_Association_Awards', net:/CMA, ABC or Disney/,
    tiles:[[0,0,'Entertainer of the Year'],[0,1,'Female Vocalist of the Year'],
           [4,0,'Male Vocalist of the Year'],[4,1,'Single of the Year']] },
  { room:'latin', act:'The 27th Latin Grammys', page:'27th_Annual_Latin_Grammy_Awards', net:/Latin Recording Academy or Univision/,
    tiles:[[0,0,'Record of the Year'],[0,1,'Album of the Year']] }
];

(async()=>{
  const br=await chromium.launch();
  for(const R of ROOMS){
    const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
    await p.goto(B+'/?room='+R.room,{waitUntil:'networkidle'});
    const d=await p.evaluate(()=>({act:SHOW.act, paced:paced(), raw:SHOW.gaps.length, gaps:GAPS.length,
      qs:SHOW.gaps.map((g,gi)=>g.q.map((q,qi)=>({gi,qi,mode:q.mode,a:q._a0!==undefined?q._a0:q.a,settles:q.settles,o:q.o,t:q.t}))).flat(),
      discl:(document.getElementById('discl')||{}).textContent||'', bar:(document.getElementById('dbar')||{}).textContent||''}));
    const tag=R.room+': ';
    ok(tag+'?room= lands in the right show', d.act===R.act, d.act);
    ok(tag+'is paced by the host', d.paced===true);
    ok(tag+'the banner does not tell a player they set the pace', /opens at the break/.test(d.bar), d.bar);
    ok(tag+'the disclaimer names its own broadcaster', R.net.test(d.discl) && !/NBC|Television Academy/.test(d.discl), d.discl);
    ok(tag+'no room questions (nothing counts the room yet)', !d.qs.some(q=>q.mode==='room'));
    ok(tag+'every Gametime survives the room-question strip, so host and player indexes agree', d.raw===d.gaps);
    const baked=d.qs.filter(q=>q.a);
    ok(tag+'no answer was written before the show', baked.length===0, baked.map(q=>q.t).join(' | ')||'none');
    const early=d.qs.filter(q=>q.mode==='predict' && q.settles!==d.raw-1);
    ok(tag+'every sealed call settles at Credits, after every award', early.length===0, early.map(q=>q.t).join(' | ')||'none');
    const src=cats(R.page);
    for(const [gi,qi,name] of R.tiles){
      const q=d.qs.find(x=>x.gi===gi && x.qi===qi);
      const why=sameNominees(q.o, src.find(c=>c.category===name));
      ok(tag+name+': the tiles are exactly the published nominees', !why, why||q.o.length+' tiles');
    }
    await p.context().close();
  }

  /* the artist link, from advance.html — walkable end to end, no host */
  const s=Buffer.from(JSON.stringify({a:'Test Band',v:'The Echo',
    s:['One','Two','Three','Four','Five','Six','Seven','Eight']})).toString('base64url');
  const a=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  const net=[]; a.context().on('request',r=>{ if(r.url().startsWith(global.RELAY_MOCK.RELAY)) net.push(r.url()); });
  await a.goto(B+'/?s='+s,{waitUntil:'networkidle'});
  const ad=await a.evaluate(()=>({act:SHOW.act, paced:paced(), open:GAPS.map((g,i)=>gapOpen(i)),
    bar:(document.getElementById('dbar')||{}).textContent||''}));
  ok('artist link: loads the artist\'s show', ad.act==='Test Band');
  ok('artist link: every Gametime is open with no host holding a panel', ad.open.every(Boolean), JSON.stringify(ad.open));
  ok('artist link: tells the fan they set the pace', /you set the pace/.test(ad.bar), ad.bar);
  ok('artist link: touches no relay', net.length===0, net.join(', ')||'none');
  await a.evaluate(()=>goto(2)); await a.waitForTimeout(400);
  ok('artist link: the last Gametime can actually be reached', await a.evaluate(()=>S.gap)===2);

  await br.close();
  console.log(fail? '\n'+fail+' FAILED' : '\nthe rooms say only what is true');
  process.exit(fail?1:0);
})();
