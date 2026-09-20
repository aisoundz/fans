/* The /vmas capture form, proven honest in all three cases.

   CAPTURE_ENDPOINT ships empty on purpose — a form that swallows an
   address and answers "thanks" costs you the person AND reports a number
   that is not true. So this suite serves its own copy of the page with a
   fake endpoint patched in, and intercepts that endpoint to play the
   three outcomes that matter. No scratchpad, no second server. */
const { chromium } = require(process.env.PW||'/home/higherthan7/stats/node_modules/playwright');
const fs = require('fs');
const B = process.env.TARGET || 'http://127.0.0.1:8777';
const SRC = '/home/higherthan7/fans/vmas/index.html';
let fail=0; const ok=(n,c,d='')=>{console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:''));if(!c)fail++;};

const FAKE = 'https://fake.test/jsonp/1/forms/2/subscribe';

async function run(br, mode){
  const ctx = await br.newContext({viewport:{width:393,height:852}});
  const p = await ctx.newPage();
  let hit = null;

  const html = fs.readFileSync(SRC,'utf8')
    .replace("var CAPTURE_ENDPOINT  = '';", "var CAPTURE_ENDPOINT  = '"+FAKE+"';");
  await ctx.route('**/vmas/**', r => r.fulfill({status:200, contentType:'text/html', body:html}));
  await ctx.route('https://fake.test/**', async route => {
    const u = new URL(route.request().url()); hit = u;
    if(mode==='ok'){
      await route.fulfill({status:200, contentType:'application/javascript',
        body: u.searchParams.get('callback')+'({"success":true});'});
    } else if(mode==='dead'){ await route.abort('failed'); }
    /* mode 'silent': never answer */
  });

  await p.goto(B+'/vmas/', {waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500);
  await p.fill('#em','someone@example.com');
  await p.click('#go');
  await p.waitForTimeout(mode==='silent' ? 13500 : 1600);
  const res = {
    okShown : await p.isVisible('#ok'),
    badShown: await p.isVisible('#bad'),
    formGone: (await p.getAttribute('#f','hidden')) !== null,
    hit
  };
  await ctx.close();
  return res;
}

(async()=>{
  const br = await chromium.launch();

  let r = await run(br,'ok');
  ok('a real success says you are on the list', r.okShown && !r.badShown);
  ok('the form is retired after a success', r.formGone);
  ok('the address is sent as fields[email]',
     r.hit && r.hit.searchParams.get('fields[email]')==='someone@example.com',
     r.hit ? r.hit.searchParams.get('fields[email]') : 'endpoint never called');

  r = await run(br,'dead');
  ok('a DEAD endpoint reports failure, never success', r.badShown && !r.okShown);
  ok('a dead endpoint leaves the form usable', !r.formGone);

  r = await run(br,'silent');
  ok('a SILENT endpoint times out to failure', r.badShown && !r.okShown);

  /* and the shipped page, unpatched, must still refuse to pretend */
  const ctx = await br.newContext({viewport:{width:393,height:852}});
  const q = await ctx.newPage();
  await q.goto(B+'/vmas/',{waitUntil:'networkidle'});
  await q.waitForTimeout(400);
  ok('as shipped the form is OFF, and says so',
     await q.isDisabled('#go') && await q.isVisible('#unset'));

  await br.close();
  console.log(fail?'\n'+fail+' FAILED':'\nthe form is honest in every case');
  process.exit(fail?1:0);
})();
