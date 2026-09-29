#!/usr/bin/env node
/**
 * CDX-only coverage check for nashville-safety corpus.
 * Queries the Wayback CDX API for each URL in archive-urls.txt.
 * Writes cdx-coverage.json — informational provenance only.
 *
 * The authoritative anchors are ledger byte spans into local ground files.
 * This script just records which sources are independently verifiable on Wayback.
 */

import { readFileSync, writeFileSync } from 'fs';

const URLS_FILE = new URL('./archive-urls.txt', import.meta.url).pathname;
const OUT_FILE  = new URL('./cdx-coverage.json', import.meta.url).pathname;

const CDX = 'https://web.archive.org/cdx/search/cdx';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdxLookup(url) {
  const params = new URLSearchParams({
    url,
    output: 'json',
    limit: '1',
    fl: 'timestamp,original,statuscode,length',
    filter: 'statuscode:200',
  });
  const res = await fetch(`${CDX}?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CDX HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows || rows.length < 2) return null;  // first row is field names when content exists
  const [ts, orig, sc, len] = rows[1];
  return {
    timestamp: ts,
    wayback_url: `https://web.archive.org/web/${ts}/${orig}`,
    statuscode: sc,
    length: len,
  };
}

const urls = readFileSync(URLS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
const coverage = {};
let okCount = 0;

console.log(`── CDX coverage check: ${urls.length} URLs ──`);
for (const url of urls) {
  try {
    const hit = await cdxLookup(url);
    if (hit) {
      coverage[url] = { status: 'archived', ...hit };
      okCount++;
      console.log(`  ✓  ${hit.timestamp}  ${url.slice(0, 72)}`);
    } else {
      coverage[url] = { status: 'not-archived' };
      console.log(`  ✗  no-snapshot  ${url.slice(0, 72)}`);
    }
  } catch (e) {
    coverage[url] = { status: 'error', error: e.message };
    console.log(`  !  error  ${url.slice(0, 72)}: ${e.message}`);
  }
  await sleep(300);  // polite pacing
}

writeFileSync(OUT_FILE, JSON.stringify(coverage, null, 2));
console.log(`\n✓ ${okCount}/${urls.length} URLs have Wayback snapshots → cdx-coverage.json`);
console.log('Anchors: see ledger/nashville-safety.jsonl (byte spans into local ground files)');
