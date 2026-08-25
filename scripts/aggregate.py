#!/usr/bin/env python3
"""
Aggregate the Pune Tree Census 2019 CSV parts into small static JSON for the
Zaadancha Naksha site.

Outputs (into --out, default public/data):
  meta.json            build metadata + honest caveats + schema report
  ward_summary.json    per ward: count, top 5 species, native %, healthy %
  species_index.json   every species: names, count, flowering months, uses
  rare_trees.geojson   only rows with is_rare true, full detail
  giants.geojson       the 500 largest trees by girth_cm, full detail
  tiles/index.json     grid manifest
  tiles/<ti>_<tj>.json ~500 m grid cells: count + top species, lazily loaded

Rules:
  * Single streaming pass. Never loads 4M rows into memory.
  * Fails loudly on a missing required column or an unparseable file.
  * Never invents a value. Anything it cannot determine is reported as null or
    "unknown" and counted in meta.json so the gap is visible on the site.
"""

from __future__ import annotations

import argparse
import binascii
import csv
import gzip
import heapq
import json
import math
import os
import re
import struct
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(1 << 24)

# --------------------------------------------------------------------------
# Grid geometry
# --------------------------------------------------------------------------
# 0.0045 deg latitude is ~500 m. At Pune's latitude (~18.52 N) 0.0045 deg of
# longitude is ~475 m. Close enough for a visual density grid; documented so
# nobody mistakes these for exact 500 m squares.
CELL_DEG = 0.0045
CELLS_PER_TILE = 10
TILE_DEG = CELL_DEG * CELLS_PER_TILE

# Generous sanity box around Pune city + PMC fringe. Points outside are counted
# and reported, not silently dropped.
LON_MIN, LON_MAX = 73.40, 74.30
LAT_MIN, LAT_MAX = 18.20, 18.90

GIANTS_N = 500
RARE_MAX = 12000            # cap for payload; overflow is reported, not hidden
TOP_SPECIES_PER_CELL = 3
TOP_SPECIES_PER_WARD = 5
CELL_SPECIES_PRUNE_AT = 60
CELL_SPECIES_KEEP = 30

HEALTHY_VALUES = {"good", "healthy", "very good", "excellent", "fine"}

REQUIRED = [
    "geom", "girth_cm", "height_m", "condition", "ownership",
    "ward", "botanical_name", "common_name", "local_name",
    "economic_i", "flowering", "is_rare",
]
OPTIONAL = ["ward_name", "canopy_dia_m", "phenology", "id", "sr_no", "road_name"]

TRUE_TOKENS = {"true", "t", "yes", "y", "1", "rare", "होय"}


class AggregateError(RuntimeError):
    pass


# --------------------------------------------------------------------------
# Parsers
# --------------------------------------------------------------------------
_WKT = re.compile(r"POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)", re.I)


def parse_geom(raw: str):
    """Return (lon, lat) or None. Handles WKT POINT and (E)WKB hex."""
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None

    m = _WKT.search(s)
    if m:
        return float(m.group(1)), float(m.group(2))

    # EWKB / WKB hex, e.g. 0101000020E6100000....
    if len(s) >= 42 and all(c in "0123456789abcdefABCDEF" for c in s):
        try:
            blob = binascii.unhexlify(s)
            endian = "<" if blob[0] == 1 else ">"
            gtype = struct.unpack(endian + "I", blob[1:5])[0]
            offset = 5
            if gtype & 0x20000000:      # SRID flag
                offset += 4
            if (gtype & 0xFF) != 1:     # not a POINT
                return None
            x, y = struct.unpack(endian + "dd", blob[offset:offset + 16])
            return x, y
        except Exception:
            return None
    return None


def fnum(raw):
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("na", "n/a", "null", "none", "-"):
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def truthy(raw) -> bool:
    return str(raw or "").strip().lower() in TRUE_TOKENS


MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
ALL_YEAR = {
    "throughout the year", "all year", "year round", "year-round",
    "throughout year", "all the year", "round the year", "perennial",
}
_TOKEN = re.compile(r"[a-z]+|\d{1,2}")


