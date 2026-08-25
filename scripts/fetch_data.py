#!/usr/bin/env python3
"""
Download every CSV part of the Pune Tree Census 2019 from OpenCity.

Design rules (non-negotiable):
  * NEVER stub, sample, synthesise or substitute data.
  * Fail loudly and exit non-zero on ANY problem: API failure, missing part,
    404, truncated download, unexpected part count.
  * The resource list is read from the CKAN API at run time so that a resource
    URL rotating on OpenCity's side does not silently break the build.

Source dataset: https://data.opencity.in/dataset/pune-tree-census-2019
Licence: as published by OpenCity / Pune Municipal Corporation (open data).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CKAN_BASE = "https://data.opencity.in"
DATASET_SLUG = "pune-tree-census-2019"
PACKAGE_SHOW = f"{CKAN_BASE}/api/3/action/package_show?id={DATASET_SLUG}"

# The dataset is published as 17 CSV parts. If OpenCity republishes it with a
# different split we want a hard failure, not a quietly incomplete map.
EXPECTED_PARTS = 17

USER_AGENT = (
    "zaadancha-naksha-build/1.0 "
    "(+https://github.com/; open-data aggregation for a public tree map)"
)

# Minimum plausible size for a full part, in bytes. Parts are ~70 MiB each;
# the final part is smaller. Anything under this is a truncated/error page.
MIN_PART_BYTES = 200_000


class FetchError(RuntimeError):
    pass


def _open(url: str, timeout: int = 120):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=timeout)


def list_resources() -> list[dict]:
    """Ask CKAN for the dataset's resource list. Loud failure on anything odd."""
    print(f"[fetch] querying CKAN: {PACKAGE_SHOW}", flush=True)
    try:
        with _open(PACKAGE_SHOW) as resp:
            payload = json.load(resp)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        raise FetchError(f"CKAN package_show failed: {exc!r}") from exc

    if not payload.get("success"):
        raise FetchError(f"CKAN reported success=false: {payload!r}")

    resources = payload.get("result", {}).get("resources") or []
    csvs = [
        r
        for r in resources
        if (r.get("format") or "").strip().upper() == "CSV" and r.get("url")
    ]
    if not csvs:
        raise FetchError("CKAN returned zero CSV resources for the dataset.")

    # Stable ordering so part numbering is reproducible across runs.
    def sort_key(r: dict):
        name = (r.get("name") or "").lower()
        digits = "".join(ch if ch.isdigit() else " " for ch in name).split()
        return (int(digits[-1]) if digits else 9999, name)

    csvs.sort(key=sort_key)

    print(f"[fetch] CKAN lists {len(csvs)} CSV resources", flush=True)
    for i, r in enumerate(csvs, 1):
        print(f"        part {i:>2}: {r.get('name')!r} -> {r['url']}", flush=True)

    if len(csvs) != EXPECTED_PARTS:
        raise FetchError(
            f"Expected {EXPECTED_PARTS} CSV parts, CKAN returned {len(csvs)}. "
            "The dataset changed shape upstream. Refusing to build a partial map. "
            "Update EXPECTED_PARTS in scripts/fetch_data.py only after checking "
            "the dataset page by hand."
        )
    return csvs


def download(url: str, dest: Path, attempts: int = 4) -> None:
    """Stream a single part to disk. Retries transient errors, then gives up loudly."""
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        tmp = dest.with_suffix(dest.suffix + ".part")
        try:
            t0 = time.time()
            digest = hashlib.sha256()
            total = 0
            with _open(url, timeout=600) as resp, open(tmp, "wb") as fh:
                status = getattr(resp, "status", 200)
                if status != 200:
                    raise FetchError(f"HTTP {status} for {url}")
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        break
                    fh.write(chunk)
                    digest.update(chunk)
                    total += len(chunk)

            if total < MIN_PART_BYTES:
                raise FetchError(
                    f"{dest.name} is only {total} bytes -- that is an error page, "
                    "not a census part."
                )

            head = tmp.open("rb").read(512).lstrip()
            if head[:1] in (b"<", b"{"):
                raise FetchError(
                    f"{dest.name} does not look like CSV (starts with {head[:60]!r})."
                )

            tmp.replace(dest)
            secs = time.time() - t0
            print(
                f"[fetch] {dest.name}: {total/1_048_576:.1f} MiB in {secs:.0f}s "
                f"sha256={digest.hexdigest()[:16]}",
                flush=True,
            )
            return
        except Exception as exc:  # noqa: BLE001 - retried then re-raised
            last = exc
            tmp.unlink(missing_ok=True)
            if attempt < attempts:
                wait = 2**attempt
                print(
                    f"[fetch] attempt {attempt}/{attempts} for {dest.name} failed "
                    f"({exc!r}); retrying in {wait}s",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(wait)

    raise FetchError(f"Could not download {url} after {attempts} attempts: {last!r}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="raw", help="directory for downloaded CSV parts")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    resources = list_resources()

    manifest = []
    for i, res in enumerate(resources, 1):
        dest = out / f"part_{i:02d}.csv"
        if dest.exists() and dest.stat().st_size >= MIN_PART_BYTES:
            print(f"[fetch] {dest.name} already present, skipping", flush=True)
        else:
            download(res["url"], dest)
        manifest.append(
            {
                "part": i,
                "name": res.get("name"),
                "url": res["url"],
                "bytes": dest.stat().st_size,
            }
        )

    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    total = sum(m["bytes"] for m in manifest)
    print(
        f"[fetch] OK: {len(manifest)} parts, {total/1_048_576:.0f} MiB total",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except FetchError as exc:
        print(f"\nFATAL [fetch]: {exc}\n", file=sys.stderr)
        sys.exit(2)
