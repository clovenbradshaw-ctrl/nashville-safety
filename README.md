# nashville-safety

Source material for looking at Nashville road safety, 2008–2026: traffic fatalities and pedestrian deaths, the fall in police traffic stops, the reasons officials have given for it, and the research literature on enforcement and driver behaviour.

This repository holds source text, quotes with their exact positions in that text, and provenance for each source. It contains no analysis and draws no conclusions.

## What is in it

| Path | What it is |
|---|---|
| `ground/` | 9 text files. Each is a verbatim transcription of extracts from one or more sources. Beside each is a `.provenance.json` sidecar. |
| `ledger/nashville-safety.jsonl` | 20 quotes. Each row gives the exact byte range where the quote sits in its ground file. |
| `ledger/summary.json` | Number of ledger rows per ground file. |
| `data/nashfatalcrash.csv` | 1,022 fatal-crash rows from https://www.nashfatalcrash.com/table/fatal, retrieved 2026-09-29. |
| `data/sources.json` | Index of 17 sources with verbatim citations. See the caveat under Limits. |
| `manifest.json` | The 9 ground documents with category, publisher and URL. |
| `nashville-safety.surfacedef.json` | 7 search lenses (named lists of query terms): enforcement-collapse, pedestrian-deaths, infrastructure, de-policing-literature, crime-baseline, official-statements, gun-autonomy. |
| `archive-urls.txt` | The 35 source URLs, one per line. |
| `cdx-check.mjs`, `cdx-coverage.json` | The script and its result: which of the 35 URLs already have an Internet Archive snapshot. |
| `build-anchors.mjs` | An earlier script. For each URL it looks up a Wayback snapshot, submits Save Page Now if there is none, downloads the archived bytes and searches them for the quotes. Not needed to use the ledger. |

## The nine ground documents

| File | Bytes | What it is |
|---|---:|---|
| `mnpd-annual-reports.txt` | 3,834 | Traffic-fatality sections of the MNPD annual reports, 2008–2017 (official data) |
| `wpln-pedestrian-2022.txt` | 956 | WPLN News: record pedestrian deaths in 2022 (journalism) |
| `walk-bike-nashville.txt` | 1,432 | Walk Bike Nashville: pedestrian fatalities and infrastructure analysis (advocacy data) |
| `nashville-banner-enforcement.txt` | 974 | Nashville Banner / WKRN: traffic enforcement collapse investigation, 2024-11-18 (journalism) |
| `stanojevic-2013.txt` | 6,135 | Influence of traffic enforcement on the attitudes and behavior of drivers, Accident Analysis & Prevention, 2013 (peer-reviewed) |
| `enforcement-lag-research.txt` | 5,083 | Enforcement lag, de-policing and crash outcomes. Contains: barbos-2025, fliss-2020, nhtsa-2024, ghsa-2023, safetrec, aaa-2018, aaa-2026 |
| `nashville-competing-explanations.txt` | 5,812 | Competing explanations for pedestrian deaths. Contains: tdot-vru-2023, wbn-impossible-crossings, metro-sidewalk-audit-2024, wkrn-expert-road-design |
| `gun-autonomy-enforcement-research.txt` | 6,112 | Gun rights, driver autonomy and de-policing. Contains: doucette-2022, tn-hb0786, shjarback-2017, boehme-2024, nix-2024 |
| `mnpd-stated-reasons.txt` | 6,871 | MNPD and city officials on why traffic stops fell. Contains: anderson-2016, policing-project-2018, training-rewrite-2018, don-aaron-2024, council-resolution-2024-873 |

Every sidecar has `title`, `retrieved`, `extraction`, `txt_sha256` and `chars`. Other fields (`url`, `publisher`, `published`, `doi`, `authors`, `key_quote`, `note`) appear where they apply. All 9 were retrieved 2026-09-29.

## How a quote is anchored

Each ledger row points into a ground file:

```json
{"schema":"PlanLedgerObservation@1","id":"surface:nashville-safety/ground/wpln-pedestrian-2022.txt:row:0001","doc":"nashville-safety/ground/wpln-pedestrian-2022.txt","at":[203,276],"verbatim":"In 2022, Nashville saw an all-time high for pedestrian fatalities with 49","kind":"number","fields":{"year":2022,"value":49,"metric":"pedestrian_fatalities","qualifier":"all-time high at time of publication"},"basis":"verbatim byte-span in ground file; anchor pending build-anchors.mjs run","supersedes":null,"giver":null}
```

`at` is `[start, end)`: zero-based UTF-8 byte offsets into the file named by `doc`, with `end` excluded. The bytes at `at` equal `verbatim`. `cdx-check.mjs` states that these byte spans are the authoritative anchors. The `basis` text in each row ("anchor pending build-anchors.mjs run") is older wording that predates that.

The 20 rows cover all 9 ground files. By `kind`: 9 number, 7 finding, 2 official-statement, 1 policy-change, 1 legal-fact.

## Checking it yourself

Run from the repository root with Node 18 or later. It checks each ground file against the SHA-256 in its sidecar, and each ledger span against its quote.

```sh
node -e '
const fs = require("fs"), c = require("crypto");
let h = 0, s = 0;
for (const f of fs.readdirSync("ground").filter(f => f.endsWith(".txt"))) {
  const b = fs.readFileSync("ground/" + f), p = JSON.parse(fs.readFileSync("ground/" + f + ".provenance.json"));
  if (c.createHash("sha256").update(b).digest("hex") === p.txt_sha256) h++; else console.log("hash differs:", f);
}
const rows = fs.readFileSync("ledger/nashville-safety.jsonl", "utf8").trim().split("\n").map(JSON.parse);
for (const r of rows) {
  const b = fs.readFileSync(r.doc.replace("nashville-safety/", ""));
  if (b.subarray(r.at[0], r.at[1]).toString("utf8") === r.verbatim) s++; else console.log("span differs:", r.id);
}
console.log("hashes matching:", h, "of 9 | spans matching:", s, "of", rows.length);
'
```

Expected output: `hashes matching: 9 of 9 | spans matching: 20 of 20`.

## Internet Archive coverage

`cdx-coverage.json` records, for each of the 35 URLs in `archive-urls.txt`, whether the Wayback Machine has a snapshot: 17 archived, 6 not archived, 12 lookup errors (timeouts). It is informational only. `node cdx-check.mjs` repeats the lookups over the network and overwrites the file.

## Limits

- The ground files are manual transcriptions of extracts. They are not full texts and not copies of the pages. Each sidecar's `extraction` field says how it was made. For paywalled papers the ground file holds key passages only, and the sidecar says the DOI landing page was archived.
- The 20 ledger rows are a selection. Every ground file has at least one row; not every fact in a ground file has one.
- `mnpd-annual-reports.txt` notes that no 2012 annual report PDF is listed at the MNPD reports page.
- `data/sources.json` contains fields (`er7_snip`, `snip_path`, `source_text_file`, `reason_specs`, `full_report`) that point to files on the author's computer. Those files are not in this repository. The other fields are unaffected.
- Sources were retrieved on 2026-09-29. The live pages may have changed since.
- Quoted material belongs to its original publishers. This repository has no license file.
