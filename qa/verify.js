const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0;
const ok=(n,c,d='')=>{ console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c)fail++; };

(async()=>{
  const br=await chromium.launch();
  const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errs=[];
  ctx.on('page',p=>p.on('pageerror',e=>errs.push(String(e))));

  // --- 1. deep link lands in the VMA room
  let p=await ctx.newPage();
  await p.goto(B+'/?room=vmas&src=r-popheads',{waitUntil:'networkidle'});
  let act=await p.evaluate(()=>window.SHOW&&window.SHOW.act);
  let src=await p.evaluate(()=>localStorage.getItem('fg.src'));
  ok('?room=vmas loads the VMA room', act==='MTV VMAs', 'act='+act);
  ok('?src= is captured to localStorage', src==='r-popheads', 'fg.src='+src);

  // --- 2. first touch wins (second visit, different src)
  await p.goto(B+'/?room=vmas&src=OVERWRITE-ME',{waitUntil:'networkidle'});
  src=await p.evaluate(()=>localStorage.getItem('fg.src'));
  ok('first touch is not overwritten', src==='r-popheads', 'fg.src='+src);

  // --- 3. default is unchanged
  const c2=await br.newContext({viewport:{width:390,height:844}});
  let q=await c2.newPage();
  await q.goto(B+'/',{waitUntil:'networkidle'});
  let dact=await q.evaluate(()=>window.SHOW&&window.SHOW.act);
  ok('no ?room= still loads the default show', dact==='Black Eyed Peas', 'act='+dact);
  await q.goto(B+'/?room=not-a-real-room',{waitUntil:'networkidle'});
  let bact=await q.evaluate(()=>window.SHOW&&window.SHOW.act);
  ok('unknown ?room= falls through to default', bact==='Black Eyed Peas', 'act='+bact);

  // --- 4. THE GAME STAYS OFFLINE: no network call beyond the document+fonts
  const c3=await br.newContext({viewport:{width:390,height:844}});
  const seen=[];
  c3.on('request',r=>{ const u=r.url();
    if(!u.startsWith(B) && !u.includes('fonts.googleapis') && !u.includes('fonts.gstatic')) seen.push(u); });
  let z=await c3.newPage();
  await z.goto(B+'/?room=vmas&src=x',{waitUntil:'networkidle'});
  ok('the game makes no third-party call', seen.length===0, seen.join(', ')||'none');

  // --- 5. the capture page
  const c4=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  let v=await c4.newPage();
  const verr=[]; v.on('pageerror',e=>verr.push(String(e)));
  await v.goto(B+'/vmas/?src=x-post',{waitUntil:'networkidle'});
  await v.waitForTimeout(1200);
  const days=await v.textContent('#cdD');
  const disabled=await v.isDisabled('#go');
  const warnShown=await v.isVisible('#unset');
  const href=await v.getAttribute('#demoLink','href');
  const title=await v.title();
  ok('countdown is running', /^\d\d$/.test(days.trim()), 'days='+days);
  ok('submit is disabled while unconfigured', disabled===true);
  ok('the honest "not switched on" note is visible', warnShown===true);
  ok('demo link carries room + src', href&&href.includes('room=vmas')&&href.includes('x-post'), href);
  ok('no JS errors on the capture page', verr.length===0, verr.join(' | ')||'clean');
  await v.screenshot({path:S+'/vmas-page.png',fullPage:true});

  // --- 6. the journey: capture page → into the room
  await v.click('#demoLink');
  await v.waitForLoadState('networkidle');
  const landed=await v.evaluate(()=>window.SHOW&&window.SHOW.act);
  const lsrc=await v.evaluate(()=>localStorage.getItem('fg.src'));
  ok('clicking through lands IN the VMA room', landed==='MTV VMAs', 'act='+landed);
  ok('src survives the click-through', lsrc==='x-post', 'fg.src='+lsrc);
  await v.screenshot({path:S+'/landed-vma.png'});

  ok('no JS errors in the game', errs.length===0, errs.join(' | ')||'clean');
  await br.close();
  console.log(fail? '\n'+fail+' FAILED' : '\nall checks passed');
  process.exit(fail?1:0);
})();
