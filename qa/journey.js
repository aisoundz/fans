const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
const log=(...a)=>console.log(...a);
/* THE GATE CAUGHT THIS: journey.js printed a narrative and asserted
   nothing, so it "passed" with 0 checks no matter what happened. The one
   suite that found the bug that blocked the Emmys could not fail. */
let fail=0;
const ok=(n,c,d='')=>{ console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c) fail++; };
(async()=>{
  const br=await chromium.launch();
  const p=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle',timeout:45000});
  await p.waitForTimeout(700);

  // clean slate, exactly as the founder was told to do
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1200);
  ok('reset puts the night back to Gametime 1',
     await p.evaluate(()=>window.S.gap)===0 && await p.evaluate(()=>window.openedGap())===0);
  ok('reset empties the sealed tray',
     await p.evaluate(()=>window.S.sealed.length)===0);

  async function playRound(label){
    await p.evaluate(()=>window.navGo('gametime')); await p.waitForTimeout(300);
    const btn=await p.$('#stage button.btn');
    if(!btn){ log('  !! '+label+': no Play button on the hold screen'); return false; }
    log('  '+label+': pressing "'+(await btn.textContent()).trim()+'"');
    await btn.click(); await p.waitForTimeout(700);
    for(let n=0;n<8;n++){
      const tile=await p.$('#tiles button.tile');
      if(!tile) break;
      const qt=await p.evaluate(()=>{const e=document.querySelector('#stage .qt,#stage h2,#stage .q');return e?e.textContent.trim().slice(0,52):'?';});
      await tile.click();
      await p.waitForTimeout(2900);          // the 1200ms beat + auto-advance
      log('     answered: '+qt);
    }
    return true;
  }

  log('\n--- GAMETIME 1: RIGHT BACK ---');
  await playRound('Right Back');
  ok('Right Back seals exactly the two predictions',
     await p.evaluate(()=>window.S.sealed.length)===2,
     await p.evaluate(()=>window.S.sealed.length)+' sealed');

  log('\n--- HOST OPENS THE ENVELOPE ---');
  await p.evaluate(()=>window.setOpenedGap(1)); await p.waitForTimeout(600);
  ok('OPEN THE ENVELOPE actually moves the night there',
     await p.evaluate(()=>window.S.gap)===1,
     'gap='+await p.evaluate(()=>window.S.gap));
  await playRound('The Envelope');

  log('\n--- HOST CALLS THE TWO WINNERS ---');
  await p.evaluate(()=>{ window.setTruth(0,0,'Slow Horses'); window.setTruth(0,1,'Hacks'); });
  log('  drama a="'+await p.evaluate(()=>window.GAPS[0].q[0].a)+'"  comedy a="'
     +await p.evaluate(()=>window.GAPS[0].q[1].a)+'"');
  ok('two calls are pending, not four — no duplicate seals',
     await p.evaluate(()=>window.pendingFor(2).length)===2,
     await p.evaluate(()=>window.pendingFor(2).length)+' pending');

  log('\n--- HOST OPENS CREDITS ---');
  await p.evaluate(()=>window.setOpenedGap(2)); await p.waitForTimeout(800);
  await p.evaluate(()=>window.navGo('gametime')); await p.waitForTimeout(600);
  const stage=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('OPEN CREDITS moves the night to the last Gametime',
     await p.evaluate(()=>window.S.gap)===2);
  ok('THE SETTLE FIRES — a call sealed an hour ago flips',
     /settling now/i.test(stage), stage.slice(0,90));
  ok('it names the call that was sealed', /Slow Horses/.test(stage));
  await p.screenshot({path:S+'/journey-credits.png',fullPage:false});

  ok('no JS errors across the whole night', errs.length===0, errs.join(' | ')||'clean');
  await br.close();
  console.log(fail? '\n'+fail+' FAILED' : '\nthe whole night plays end to end');
  process.exit(fail?1:0);
})();
