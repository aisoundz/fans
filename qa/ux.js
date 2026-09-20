const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
async function playRound(p){
  await p.evaluate(()=>window.navGo('gametime')); await p.waitForTimeout(300);
  const b=await p.$('#stage button.btn'); if(!b) return false;
  await b.click(); await p.waitForTimeout(700);
  for(let n=0;n<8;n++){ const t=await p.$('#tiles button.tile'); if(!t) break;
    await t.click(); await p.waitForTimeout(2900); }
  return true;
}
(async()=>{
  const br=await chromium.launch();
  // DESKTOP viewport — this is what the founder was actually looking at
  const p=await (await br.newContext({viewport:{width:1440,height:900}})).newPage();
  const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle',timeout:45000});
  await p.waitForTimeout(600);
  await p.evaluate(()=>window.resetNight()); await p.waitForTimeout(1100);

  // panel must not swallow the phone on a laptop
  await p.click('#hostpanel .hp-h'); await p.waitForTimeout(300);
  const pan=await (await p.$('#hostpanel')).boundingBox();
  const ph=await (await p.$('.phone')).boundingBox();
  ok('open panel is under half the phone frame on desktop',
     pan.height < ph.height*0.5, Math.round(pan.height)+'px of a '+Math.round(ph.height)+'px phone');
  await p.click('#hostpanel .hp-h'); await p.waitForTimeout(250);

  await playRound(p);
  const rew=(await p.textContent('#stage')).replace(/\s+/g,' ');

  // the dead-end button
  ok('reward does NOT offer a button into a shut Gametime',
     !/Go to The Envelope/i.test(rew), (rew.match(/Go to [A-Za-z ]+/)||['none'])[0]);
  ok('it says when the next one opens instead',
     /opens when the break comes/i.test(rew));

  // the last invented crowd
  ok('no invented placing on the reward screen',
     !/\b\d+(st|nd|rd|th)\b/.test(rew), (rew.match(/\b\d+(st|nd|rd|th)\b/)||['none'])[0]);
  ok('no "more to take a place"', !/take a place/i.test(rew));
  ok('it reports earned instead', /earned so far/i.test(rew));
  await p.screenshot({path:S+'/ux-reward.png'});

  // a wrong answer must not read as banked
  ok('a miss says nothing banked', /nothing banked/i.test(rew)||!/worth \d+ at/i.test(rew),
     (rew.match(/nothing banked[^·]*/)||rew.match(/banked \d+[^·]*/)||['?'])[0]);

  // the shut screen orients you
  await p.evaluate(()=>window.goto(2)); await p.waitForTimeout(500);
  const shut=(await p.textContent('#stage')).replace(/\s+/g,' ');
  ok('shut screen says where you actually are', /You are still in/i.test(shut));
  ok('shut screen offers the way back', /Back to Right Back/i.test(shut));
  await p.screenshot({path:S+'/ux-shut.png'});

  // once opened, the button comes back
  await p.evaluate(()=>{ window.setOpenedGap(1); window.goto(0); }); await p.waitForTimeout(500);
  await p.evaluate(()=>window.renderReward()); await p.waitForTimeout(400);
  ok('with the next one OPEN the button returns',
     /Go to The Envelope/i.test((await p.textContent('#stage'))));

  // demos still rank
  const v=await (await br.newContext({viewport:{width:393,height:852}})).newPage();
  await v.goto(B+'/',{waitUntil:'networkidle'}); await v.waitForTimeout(500);
  await v.evaluate(()=>{ window.S.gapStartPts=0; window.S.gapStartPos=9; window.renderReward(); });
  await v.waitForTimeout(400);
  ok('demo room still shows its leaderboard',
     /\b\d+(st|nd|rd|th)\b/.test(await v.textContent('#stage')));

  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
