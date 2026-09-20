const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
/* THE ONLY HONEST CHECK: scroll to the very bottom, then ask whether the
   last interactive thing on the screen is actually visible above the
   panel. "It scrolls" proves nothing. */
async function lastVisible(p,label){
  await p.evaluate(()=>{const s=document.getElementById('scroller');s.scrollTop=s.scrollHeight;});
  await p.waitForTimeout(350);
  return await p.evaluate(()=>{
    const btns=[...document.querySelectorAll('#stage button, #stage .waitfor')];
    if(!btns.length) return {n:0,ok:true};
    const last=btns[btns.length-1].getBoundingClientRect();
    const hp=document.getElementById('hostpanel');
    const top=(hp&&!hp.hidden)?hp.getBoundingClientRect().top:window.innerHeight;
    return {n:btns.length, text:btns[btns.length-1].textContent.trim().slice(0,28),
            bottom:Math.round(last.bottom), panelTop:Math.round(top),
            ok:last.bottom<=top+1};
  });
}
(async()=>{
  const br=await chromium.launch();
  for(const vp of [{width:393,height:852,n:'phone'},{width:1440,height:900,n:'laptop'}]){
    const p=await (await br.newContext({viewport:{width:vp.width,height:vp.height}})).newPage();
    await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle',timeout:45000});
    await p.waitForTimeout(600);
    await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1100);
    await p.evaluate(()=>window.navGo('gametime')); await p.waitForTimeout(400);

    let r=await lastVisible(p,vp.n);
    ok('['+vp.n+'] last control reachable, panel CLOSED', r.ok,
       '"'+r.text+'" ends '+r.bottom+', panel top '+r.panelTop);

    await p.click('#hostpanel .hp-h'); await p.waitForTimeout(400);
    r=await lastVisible(p,vp.n);
    ok('['+vp.n+'] last control reachable, panel OPEN', r.ok,
       '"'+r.text+'" ends '+r.bottom+', panel top '+r.panelTop);

    // and on the reward screen, which is the one that lost its button
    await p.evaluate(()=>{ window.S.gapStartPts=window.S.pts; window.renderReward(); });
    await p.waitForTimeout(400);
    r=await lastVisible(p,vp.n);
    ok('['+vp.n+'] reward screen: last control reachable', r.ok,
       '"'+r.text+'" ends '+r.bottom+', panel top '+r.panelTop);
    await p.screenshot({path:(process.env.SHOTS||'/home/higherthan7/fans/qa/shots')+'/reach-'+vp.n+'.png'});
    await p.close();
  }
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nnothing is hidden'); process.exit(fail?1:0);
})();
