# झाडांचा नकाशा · Zaadancha Naksha

**Pune's 2019 tree census — 4.09 million trees — made explorable.**

A free, static, single-page site. No backend, no API keys, no cookies, no
analytics, no accounts. Marathi first, English alongside.

| | |
|---|---|
| **Data** | [Pune Tree Census 2019](https://data.opencity.in/dataset/pune-tree-census-2019), Pune Municipal Corporation, published by OpenCity |
| **Fieldwork** | August 2019 |
| **Hosting** | Vercel static |
| **Stack** | Vanilla JS + Leaflet (vendored), Python 3 stdlib for the pipeline |

---

## Read this before you trust a number

1. **The census is a frozen August 2019 snapshot.** Trees planted or cut since
   then are not in it. The site says so in a banner that cannot be dismissed.
2. **This is not an official PMC service.**
3. **Nativity is not census data.** None of the census columns this project
   reads carries a native/non-native flag, and the full published header is
   recorded in `meta.json` under `source.header_seen` on every build, so you can
   check that for yourself rather than take this file's word for it.
   The native % on this site comes from
   [`scripts/native_species.json`](scripts/native_species.json), a curated
   botanical-origin list kept in this repo in the open. Species not on that list
   are reported as **unknown** and are never bucketed by guesswork. Corrections
   are welcome as a pull request against that one file.
4. **Grid cells are approximately 500 m, not exact squares.** 0.0045° is ~500 m
   of latitude and ~475 m of longitude at Pune's latitude.
5. **`public/data/meta.json` holds every caveat, every count, and a schema
   report** listing the published header plus the distinct `condition`,
   `ownership` and `flowering` values actually found — so the mappings this repo
   makes can be audited, not trusted on faith.
6. **The pipeline has never yet met the real CSVs.** It was developed and tested
   against a synthetic fixture with the twelve documented column names. The
   first run of the *Build census data* workflow is the real test; it will
   either succeed or fail loudly printing the actual header it found. It will
   not quietly produce a half-right map.

## What the site does

1. **Grid map** of all 4.09M trees as ~500 m density cells, tiles loaded lazily
   as you pan. Tap a cell for its count and top species, with Marathi names.
2. **फुलांचा महिना (Phulancha mahina)** — pick a month, see which species are
   recorded as flowering then.
3. **Rare trees** (gold) and **the 500 largest by girth** (blue) as tappable
   layers with full per-tree detail. This is the treasure-hunt hook.
4. **Ward leaderboard** — by tree count and by native %.
5. **Shareable fact cards** — five stats generated from the data at page load,
   never hand-written, so they cannot drift from the numbers.

## The pipeline

Runs in GitHub Actions, not in your browser and not at request time.

```
scripts/fetch_data.py     # enumerates the dataset via the OpenCity CKAN API,
                          # downloads all 17 CSV parts (~1.2 GB)
scripts/aggregate.py      # one streaming pass over 4.09M rows -> static JSON
scripts/native_species.json  # the curated nativity reference (see caveat 3)
scripts/make_fixture.py   # synthetic CSVs for CI. Never ships.
```

**Failure is loud by design.** The pipeline exits non-zero and the build fails,
rather than publishing something plausible, when:

- the CKAN API is unreachable or reports failure
- the dataset no longer has exactly 17 CSV parts
- any part 404s, returns HTML, or downloads short
- a required column is missing (it prints the actual header it found)
- fewer than 17 parts are present locally
- more than 5% of rows have an unparseable `geom`
- zero rows or zero mappable points are produced
- the gzipped payload exceeds the 5 MB budget

There is no stub data path, no sample fallback, and no "best effort" mode.

### Outputs (`public/data/`)

| File | What's in it |
|---|---|
| `meta.json` | build metadata, totals, caveats, schema report, payload sizes |
| `ward_summary.json` | per ward: count, top 5 species, native %, healthy % |
| `species_index.json` | every species: botanical / common / Marathi name, citywide count, flowering months, economic use |
| `species_names.json` | compact species-key → names lookup for map popups |
| `rare_trees.geojson` | every tree flagged `is_rare`, full detail |
| `giants.geojson` | the 500 largest by `girth_cm`, full detail |
| `tiles/index.json` | grid manifest: cell size, tile list, max cell count |
| `tiles/<ti>_<tj>.json` | ~500 m cells with count + top 3 species, loaded lazily |

Total gzipped payload is checked against a **5 MB budget** on every build.

## Running it yourself

```bash
# Fast path: synthetic fixture with the real 28-column schema, no big download
python3 scripts/make_fixture.py --out /tmp/fixture
python3 scripts/aggregate.py --raw /tmp/fixture --out public/data
python3 -m http.server 8000 --directory public

# Real path (~1.2 GB download, several minutes)
python3 scripts/fetch_data.py --out raw
python3 scripts/aggregate.py --raw raw --out public/data
```

## Deploying

1. Push this repo to GitHub.
2. Import it in Vercel as project **pune-tree-map**. Framework preset **Other**,
   output directory **`public`**, no build command. `vercel.json` sets the rest.
3. In GitHub → Actions → **Build census data** → *Run workflow*. It downloads the
   census, aggregates it, commits `public/data`, and that commit triggers Vercel.

The first deploy will show the honest empty state until the data workflow has
run once — by design, rather than shipping placeholder trees.

If you'd rather deploy with a token than with Vercel's Git integration, set the
`VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets and the workflow's
last step takes over.

## Privacy

No cookies. No `localStorage`. No analytics. No fonts, scripts or XHR to any
third party — Leaflet is vendored into `public/vendor/`. The only external
requests the page makes are basemap image tiles from CARTO; a Content-Security-
Policy in `vercel.json` blocks everything else.

## Credits

- **Data** — Pune Municipal Corporation Tree Census 2019, via
  [OpenCity](https://data.opencity.in/dataset/pune-tree-census-2019)
- **Basemap** — © OpenStreetMap contributors, © CARTO
- **Map library** — [Leaflet](https://leafletjs.com/) (BSD-2-Clause)
- **Built by** — Sovereign by Source

## Licence

Code in this repository: MIT (see `LICENSE`). The census data belongs to the
Pune Municipal Corporation and is redistributed here under the terms OpenCity
publishes it with; the aggregation is derived work and the source is credited
on every page.