def parse_flowering_months(raw) -> tuple[list[int], bool]:
    """
    Return (months, parsed_ok). Months are 1-12.

    The census 'flowering' column is free text and its exact vocabulary is not
    documented upstream, so this parser handles the common shapes and REPORTS
    whatever it could not read (see meta.json -> schema_report.flowering).
    It never guesses a month.
    """
    if raw is None:
        return [], False
    s = str(raw).strip().lower()
    if not s or s in ("na", "n/a", "-", "null", "none", "nil"):
        return [], False
    if any(p in s for p in ALL_YEAR):
        return list(range(1, 13)), True

    out: set[int] = set()
    ok = False
    # split on separators that mean "and", keep '-' and "to" as range markers
    for chunk in re.split(r"[,;/&+]| and ", s):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p for p in _TOKEN.findall(chunk.replace(" to ", "-"))]
        nums: list[int] = []
        for p in parts:
            if p.isdigit():
                n = int(p)
                if 1 <= n <= 12:
                    nums.append(n)
            elif p in MONTHS:
                nums.append(MONTHS[p])
        if not nums:
            continue
        ok = True
        is_range = ("-" in chunk or " to " in chunk) and len(nums) >= 2
        if is_range:
            a, b = nums[0], nums[-1]
            m = a
            for _ in range(12):
                out.add(m)
                if m == b:
                    break
                m = m % 12 + 1
        else:
            out.update(nums)
    return sorted(out), ok


def norm_species(raw) -> str:
    s = re.sub(r"\s+", " ", str(raw or "").strip())
    return s


def species_key(raw) -> str:
    return norm_species(raw).lower()


# --------------------------------------------------------------------------
# Nativity reference
# --------------------------------------------------------------------------
def load_nativity(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text())
    table: dict[str, str] = {}
    for name in data.get("native", []):
        table[name.strip().lower()] = "native"
    for name in data.get("non_native", []):
        table[name.strip().lower()] = "non_native"
    if not table:
        raise AggregateError(f"{path} contained no species. Refusing to build.")
    return table


def nativity_of(botanical: str, table: dict[str, str]) -> str:
    key = species_key(botanical)
    if not key:
        return "unknown"
    if key in table:
        return table[key]
    # try genus + species only (drop authority / var. / cultivar noise)
    bits = key.replace("var.", " ").replace("subsp.", " ").split()
    if len(bits) >= 2:
        short = f"{bits[0]} {bits[1]}"
        if short in table:
            return table[short]
    return "unknown"


# --------------------------------------------------------------------------
# Header handling
# --------------------------------------------------------------------------
def build_colmap(header: list[str], source: str) -> dict[str, str]:
    lookup = {h.strip().lower().lstrip("﻿"): h for h in header}
    colmap: dict[str, str] = {}
    missing: list[str] = []
    for want in REQUIRED:
        if want in lookup:
            colmap[want] = lookup[want]
        else:
            missing.append(want)
    if missing:
        raise AggregateError(
            f"{source}: required column(s) {missing} not found.\n"
            f"Actual header was:\n  {header}\n"
            "The upstream schema changed. Refusing to build a map from columns "
            "I cannot verify. Fix scripts/aggregate.py REQUIRED after checking "
            "the dataset by hand."
        )
    for want in OPTIONAL:
        if want in lookup:
            colmap[want] = lookup[want]
    return colmap


