/* THE RESOLUTION CHECK, CHECKED — offline, against saved Wikipedia pages.

   host/resolve.js is the one independent source that audits the host's
   calls. If it misreads a page it audits with total confidence and is
   wrong, so it gets its own suite. Four fixtures, two shapes, two states:

     CMAs 2026           table-header layout, BEFORE the show
     Latin Grammys 2026  template layout with credit sub-bullets, BEFORE
     78th Emmys          template layout, AFTER (winner *, losers **)
     VMAs 2026           template layout, AFTER

   Written 28 Oct 2026 when the CMA page parsed to nothing, Record of the
   Year counted its producers as nominees (20 of 10), and a colspan cell
   handed Musical Event of the Year to Brooks & Dunn three weeks before
   the show. No browser, no network: the fixtures are in qa/fixtures/. */
const fs = require('fs'), path = require('path');
const { parseCategories } = require('../host/resolve.js');
let fail = 0; const ok = (n,c,d='') => { console.log((c?'PASS  ':'FAIL  ')+n+(d?'  → '+d:'')); if(!c) fail++; };

/* the CLI reads only the nominees section; so does this */
function load(page){
  const wt = fs.readFileSync(path.join(__dirname, 'fixtures', page + '.wiki'), 'utf8');
  const m = wt.match(/^==\s*(Winners and nominees|Nominees|Nominations|Winners)\s*==.*$/im);
  if(!m) return parseCategories(wt);
  const rest = wt.slice(m.index + m[0].length);
  const end = rest.search(/^==[^=]/m);
  return parseCategories(end < 0 ? rest : rest.slice(0, end));
}
const cat = (cs, n) => cs.find(c => c.category === n);

/* ---- CMAs, before ---- */
const cma = load('60th_Annual_Country_Music_Association_Awards');
const eoty = cat(cma, 'Entertainer of the Year');
ok('CMA: Entertainer of the Year is found', !!eoty);
ok('CMA: Entertainer has exactly the five published nominees',
   eoty && eoty.nominees.join('|') === 'Luke Combs|Cody Johnson|Ella Langley|Chris Stapleton|Lainey Wilson',
   eoty && eoty.nominees.join(', '));
ok('CMA: all eleven voted categories parse', ['Album of the Year','Male Vocalist of the Year',
   'Female Vocalist of the Year','Vocal Group of the Year','Vocal Duo of the Year','Single of the Year',
   'Song of the Year','New Artist of the Year','Musician of the Year','Music Video of the Year',
   'Musical Event of the Year'].every(n => cat(cma, n) && cat(cma, n).nominees.length === 5));
const decided = cma.filter(c => c.decided).map(c => c.category);
ok('CMA: nothing voted is decided before the show (only the pre-announced honoree)',
   decided.join('|') === 'Willie Nelson Lifetime Achievement Award', decided.join(', '));

/* ---- Latin Grammys, before ---- */
const lg = load('27th_Annual_Latin_Grammy_Awards');
const roty = cat(lg, 'Record of the Year');
ok('Latin: Record of the Year has ten nominees, not twenty', roty && roty.nominees.length === 10,
   roty && String(roty.nominees.length));
ok('Latin: no credit line is read as a nominee',
   !lg.some(c => c.nominees.some(n => /producer|engineer|mixer|songwriter/i.test(n))));
ok('Latin: nothing is decided before the show', !lg.some(c => c.decided));

/* ---- Emmys, after ---- */
const em = load('78th_Primetime_Emmy_Awards');
const comedy = cat(em, 'Outstanding Comedy Series'), drama = cat(em, 'Outstanding Drama Series');
ok('Emmys: Comedy Series won by Widow\'s Bay, all eight nominees kept',
   comedy && comedy.winner === "Widow's Bay" && comedy.nominees.length === 8,
   comedy && (comedy.winner + ' / ' + comedy.nominees.length));
ok('Emmys: Drama Series won by The Pitt', drama && drama.winner === 'The Pitt');

/* ---- VMAs, after ---- */
const vma = load('2026_MTV_Video_Music_Awards');
const voty = cat(vma, 'Video of the Year');
ok('VMAs: Video of the Year decided with six nominees',
   voty && voty.decided && voty.nominees.length === 6, voty && (voty.winner + ' / ' + voty.nominees.length));

console.log(fail ? `\n${fail} FAILED` : '\nall resolve checks pass');
process.exit(fail ? 1 : 0);
