const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const B=process.env.TARGET||'http://127.0.0.1:8777';
const S=process.env.SHOTS||'/home/higherthan7/fans/qa/shots';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};
(async()=>{
  const br=await chromium.launch();
  const ctx=await br.newContext({viewport:{width:393,height:852},deviceScaleFactor:2});
  const p=await ctx.newPage(); const e=[]; p.on('pageerror',x=>e.push(String(x)));
  await p.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await p.waitForTimeout(700);

  const bar=await (await p.$('#hostpanel')).boundingBox();
  ok('panel is CLOSED by default', !(await p.evaluate(()=>document.getElementById('hostpanel').classList.contains('open'))));
  ok('closed panel is a slim bar, not half the screen', bar.height<70, Math.round(bar.height)+'px of 852');
  ok('the question body is hidden when closed', await p.isHidden('#hostpanel .hp-body'));
  ok('the bar still reports what is unset',
     (await p.textContent('#hostpanel .hp-h')).includes('2 UNSET'));
  await p.screenshot({path:S+'/panel-closed.png'});

  // the banner tells the truth in this room
  const d=await p.textContent('#discl');
  ok('banner no longer says DEMO DATA in a real room', !/demo data/i.test(d), d.trim());
  ok('banner names the right broadcaster', /NBC/.test(d));

  // open it
  await p.click('#hostpanel .hp-h');
  await p.waitForTimeout(300);
  ok('tapping the bar opens it', await p.isVisible('#hostpanel .hp-body'));
  const open=await (await p.$('#hostpanel')).boundingBox();
  ok('open panel still leaves the game visible', open.height<852*0.62, Math.round(open.height)+'px');
  await p.screenshot({path:S+'/panel-open.png'});

  // setting an answer keeps it open and updates the bar
  await p.evaluate(()=>window.setTruth(0,0,'Slow Horses'));
  await p.waitForTimeout(200);
  ok('still open after setting an answer', await p.isVisible('#hostpanel .hp-body'));
  ok('bar counts down to 1 UNSET', (await p.textContent('#hostpanel .hp-h')).includes('1 UNSET'));
  await p.click('#hostpanel .hp-h');
  await p.waitForTimeout(200);
  ok('tapping again closes it', await p.isHidden('#hostpanel .hp-body'));

  // demo room keeps its own banner
  const c2=await br.newContext({viewport:{width:393,height:852}});
  const v=await c2.newPage();
  await v.goto(B+'/',{waitUntil:'networkidle'});
  ok('demo room still says demo data', /demo data/i.test(await v.textContent('#discl')));

  // the nav must stay tappable with the panel up
  const c3=await br.newContext({viewport:{width:393,height:852}});
  const n=await c3.newPage();
  await n.goto(B+'/?room=emmys&host=1',{waitUntil:'networkidle'});
  await n.waitForTimeout(500);
  const navB=await (await n.$('.nav')).boundingBox();
  const panB=await (await n.$('#hostpanel')).boundingBox();
  ok('panel sits ABOVE the nav, not over it',
     panB.y+panB.height<=navB.y+1, 'panel ends '+Math.round(panB.y+panB.height)+', nav starts '+Math.round(navB.y));
  await n.click('.navb:nth-child(4)');
  await n.waitForTimeout(300);
  ok('the nav is still tappable with the panel up', true);
  await n.screenshot({path:S+'/panel-nav.png'});
  ok('no JS errors', e.length===0, e.join(' | ')||'clean');
  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nall checks passed'); process.exit(fail?1:0);
})();
