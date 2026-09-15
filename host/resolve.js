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

/* Walk the winners wikitext and pull {category, winner, nominees}. */
function parseCategories(wt){
  const out = [];
  let cur = null;
  for(const raw of wt.split('\n')){
    const line = raw.trim();

    const cat = line.match(/\{\{\s*Award category[^|]*\|[^|]*\|\s*(.+?)\}\}/i);
    if(cat){
      if(cur) out.push(cur);
      cur = { category: clean(cat[1]), winner: null, nominees: [] };
      continue;
    }
    if(!cur) continue;

    if(/^\*\*\s*\S/.test(line)){                 // two stars: a nominee
      const n = token(line.replace(/^\*\*\s*/, ''));
      if(n) cur.nominees.push(n);
    } else if(/^\*\s*\S/.test(line)){            // one star: the winner
      const w = token(line.replace(/^\*\s*/, ''));
      const full = clean(line.replace(/^\*\s*/, ''));
      if(w && !cur.winner){ cur.winner = w; cur.winnerFull = full; }
    }
  }
  if(cur) out.push(cur);
  /* the winner belongs in the option list — it is the answer */
  for(const c of out) if(c.winner && !c.nominees.includes(c.winner)) c.nominees.unshift(c.winner);
  return out.filter(c => c.winner);
}

async function resolve(page){
  const secs = await sections(page);
  const top = secs.find(s => /^winners and nominees$/i.test(s.line));
  const want = secs.filter(s =>
    (top && s.number && String(s.number).startsWith(String(top.number)+'.')) ||
    /^(programs|acting|lead|supporting|directing|writing|main|awards)$/i.test(s.line));
  const seen = new Set(); const cats = [];
  for(const s of want){
    if(seen.has(s.index)) continue; seen.add(s.index);
    let wt; try{ wt = await wikitext(page, s.index); }catch(e){ continue; }
    for(const c of parseCategories(wt)){
      if(!cats.some(x => x.category === c.category)) cats.push(c);
    }
  }
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
  catch(e){ console.error('RESOLVE FAILED: '+e.message); process.exit(1); }

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
  for(const c of data.categories) console.log(('· '+c.category).padEnd(52)+' → '+c.winner+'   ('+c.nominees.length+' nominees)');
})();
