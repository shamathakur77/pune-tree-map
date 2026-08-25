#!/usr/bin/env python3
"""
TEST FIXTURE ONLY -- generates fake CSVs so the aggregation and the frontend can
be exercised without the 1.2 GB download.

The twelve columns the pipeline REQUIRES (geom, girth_cm, height_m, condition,
ownership, ward, botanical_name, common_name, local_name, economic_i, flowering,
is_rare) are the documented ones. The other names in HEADER below are a
plausible surrounding schema used only to prove the parser copes with extra
columns -- they are NOT a verified copy of the published header. The published
header is whatever scripts/aggregate.py records in meta.json.source.header_seen
on a real run, and aggregate.py refuses to build if a required column is absent.

This file is NEVER used in the deploy pipeline and its output NEVER ships.
"""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

HEADER = [
    "FID", "id", "geom", "oid", "sr_no", "girth_cm", "height_m", "canopy_dia_m",
    "condition", "other_remarks", "ownership", "society_name", "road_name",
    "northing", "easting", "balanced", "remarks", "special_collar", "ward_name",
    "botanical_name", "saar_uid", "common_name", "local_name", "economic_i",
    "phenology", "flowering", "ward", "is_rare",
]

SPECIES = [
    ("Azadirachta indica", "Neem", "कडुनिंब", "Medicinal", "Mar-May"),
    ("Delonix regia", "Gulmohar", "गुलमोहर", "Ornamental", "April to June"),
    ("Gliricidia sepium", "Gliricidia", "गिरिपुष्प", "Fodder", "Jan-Mar"),
    ("Ficus religiosa", "Peepal", "पिंपळ", "Religious", "Mar, Apr"),
    ("Mangifera indica", "Mango", "आंबा", "Fruit", "December-February"),
    ("Polyalthia longifolia", "Ashok", "अशोक", "Ornamental", "Feb-Apr"),
    ("Peltophorum pterocarpum", "Copper Pod", "पिवळा गुलमोहर", "Ornamental", "May-Aug"),
    ("Cassia fistula", "Amaltas", "बहावा", "Medicinal", "April-June"),
    ("Ficus benghalensis", "Banyan", "वड", "Religious", "Throughout the year"),
    ("Tamarindus indica", "Tamarind", "चिंच", "Fruit", "Apr-Jun"),
    ("Samanea saman", "Rain Tree", "शिरीष", "Shade", "Feb-May"),
    ("Syzygium cumini", "Jamun", "जांभूळ", "Fruit", "Mar-Apr"),
    ("Millingtonia hortensis", "Indian Cork", "बुचाचे झाड", "Ornamental", "Nov-Jan"),
    ("Pongamia pinnata", "Karanj", "करंज", "Oil", "Apr-Jun"),
    ("Terminalia arjuna", "Arjun", "अर्जुन", "Medicinal", "May-Jul"),
    ("Bombax ceiba", "Silk Cotton", "काटेसावर", "Fibre", "Jan-Mar"),
    ("Spathodea campanulata", "African Tulip", "पिचकारी", "Ornamental", "Sep-Dec"),
    ("Saraca asoca", "Sita Ashok", "सीता अशोक", "Religious", "Feb-Apr"),
    ("Madhuca longifolia", "Mahua", "मोह", "Oil", "Mar-Apr"),
    ("Zizyphus mauritiana", "Ber", "बोर", "Fruit", "Jul-Oct"),
]

CONDITION = ["Good"] * 6 + ["Average"] * 3 + ["Poor", "Dead"]
OWNERSHIP = ["Private"] * 5 + ["PMC"] * 3 + ["Government", "Society"]
WARDS = [
    ("01", "Aundh - Baner"), ("02", "Ghole Road"), ("03", "Dhole Patil Road"),
    ("04", "Nagar Road - Wadgaonsheri"), ("05", "Kothrud - Bavdhan"),
    ("06", "Warje - Karvenagar"), ("07", "Sinhagad Road"),
    ("08", "Hadapsar - Mundhwa"), ("09", "Kondhwa - Yewalewadi"),
    ("10", "Bibvewadi"), ("11", "Dhankawadi - Sahakarnagar"),
    ("12", "Bhavani Peth"), ("13", "Kasba - Vishrambaug Wada"),
    ("14", "Yerwada - Kalas - Dhanori"), ("15", "Shivajinagar"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="raw")
    ap.add_argument("--parts", type=int, default=17)
    ap.add_argument("--rows-per-part", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=19)
    args = ap.parse_args()

    rnd = random.Random(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    fid = 0
    for p in range(1, args.parts + 1):
        path = out / f"part_{p:02d}.csv"
        with path.open("w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(HEADER)
            for _ in range(args.rows_per_part):
                fid += 1
                bot, com, loc, econ, flower = rnd.choices(
                    SPECIES, weights=[20, 14, 12, 9, 8, 7, 6, 6, 5, 5,
                                      4, 4, 3, 3, 3, 2, 2, 2, 1, 1]
                )[0]
                lon = round(rnd.gauss(73.855, 0.045), 6)
                lat = round(rnd.gauss(18.525, 0.040), 6)
                lon = min(max(lon, 73.72), 74.02)
                lat = min(max(lat, 18.40), 18.68)
                wcode, wname = rnd.choice(WARDS)
                girth = round(abs(rnd.gauss(70, 55)) + 5, 1)
                if rnd.random() < 0.002:
                    girth = round(rnd.uniform(400, 900), 1)
                height = round(abs(rnd.gauss(7, 3.5)) + 1, 1)
                is_rare = "true" if rnd.random() < 0.0025 else "false"
                w.writerow([
                    fid, f"T{fid:08d}", f"POINT ({lon} {lat})", fid, fid,
                    girth, height, round(abs(rnd.gauss(4, 2)) + 0.5, 1),
                    rnd.choice(CONDITION), "", rnd.choice(OWNERSHIP), "", "",
                    "", "", "Yes", "", "No", wname, bot, f"S{fid:08d}",
                    com, loc, econ, "Evergreen" if rnd.random() < 0.5
                    else "Deciduous", flower, wcode, is_rare,
                ])
        print(f"[fixture] wrote {path} ({args.rows_per_part} rows)")
    print(f"[fixture] TOTAL {fid} synthetic rows -- TEST ONLY, never deployed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