# --------------------------------------------------------------------------
# Main aggregation
# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", default="raw", help="directory holding part_*.csv")
    ap.add_argument("--out", default="public/data", help="output directory")
    ap.add_argument(
        "--nativity",
        default=str(Path(__file__).with_name("native_species.json")),
        help="curated botanical-origin reference",
    )
    ap.add_argument("--min-parts", type=int, default=17)
    args = ap.parse_args()

    raw_dir = Path(args.raw)
    out_dir = Path(args.out)
    (out_dir / "tiles").mkdir(parents=True, exist_ok=True)

    parts = sorted(raw_dir.glob("part_*.csv"))
    if len(parts) < args.min_parts:
        raise AggregateError(
            f"Found {len(parts)} CSV parts in {raw_dir}, expected at least "
            f"{args.min_parts}. Run scripts/fetch_data.py first. "
            "Not building a partial map."
        )

    nativity = load_nativity(Path(args.nativity))

    # accumulators -----------------------------------------------------------
    total = 0
    geom_ok = 0
    geom_bad = 0
    out_of_box = 0

    wards: dict[str, dict] = {}
    species: dict[str, dict] = {}
    tiles: dict[tuple[int, int], dict[tuple[int, int], dict]] = defaultdict(dict)

    giants_heap: list[tuple[float, int, dict]] = []
    rare_heap: list[tuple[float, int, dict]] = []
    rare_total = 0
    tie = 0

    cond_values: Counter[str] = Counter()
    own_values: Counter[str] = Counter()
    flower_raw_unparsed: Counter[str] = Counter()
    flower_parsed = 0
    flower_blank = 0

    girth_sum = 0.0
    girth_n = 0
    height_sum = 0.0
    height_n = 0

    colmap: dict[str, str] | None = None
    header_seen: list[str] = []

    for part in parts:
        print(f"[agg] reading {part.name}", flush=True)
        with part.open("r", encoding="utf-8", errors="replace", newline="") as fh:
            reader = csv.reader(fh)
            try:
                header = next(reader)
            except StopIteration:
                raise AggregateError(f"{part} is empty.")
            cm = build_colmap(header, part.name)
            if colmap is None:
                colmap = cm
                header_seen = list(header)
                print(f"[agg] header as published: {header_seen}", flush=True)
                print(f"[agg] columns matched: {sorted(cm)}", flush=True)
            idx = {k: header.index(v) for k, v in cm.items()}
            ncols = len(header)

            for row in reader:
                if len(row) < ncols:
                    # short row -> pad rather than crash on a stray newline
                    row = row + [""] * (ncols - len(row))
                total += 1

                bot = norm_species(row[idx["botanical_name"]])
                skey = species_key(bot)
                cond = row[idx["condition"]].strip()
                cond_values[cond.lower() or "(blank)"] += 1
                own = row[idx["ownership"]].strip()
                own_values[own.lower() or "(blank)"] += 1

                healthy = cond.lower() in HEALTHY_VALUES
                nat = nativity_of(bot, nativity) if skey else "unknown"

                girth = fnum(row[idx["girth_cm"]])
                height = fnum(row[idx["height_m"]])
                if girth is not None and 0 < girth < 3000:
                    girth_sum += girth
                    girth_n += 1
                if height is not None and 0 < height < 120:
                    height_sum += height
                    height_n += 1

                # -- ward ------------------------------------------------------
                wcode = row[idx["ward"]].strip()
                wname = row[idx["ward_name"]].strip() if "ward_name" in idx else ""
                wkey = wcode or wname or "(unrecorded)"
                w = wards.get(wkey)
                if w is None:
                    w = wards[wkey] = {
                        "code": wcode,
                        "name": wname,
                        "count": 0,
                        "healthy": 0,
                        "cond_known": 0,
                        "native": 0,
                        "non_native": 0,
                        "unknown_nativity": 0,
                        "species": Counter(),
                    }
                if wname and not w["name"]:
                    w["name"] = wname
                w["count"] += 1
                if cond:
                    w["cond_known"] += 1
                    if healthy:
                        w["healthy"] += 1
                w["native" if nat == "native" else
                  "non_native" if nat == "non_native" else "unknown_nativity"] += 1
                if skey:
                    w["species"][skey] += 1

                # -- species ---------------------------------------------------
                if skey:
                    sp = species.get(skey)
                    if sp is None:
                        sp = species[skey] = {
                            "botanical": bot,
                            "common": Counter(),
                            "local": Counter(),
                            "econ": Counter(),
                            "phen": Counter(),
                            "flower_months": Counter(),
                            "flower_raw": Counter(),
                            "count": 0,
                            "native": nat,
                            "girth_sum": 0.0,
                            "girth_n": 0,
                            "rare": 0,
                        }
                    sp["count"] += 1
                    cn = norm_species(row[idx["common_name"]])
                    ln = str(row[idx["local_name"]] or "").strip()
                    ec = norm_species(row[idx["economic_i"]])
                    if cn:
                        sp["common"][cn] += 1
                    if ln:
                        sp["local"][ln] += 1
                    if ec:
                        sp["econ"][ec] += 1
                    if "phenology" in idx:
                        ph = norm_species(row[idx["phenology"]])
                        if ph:
                            sp["phen"][ph] += 1
                    if girth is not None and 0 < girth < 3000:
                        sp["girth_sum"] += girth
                        sp["girth_n"] += 1

                    fl_raw = str(row[idx["flowering"]] or "").strip()
                    months, ok = parse_flowering_months(fl_raw)
                    if ok:
                        flower_parsed += 1
                        sp["flower_raw"][fl_raw] += 1
                        for m in months:
                            sp["flower_months"][m] += 1
                    elif fl_raw:
                        flower_raw_unparsed[fl_raw[:60]] += 1
                    else:
                        flower_blank += 1

                # -- geometry --------------------------------------------------
                pt = parse_geom(row[idx["geom"]])
                if pt is None:
                    geom_bad += 1
                    continue
                lon, lat = pt
                # some publishers emit lat/lon swapped; correct only when the
                # swap is unambiguous for Pune (lat can never exceed 74 here)
                if not (LON_MIN <= lon <= LON_MAX) and (LON_MIN <= lat <= LON_MAX):
                    lon, lat = lat, lon
                if not (LON_MIN <= lon <= LON_MAX and LAT_MIN <= lat <= LAT_MAX):
                    out_of_box += 1
                    continue
                geom_ok += 1

                ci = int(math.floor(lon / CELL_DEG))
                cj = int(math.floor(lat / CELL_DEG))
                ti, tj = ci // CELLS_PER_TILE, cj // CELLS_PER_TILE
                tile = tiles[(ti, tj)]
                cell = tile.get((ci, cj))
                if cell is None:
                    cell = tile[(ci, cj)] = {"n": 0, "sp": Counter(),
                                             "healthy": 0, "cond": 0}
                cell["n"] += 1
                if cond:
                    cell["cond"] += 1
                    if healthy:
                        cell["healthy"] += 1
                if skey:
                    c = cell["sp"]
                    c[skey] += 1
                    if len(c) > CELL_SPECIES_PRUNE_AT:
                        cell["sp"] = Counter(dict(c.most_common(CELL_SPECIES_KEEP)))

                # -- giants ----------------------------------------------------
                if girth is not None and 0 < girth < 3000:
                    tie += 1
                    rec = {
                        "lon": round(lon, 6), "lat": round(lat, 6),
                        "b": bot,
                        "c": norm_species(row[idx["common_name"]]),
                        "l": str(row[idx["local_name"]] or "").strip(),
                        "g": round(girth, 1),
                        "h": round(height, 1) if height is not None else None,
                        "cond": cond,
                        "own": own,
                        "w": wname or wcode,
                    }
                    if len(giants_heap) < GIANTS_N:
                        heapq.heappush(giants_heap, (girth, tie, rec))
                    elif girth > giants_heap[0][0]:
                        heapq.heapreplace(giants_heap, (girth, tie, rec))

                # -- rare ------------------------------------------------------
                if truthy(row[idx["is_rare"]]):
                    rare_total += 1
                    if skey:
                        species[skey]["rare"] += 1
                    tie += 1
                    rec = {
                        "lon": round(lon, 6), "lat": round(lat, 6),
                        "b": bot,
                        "c": norm_species(row[idx["common_name"]]),
                        "l": str(row[idx["local_name"]] or "").strip(),
                        "g": round(girth, 1) if girth is not None else None,
                        "h": round(height, 1) if height is not None else None,
                        "cond": cond,
                        "own": own,
                        "w": wname or wcode,
                    }
                    rank = girth if girth is not None else -1.0
                    if len(rare_heap) < RARE_MAX:
                        heapq.heappush(rare_heap, (rank, tie, rec))
                    elif rank > rare_heap[0][0]:
                        heapq.heapreplace(rare_heap, (rank, tie, rec))

                if total % 500_000 == 0:
                    print(f"[agg]   {total:,} rows", flush=True)

    if total == 0:
        raise AggregateError("Read 0 data rows across all parts. Aborting.")
    if geom_ok == 0:
        raise AggregateError(
            "Not one row produced a usable coordinate. The 'geom' format is not "
            "what parse_geom() handles. Sample values must be inspected by hand."
        )
    bad_ratio = geom_bad / total
    if bad_ratio > 0.05:
        raise AggregateError(
            f"{bad_ratio:.1%} of rows had an unparseable 'geom' "
            f"({geom_bad:,} of {total:,}). That is above the 5% tolerance. "
            "Refusing to publish a map that silently drops that many trees."
        )

    print(f"[agg] {total:,} rows | {geom_ok:,} mapped | {geom_bad:,} bad geom "
          f"| {out_of_box:,} outside Pune box", flush=True)

    # ---------------------------------------------------------------- outputs
    def write(rel: str, obj) -> int:
        p = out_dir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        p.write_text(text, encoding="utf-8")
        gz = len(gzip.compress(text.encode("utf-8"), 6))
        return gz

    sizes: dict[str, int] = {}

    # species_index ---------------------------------------------------------
    sp_out = []
    for skey, sp in sorted(species.items(), key=lambda kv: -kv[1]["count"]):
        fm = sp["flower_months"]
        peak = max(fm.values()) if fm else 0
        months = sorted(m for m, c in fm.items() if peak and c >= peak * 0.15)
        sp_out.append({
            "k": skey,
            "b": sp["botanical"],
            "c": sp["common"].most_common(1)[0][0] if sp["common"] else "",
            "l": sp["local"].most_common(1)[0][0] if sp["local"] else "",
            "n": sp["count"],
            "nat": sp["native"],
            "fm": months,
            "fr": sp["flower_raw"].most_common(1)[0][0] if sp["flower_raw"] else "",
            "e": sp["econ"].most_common(1)[0][0] if sp["econ"] else "",
            "p": sp["phen"].most_common(1)[0][0] if sp["phen"] else "",
            "ag": round(sp["girth_sum"] / sp["girth_n"], 1) if sp["girth_n"] else None,
            "r": sp["rare"],
        })
    sizes["species_index.json"] = write("species_index.json", {
        "count": len(sp_out), "total_trees": total, "species": sp_out,
    })

    name_by_key = {s["k"]: (s["l"] or s["c"] or s["b"]) for s in sp_out}

    # ward_summary ----------------------------------------------------------
    ward_out = []
    for wkey, w in wards.items():
        n = w["count"]
        nat_known = w["native"] + w["non_native"]
        ward_out.append({
            "k": wkey,
            "code": w["code"],
            "name": w["name"] or w["code"] or "(unrecorded)",
            "n": n,
            "top": [
                {"k": k, "n": c, "l": name_by_key.get(k, k)}
                for k, c in w["species"].most_common(TOP_SPECIES_PER_WARD)
            ],
            "native": w["native"],
            "non_native": w["non_native"],
            "unknown_nativity": w["unknown_nativity"],
            "native_pct": round(100 * w["native"] / nat_known, 1) if nat_known else None,
            "healthy_pct": round(100 * w["healthy"] / w["cond_known"], 1)
            if w["cond_known"] else None,
        })
    ward_out.sort(key=lambda x: -x["n"])
    sizes["ward_summary.json"] = write("ward_summary.json", {
        "count": len(ward_out), "wards": ward_out,
    })

    # geojson helpers -------------------------------------------------------
    def to_geojson(records, extra=None):
        feats = []
        for r in records:
            props = {k: v for k, v in r.items() if k not in ("lon", "lat")}
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
                "properties": props,
            })
        fc = {"type": "FeatureCollection", "features": feats}
        if extra:
            fc.update(extra)
        return fc

    giants = [rec for _, _, rec in sorted(giants_heap, key=lambda t: -t[0])]
    sizes["giants.geojson"] = write("giants.geojson", to_geojson(
        giants,
        {"note": f"The {len(giants)} largest trees by recorded girth_cm.",
         "source": "PMC Tree Census 2019 via OpenCity"},
    ))

    rare = [rec for _, _, rec in sorted(rare_heap, key=lambda t: -t[0])]
    sizes["rare_trees.geojson"] = write("rare_trees.geojson", to_geojson(
        rare,
        {"total_rare_in_census": rare_total,
         "included": len(rare),
         "truncated": rare_total > len(rare),
         "note": ("Every tree flagged is_rare in the census."
                  if rare_total <= len(rare)
                  else f"{rare_total:,} trees are flagged rare; the {len(rare):,} "
                       "with the largest recorded girth are plotted to keep the "
                       "page light. The full count is shown on the site."),
         "source": "PMC Tree Census 2019 via OpenCity"},
    ))

    # tiles -----------------------------------------------------------------
    tile_index = []
    max_cell = 0
    tiles_bytes = 0
    for (ti, tj), cells in sorted(tiles.items()):
        arr = []
        tmax = 0
        for (ci, cj), cell in sorted(cells.items()):
            top = [[k, c] for k, c in cell["sp"].most_common(TOP_SPECIES_PER_CELL)]
            hp = round(100 * cell["healthy"] / cell["cond"]) if cell["cond"] else None
            arr.append([ci - ti * CELLS_PER_TILE, cj - tj * CELLS_PER_TILE,
                        cell["n"], top, hp])
            tmax = max(tmax, cell["n"])
        max_cell = max(max_cell, tmax)
        rel = f"tiles/{ti}_{tj}.json"
        tiles_bytes += write(rel, {"t": [ti, tj], "cells": arr})
        tile_index.append({"t": [ti, tj], "cells": len(arr), "max": tmax,
                           "n": sum(c["n"] for c in cells.values())})
    sizes["tiles/*.json"] = tiles_bytes
    sizes["tiles/index.json"] = write("tiles/index.json", {
        "cell_deg": CELL_DEG,
        "cells_per_tile": CELLS_PER_TILE,
        "tile_deg": TILE_DEG,
        "cell_metres_approx": 500,
        "max_cell_count": max_cell,
        "tiles": tile_index,
    })

    # names lookup for the tile popups (small: species key -> names)
    sizes["species_names.json"] = write("species_names.json", {
        s["k"]: [s["l"], s["c"], s["b"]] for s in sp_out
    })

    # meta ------------------------------------------------------------------
    unparsed_top = flower_raw_unparsed.most_common(25)
    meta = {
        "built_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "name": "Pune Tree Census 2019 (Pune Municipal Corporation)",
            "via": "OpenCity",
            "url": "https://data.opencity.in/dataset/pune-tree-census-2019",
            "census_date": "August 2019",
            "parts": len(parts),
            # The authoritative column list: what the published CSV actually
            # had, recorded rather than assumed.
            "header_seen": header_seen,
            "columns_required": REQUIRED,
            "columns_optional_used": sorted(
                k for k in (colmap or {}) if k in OPTIONAL
            ),
        },
        "totals": {
            "rows": total,
            "mapped": geom_ok,
            "unmappable_geom": geom_bad,
            "outside_pune_bbox": out_of_box,
            "species": len(species),
            "wards": len(wards),
            "rare_flagged": rare_total,
            "rare_plotted": len(rare),
            "giants_plotted": len(giants),
            "grid_cells": sum(len(c) for c in tiles.values()),
            "grid_tiles": len(tiles),
            "avg_girth_cm": round(girth_sum / girth_n, 1) if girth_n else None,
            "avg_height_m": round(height_sum / height_n, 1) if height_n else None,
        },
        "nativity": {
            "warning": (
                "The census has no native/non-native column. Nativity here comes "
                "from scripts/native_species.json, a curated botanical-origin "
                "list kept in this repo. Species not on that list are counted as "
                "unknown and never guessed."
            ),
            "native": sum(w["native"] for w in wards.values()),
            "non_native": sum(w["non_native"] for w in wards.values()),
            "unknown": sum(w["unknown_nativity"] for w in wards.values()),
        },
        "schema_report": {
            "note": "Distinct values actually seen, so the mappings above can be audited.",
            "condition": cond_values.most_common(30),
            "healthy_values_treated_as_healthy": sorted(HEALTHY_VALUES),
            "ownership": own_values.most_common(30),
            "flowering": {
                "rows_parsed": flower_parsed,
                "rows_blank": flower_blank,
                "rows_unparsed": sum(flower_raw_unparsed.values()),
                "top_unparsed_values": unparsed_top,
            },
        },
        "payload_gzip_bytes": sizes,
        "payload_gzip_total": sum(sizes.values()),
        "caveats": [
            "Census fieldwork: August 2019. Trees planted or cut since then are not reflected.",
            "Not an official Pune Municipal Corporation service.",
            "Nativity is a curated botanical judgement, not census data.",
            "Grid cells are approximately 500 m, not exact squares.",
        ],
    }
    sizes["meta.json"] = write("meta.json", meta)

    tot = sum(sizes.values())
    print("\n[agg] gzip payload:")
    for k, v in sorted(sizes.items(), key=lambda kv: -kv[1]):
        print(f"        {k:<26} {v/1024:8.1f} KiB")
    print(f"        {'TOTAL':<26} {tot/1_048_576:8.2f} MiB")
    if tot > 5 * 1024 * 1024:
        print(
            f"\nFATAL [agg]: gzip payload {tot/1_048_576:.2f} MiB exceeds the "
            "5 MiB budget.",
            file=sys.stderr,
        )
        return 3
    print("[agg] OK", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AggregateError as exc:
        print(f"\nFATAL [agg]: {exc}\n", file=sys.stderr)
        sys.exit(2)
