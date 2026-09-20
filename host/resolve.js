#!/usr/bin/env node
/* ====================================================================
   FANS GAMETIME — THE RESOLUTION CHECK

   A live show has no results API. Awards shows have something better and
   nobody uses it: Wikipedia's parse API, which is keyless, stable, and
   updated within minutes of an award being read out. Its winners section
   is unambiguous by structure, not by guesswork —

       *'''''[[Widow's Bay]]'' (Apple TV)'''      <- one star  = WINNER
       **''[[Abbott Elementary]]'' (ABC)          <- two stars = nominee

   WHAT THIS IS FOR, AND WHAT IT IS NOT FOR.

   It does NOT drive the game. A scraper that learns a result before the
   viewer's broadcast shows it would spoil the single best moment in the
   product, and on a delayed feed it certainly would. The host stays the
   clock: they hear the award and tap it, synchronised to the same
   broadcast the players are watching.

   This AUDITS the host. It answers "does an independent published source
   agree with what was called?" — and when it disagrees it says so rather
   than silently overwriting a human. The founder typed two wrong winners
   into the panel under no time pressure at all; a host doing it live,
   one-handed, mid-show, will be wrong sometimes, and a wrong call grades
   every player wrong with total confidence.

   It also emits the FULL nominee list, which is the fix for a separate
   defect: Outstanding Comedy Series was cut from eight nominees to four
   tiles and the winner was one of the four dropped, so the question could
   not be answered correctly by anybody.

   Usage
     node host/resolve.js <wiki-page> [--category "Outstanding Drama Series"]
     node host/resolve.js <wiki-page> --all
     node host/resolve.js <wiki-page> --check "Category=Expected Winner" ...
   ==================================================================== */
'use strict';
const https = require('https');

const UA = 'FansGametime/1.0 (https://fansgametime.com; aisoundz9@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';

function get(url){
  return new Promise((res, rej) => {
    https.get(url, {headers:{'User-Agent':UA,'Accept':'application/json'}}, r => {
      if(r.statusCode !== 200){ r.resume(); return rej(new Error('HTTP '+r.statusCode)); }
      let b=''; r.setEncoding('utf8');
      r.on('data', c => b += c);
      r.on('end', () => { try{ res(JSON.parse(b)); }catch(e){ rej(e); } });
    }).on('error', rej);
  });
}

/* [[Link|Shown]] -> Shown, [[Thing]] -> Thing, strip italics/bold and the
   trailing network in brackets. */
