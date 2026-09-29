#!/usr/bin/env node
/**
 * build-anchors.mjs
 *
 * For every source URL in archive-urls.txt:
 *   1. Check CDX for the closest existing Wayback snapshot.
 *   2. If none, submit Save Page Now (SPN) and wait for the job.
 *   3. Download the archived bytes (raw "if_" URL).
 *   4. For every verbatim string in VERBATIM_QUOTES, find its byte offset.
 *   5. Write spn-results.json and anchors.json.
 *
 * Anchors are NOT reproductions — they are pointers INTO the archived bits:
 *   { archive_url, byte_start, byte_end, text_fragment_url }
 *
 * Run:  node plans/nashville-safety/build-anchors.mjs
 * Re-run is safe: already-archived URLs skip SPN; already-found anchors skip download.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const SPN_API = 'https://web.archive.org/save';

// Every verbatim string we need anchored to specific bytes.
// id must be stable — it becomes the key in anchors.json.
const VERBATIM_QUOTES = [
  // WPLN pedestrian 2022
  { id: 'wpln-2022-all-time-high',
    verbatim: 'In 2022, Nashville saw an all-time high for pedestrian fatalities with 49',
    source_url: 'https://wpln.org/post/nashville-saw-a-record-number-of-pedestrian-deaths-in-2022-advocates-say-the-city-needs-to-treat-it-as-a-crisis/' },
  // Walk Bike Nashville
  { id: 'wbn-2010-14-killed',
    verbatim: 'Just ten years ago in 2010 there were 14 people killed while walking',
    source_url: 'https://www.walkbikenashville.org/' },
  { id: 'wbn-80pct-arterials',
    verbatim: '80% of all pedestrians killed in Nashville are killed on state-controlled arterial streets',
    source_url: 'https://www.walkbikenashville.org/' },
  // WKRN enforcement drop
  { id: 'wkrn-95pct-decrease',
    verbatim: 'nearly a 95% decrease from the 2012 peak of 445,143',
    source_url: 'https://www.wkrn.com/news/local-news/nashville/nashville-traffic-stops-have-drastically-decreased-since-2012-peak/' },
  { id: 'wkrn-2022-nadir',
    verbatim: 'By 2022, stops had dropped to 25,679',
    source_url: 'https://www.wkrn.com/news/local-news/nashville/nashville-traffic-stops-have-drastically-decreased-since-2012-peak/' },
  // Nashville Banner Nov 18 2024
  { id: 'banner-75pct-fatalities',
    verbatim: 'Between 2018 and 2023, traffic fatalities increased by 75 percent as enforcement fell',
    source_url: 'https://nashvillebanner.com/2024/11/18/nashville-police-mostly-stopped-pulling-cars-over-but-some-councilmembers-want-to-reverse-the-trend/' },
  { id: 'banner-91pct-decline',
    verbatim: 'traffic stops declined 91%',
    source_url: 'https://nashvillebanner.com/2024/11/18/nashville-police-mostly-stopped-pulling-cars-over-but-some-councilmembers-want-to-reverse-the-trend/' },
  { id: 'banner-don-aaron',
    verbatim: 'A Policing Project study concluded that large numbers of stops in high-crime neighborhoods were not impacting crime',
    source_url: 'https://nashvillebanner.com/2024/11/18/nashville-police-mostly-stopped-pulling-cars-over-but-some-councilmembers-want-to-reverse-the-trend/' },
  // Policing Project PDF 2018
  { id: 'policing-project-44pct-disparity',
    verbatim: 'Per-capita stop rate for Black drivers was 44% higher than for white drivers',
    source_url: 'https://static1.squarespace.com/static/58a33e881b631bc60d4f8b31/t/5bf2d18d562fa747a554f6b0/1542640014294/Policing+Project+Nashville+Report.pdf' },
  { id: 'policing-project-88pct-no-contraband',
    verbatim: 'Consent searches yielded no incriminating evidence 88.4% of the time',
    source_url: 'https://static1.squarespace.com/static/58a33e881b631bc60d4f8b31/t/5bf2d18d562fa747a554f6b0/1542640014294/Policing+Project+Nashville+Report.pdf' },
  // WPLN training rewrite
  { id: 'wpln-training-rewrite',
    verbatim: 'completely rewrote its training, with the focus shifting to stopping unsafe driving, not searches',
    source_url: 'https://wpln.org/post/nashville-police-report-major-drop-in-traffic-stops-following-accusations-of-racial-bias/' },
  // Nashville Scene DWB response
  { id: 'anderson-morally-disingenuous',
    verbatim: 'morally disingenuous',
    source_url: 'https://www.nashvillescene.com/news/pithinthewind/gideons-army-responds-to-police-chiefs-criticism-of-driving-while-black-report/article_90ba105c-e219-5a7c-b870-bf3196016e92.html' },
  // Nashville Scene council resolution
  { id: 'toombs-mass-traffic-enforcement',
    verbatim: 'concerned about returning to a police strategy of mass traffic enforcement',
    source_url: 'https://www.nashvillescene.com/news/pithinthewind/metro-council-traffic-stops-eslick/article_99ea37c8-d915-11ef-8f8c-1b74c1e0a1a9.html' },
  // UCR PDF
  { id: 'ucr-source-note',
    verbatim: 'UCR Part I Offenses are derived from Metropolitan Police Department',
    source_url: 'https://www.nashville.gov/sites/default/files/2025-07/UCR1963-2023ByPopulation.pdf?ct=1752592589' },
  // TDOT VRU 2023
  { id: 'tdot-44pct-increase',
    verbatim: 'fatal and serious injury pedestrian and cyclist crashes increased by over 44%',
    source_url: 'https://www.tn.gov/content/dam/tn/tdot/strategic/TDOT%202023%20VRU%20Safety%20Assessment%20Final%20w%20Appendix%2011-15-2023.pdf' },
  // Doucette 2022
  { id: 'doucette-129pct-ois',
    verbatim: 'Permitless CCW adopting states saw a 12.9% increase in officer-involved shooting victimization rate',
    source_url: 'https://link.springer.com/article/10.1007/s11524-022-00627-5' },
  // Barbos 2025
  { id: 'barbos-larger-effect-after-2020',
    verbatim: 'much larger effect after 2020',
    source_url: 'https://doi.org/10.1016/j.econlet.2025.112284' },
  // Stanojevic 2013 halo
  { id: 'stanojevic-halo-1hr-8wk',
    verbatim: 'halo effect of police presence on driving speeds may last as little as 1 hour or as long as 8 weeks',
    source_url: 'https://doi.org/10.1016/j.aap.2012.12.019' },
  // MNPD Annual Reports landing page
  { id: 'mnpd-reports-landing',
    verbatim: 'Annual Report',
    source_url: 'https://www.nashville.gov/departments/police/news-and-reports/reports' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

const UA = 'nashville-safety-anchor-builder/1.0 (contact: public-interest research)';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function fetchBytes(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** CDX: find closest 200 snapshot. Returns { timestamp, wayback_url } or null. */
async function cdxLookup(url) {
  try {
    const p = new URLSearchParams({
      url, output: 'json', limit: '1',
      fl: 'timestamp,original,statuscode,length',
      filter: 'statuscode:200',
      collapse: 'timestamp:8',
    });
    const rows = await fetchJson(`${CDX_API}?${p}`);
    if (!rows || rows.length < 2) return null;
    const [ts,, , len] = rows[1];
    return {
      timestamp: ts,
      content_length: parseInt(len) || null,
      wayback_url: `https://web.archive.org/web/${ts}/${url}`,
    };
  } catch { return null; }
}

