const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1100);
  await p.evaluate(()=>window.navGo('gametime')); await p.waitForTimeout(400);
  await p.click('#hostpanel .hp-h'); await p.waitForTimeout(400);

  const measure=()=>p.evaluate(()=>{
    const s=document.getElementById('scroller'); s.scrollTop=s.scrollHeight;
    const b=[...document.querySelectorAll('#stage button, #stage .waitfor')];
    const last=b[b.length-1].getBoundingClientRect();
    const top=document.getElementById('hostpanel').getBoundingClientRect().top;
    return {text:b[b.length-1].textContent.trim().slice(0,24),
            bottom:Math.round(last.bottom), panelTop:Math.round(top),
            reachable:last.bottom<=top+1};
  });

  let r=await measure();
  console.log('WITH the fix    : reachable='+r.reachable+'  "'+r.text+'" ends '+r.bottom+', panel top '+r.panelTop);

  // reintroduce the bug: remove the padding the fix adds
  await p.evaluate(()=>{ document.getElementById('scroller').style.paddingBottom='0px'; });
  await p.waitForTimeout(300);
  r=await measure();
  console.log('WITHOUT the fix : reachable='+r.reachable+'  "'+r.text+'" ends '+r.bottom+', panel top '+r.panelTop);
  console.log(r.reachable ? '\nBAD — the check cannot see the bug' : '\nGOOD — the check fails when the bug is back');
  await br.close();
  process.exit(r.reachable?1:0);
})();