function clean(s){
  return String(s)
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\{\{nbsp\}\}/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\{\{.*$/, '')          /* an unclosed {{small| on a heading */
    .replace(/'''''|'''|''/g, '')
    .replace(/[\u2020\u2021*]+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s*\([^()]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* THE THING A QUESTION IS ACTUALLY GRADED ON. Wikipedia writes a winner
   as "Noah Wyle – The Pitt as Dr. Michael Robinavitch"; a tile says
   "Noah Wyle". Take the part before the en dash, and drop the role. */
function token(s){
  return clean(s)
    .split(/\s+[\u2013\u2014-]\s+/)[0]
    .replace(/\s+as\s+.*$/i, '')
    .trim();
}

async function sections(page){
  const d = await get(`${API}?action=parse&page=${encodeURIComponent(page)}&prop=sections&format=json`);
  if(d.error) throw new Error(d.error.info);
  return d.parse.sections;
}
async function wikitext(page, index){
  const d = await get(`${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&section=${index}`);
  if(d.error) throw new Error(d.error.info);
  return d.parse.wikitext['*'];
}
async function lastEdited(page){
  const d = await get(`${API}?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvprop=timestamp&rvlimit=1&format=json`);
  const pages = d.query && d.query.pages;
  const k = pages && Object.keys(pages)[0];
  return (k && pages[k].revisions && pages[k].revisions[0].timestamp) || null;
}

/* Walk the wikitext and pull {category, winner, nominees}.

   THE RULE IS BOLD, NOT BULLET DEPTH. After a show Wikipedia writes the
   winner as one star and bold, and the losers as two stars. But BEFORE a
   show every nominee is a single star and nothing is bold at all:

       * [[Ariana Grande]] - "Hate That I Made You Love Me"
       * [[Bruno Mars]] - "I Just Might"

   The first version keyed off star depth, so pointed at the un-held VMAs
   it would have announced Ariana Grande the winner of Video of the Year
   eight days before anybody voted, with total confidence — the exact
   failure this file exists to prevent. Bold is the invariant across both
   states, and no bold means NOT DECIDED YET. */
function parseCategories(wt){
  const out = [];
  let cur = null;
  for(const raw of wt.split('\n')){
    const line = raw.trim();

    const cat = line.match(/\{\{\s*Award category[^|]*\|[^|]*\|\s*(.+?)\}\}/i);
    if(cat){
      if(cur) out.push(cur);
      cur = { category: clean(cat[1]), winner: null, winnerFull: null, nominees: [], decided: false };
      continue;
    }
    if(!cur) continue;
    if(!/^\*+\s*\S/.test(line)) continue;

    const body = line.replace(/^\*+\s*/, '');
    const name = token(body);
    if(!name) continue;
    if(!cur.nominees.includes(name)) cur.nominees.push(name);

    if(/'''/.test(body) && !cur.winner){        /* bold: this one won */
      cur.winner = name;
      cur.winnerFull = clean(body);
      cur.decided = true;
    }
  }
  if(cur) out.push(cur);
  return out.filter(c => c.nominees.length);
}

async function resolve(page){
  const secs = await sections(page);
  /* "Winners and nominees" after the show; "Nominees" or "Nominations"
     before it. Take that heading and everything nested beneath it. */
  const top = secs.find(s => /^(winners and nominees|nominees|nominations|winners)$/i.test(s.line));
  let want = [];
  if(top){
    want = secs.filter(s => s.index === top.index ||
      (s.number && String(s.number).startsWith(String(top.number) + '.')));
  }
  if(!want.length){
    want = secs.filter(s => /^(programs|acting|lead|supporting|directing|writing|main|awards|voted categories|professional categories)$/i.test(s.line));
  }
  if(!want.length) throw new Error('no nominees section on "' + page + '" — headings: '
    + secs.map(s => s.line).join(', '));

  const seen = new Set(); const cats = [];
  for(const s of want){
    if(seen.has(s.index)) continue; seen.add(s.index);
    let wt; try{ wt = await wikitext(page, s.index); }catch(e){ continue; }
    for(const c of parseCategories(wt)){
      if(!cats.some(x => x.category === c.category)) cats.push(c);
    }
  }
  if(!cats.length) throw new Error('section found but no categories parsed on "' + page + '"');
  return { page, asOf: await lastEdited(page), categories: cats };
}

/* ------------------------------ CLI ------------------------------ */
(async () => {
  const args = process.argv.slice(2);
  const page = args[0];
  if(!page){
    console.error('usage: node host/resolve.js <wiki-page> [--all | --category "X" | --check "X=Y" ...]');
    process.exit(2);
  }
  let data;
  try{ data = await resolve(page); }
  catch(e){ console.error('RESOLVE FAILED: '+(e && (e.stack||e.message||e))); process.exit(1); }

  /* HEADERS GO TO STDERR so stdout stays machine-readable. --category
     is meant to be piped into a question bank; a human banner in front
     of the JSON makes it unparseable. */
  console.error('source   : en.wikipedia.org/wiki/'+page);
  console.error('as of    : '+(data.asOf||'unknown')+'   (last edit)');
  console.error('categories found: '+data.categories.length+'\n');

  const checks = args.filter(a => a.startsWith('--check=') || false);
  const ci = args.indexOf('--check');
  const pairs = ci >= 0 ? args.slice(ci+1).filter(a => a.includes('=')) : [];

  if(pairs.length){
    let bad = 0;
    for(const pr of pairs){
      const i = pr.indexOf('=');
      const cat = pr.slice(0,i).trim(), exp = pr.slice(i+1).trim();
      const hit = data.categories.find(c => c.category.toLowerCase() === cat.toLowerCase());
      if(!hit){ console.log('MISSING   '+cat); bad++; continue; }
      if(!hit.decided){
        console.log('NOT DECIDED '+cat+' - the source shows no winner yet ['
          +hit.nominees.length+' nominees]. A host call cannot be audited against nothing.');
        bad++; continue;
      }
      const okc = hit.winner.toLowerCase() === exp.toLowerCase();
      if(!okc) bad++;
      console.log((okc?'AGREES    ':'DISAGREES ')+cat+' → source says "'+hit.winner+'"'
        +(okc?'':'  · host said "'+exp+'"')+'   ['+hit.nominees.length+' nominees]');
    }
    process.exit(bad?1:0);
  }

  const ai = args.indexOf('--category');
  if(ai >= 0 && args[ai+1]){
    const cat = args[ai+1];
    const hit = data.categories.find(c => c.category.toLowerCase() === cat.toLowerCase());
    if(!hit){ console.error('no such category: '+cat); process.exit(1); }
    console.log(JSON.stringify(hit, null, 2));
    return;
  }
  for(const c of data.categories){
    console.log(('· '+c.category).padEnd(52)+' → '
      +(c.decided ? c.winner : 'NOT DECIDED YET')+'   ('+c.nominees.length+' nominees)');
  }
})();