/** SPN: submit and poll until done. Returns { timestamp, wayback_url }. */
async function submitSpn(url) {
  const form = new FormData();
  form.append('url', url);
  form.append('capture_all', '1');
  const r = await fetch(SPN_API, { method: 'POST', body: form, headers: { 'User-Agent': UA }, redirect: 'manual' });

  // SPN may immediately redirect to the wayback URL
  const loc = r.headers.get('location') || '';
  if (loc.includes('web.archive.org/web/')) {
    const ts = loc.match(/\/web\/(\d{14})\//)?.[1];
    return { timestamp: ts, wayback_url: loc, via: 'spn-redirect' };
  }

  // Or return JSON with job_id
  let body;
  try { body = await r.json(); } catch { /* not JSON */ }
  if (body?.job_id) {
    for (let i = 0; i < 36; i++) {           // up to 6 minutes
      await sleep(10_000);
      const st = await fetchJson(`${SPN_API}/status/${body.job_id}`);
      if (st.status === 'success') {
        const ts = st.timestamp;
        return { timestamp: ts, wayback_url: `https://web.archive.org/web/${ts}/${url}`, via: 'spn-async' };
      }
      if (st.status === 'error') throw new Error(`SPN error: ${st.message}`);
    }
    throw new Error('SPN timed out after 6 min');
  }

  throw new Error(`SPN unexpected: status=${r.status} loc=${loc}`);
}

/**
 * Find byte offsets of verbatim text inside archived content.
 * For HTML: strips tags first. Returns { byte_start, byte_end, matched }.
 */
function findInBytes(buf, verbatim) {
  const raw = buf.toString('utf8');

  // Try exact match in raw bytes first (good for PDFs, pre-extracted text)
  let idx = raw.indexOf(verbatim);
  if (idx !== -1) {
    const b = Buffer.from(raw.slice(0, idx), 'utf8').length;
    return { byte_start: b, byte_end: b + Buffer.byteLength(verbatim, 'utf8'), matched: 'exact-raw' };
  }

  // Strip HTML tags and normalise whitespace
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  idx = stripped.indexOf(verbatim);
  if (idx !== -1) {
    const b = Buffer.from(stripped.slice(0, idx), 'utf8').length;
    return { byte_start: b, byte_end: b + Buffer.byteLength(verbatim, 'utf8'), matched: 'exact-stripped' };
  }

  // Partial: first 60 chars
  const partial = verbatim.slice(0, 60);
  idx = stripped.indexOf(partial);
  if (idx !== -1) {
    const b = Buffer.from(stripped.slice(0, idx), 'utf8').length;
    return { byte_start: b, byte_end: b + Buffer.byteLength(partial, 'utf8'), matched: 'partial', matched_text: partial };
  }

  return null;
}

/** Build a Wayback text-fragment URL (Chrome/Edge/Arc support #:~:text=). */
function textFragment(wayback_url, verbatim) {
  return `${wayback_url}#:~:text=${encodeURIComponent(verbatim.slice(0, 100))}`;
}

/** Build the "raw bytes" Wayback URL using the `if_` modifier. */
function rawBytesUrl(wayback_url) {
  return wayback_url.replace(/web\.archive\.org\/web\/(\d+)\//, 'web.archive.org/web/$1if_/');
}

// ── main ─────────────────────────────────────────────────────────────────────

const SPNFile    = join(__dir, 'spn-results.json');
const AnchorFile = join(__dir, 'anchors.json');
const URLFile    = join(__dir, 'archive-urls.txt');

const spn     = existsSync(SPNFile)    ? JSON.parse(readFileSync(SPNFile,    'utf8')) : {};
const anchors = existsSync(AnchorFile) ? JSON.parse(readFileSync(AnchorFile, 'utf8')) : {};
const urls    = readFileSync(URLFile,  'utf8').split('\n').map(s => s.trim()).filter(Boolean);

// ── Phase 1: archive every URL ───────────────────────────────────────────────
console.log(`\n── Phase 1: archive ${urls.length} URLs ──`);
for (const url of urls) {
  if (spn[url]?.timestamp) { console.log(`  HAVE  ${spn[url].timestamp}  ${url}`); continue; }

  process.stdout.write(`  CDX   ${url} … `);
  const existing = await cdxLookup(url);
  if (existing) {
    spn[url] = { ...existing, via: 'cdx' };
    console.log(`${existing.timestamp}`);
  } else {
    process.stdout.write(`none, SPN … `);
    try {
      const r = await submitSpn(url);
      spn[url] = r;
      console.log(`${r.timestamp} (${r.via})`);
    } catch (e) {
      spn[url] = { error: e.message, via: 'spn-failed' };
      console.log(`FAILED: ${e.message}`);
    }
  }
  writeFileSync(SPNFile, JSON.stringify(spn, null, 2));
  await sleep(2500);   // polite gap between archive.org requests
}

// ── Phase 2: locate each verbatim quote in archived bytes ────────────────────
console.log(`\n── Phase 2: locate ${VERBATIM_QUOTES.length} verbatim quotes ──`);
const byteCache = {};   // rawBytesUrl → Buffer

for (const q of VERBATIM_QUOTES) {
  if (anchors[q.id]?.byte_start != null) {
    console.log(`  HAVE  ${q.id}`);
    continue;
  }

  const snap = spn[q.source_url];
  if (!snap?.wayback_url) {
    console.log(`  SKIP  ${q.id} — source not archived`);
    anchors[q.id] = { ...q, error: 'source not archived' };
    continue;
  }

  const raw = rawBytesUrl(snap.wayback_url);
  process.stdout.write(`  FIND  ${q.id} … `);

  try {
    if (!byteCache[raw]) byteCache[raw] = await fetchBytes(raw);
    const pos = findInBytes(byteCache[raw], q.verbatim);

    anchors[q.id] = pos
      ? {
          id: q.id,
          verbatim: q.verbatim,
          source_url: q.source_url,
          archive_url: snap.wayback_url,
          archive_timestamp: snap.timestamp,
          raw_bytes_url: raw,
          ...pos,
          text_fragment_url: textFragment(snap.wayback_url, q.verbatim),
        }
      : {
          id: q.id,
          verbatim: q.verbatim,
          source_url: q.source_url,
          archive_url: snap.wayback_url,
          archive_timestamp: snap.timestamp,
          raw_bytes_url: raw,
          text_fragment_url: textFragment(snap.wayback_url, q.verbatim),
          error: 'verbatim not found in archived bytes',
        };

    console.log(pos
      ? `bytes ${pos.byte_start}–${pos.byte_end} (${pos.matched})`
      : `NOT FOUND — text_fragment_url recorded`);
  } catch (e) {
    anchors[q.id] = { id: q.id, verbatim: q.verbatim, source_url: q.source_url,
                      archive_url: snap.wayback_url, error: e.message };
    console.log(`ERROR: ${e.message}`);
  }

  writeFileSync(AnchorFile, JSON.stringify(anchors, null, 2));
  await sleep(1000);
}

writeFileSync(SPNFile,    JSON.stringify(spn,     null, 2));
writeFileSync(AnchorFile, JSON.stringify(anchors, null, 2));

const found   = Object.values(anchors).filter(a => a.byte_start != null).length;
const fragOnly = Object.values(anchors).filter(a => !a.byte_start && a.text_fragment_url && !a.error?.includes('not archived')).length;
const failed  = Object.values(anchors).filter(a => a.error).length;

console.log(`
── done ──
  ${Object.keys(spn).length} URLs archived   (spn-results.json)
  ${found} quotes anchored to byte offsets   (anchors.json)
  ${fragOnly} quotes — text-fragment URL only (no byte offset)
  ${failed} failures — see anchors.json for detail
`);
