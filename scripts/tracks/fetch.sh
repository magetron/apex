#!/usr/bin/env bash
# Fetch the raw circuit data the hot laps are built from, each source into its own new, empty
# folder (git-ignored). Only data comes down (CSV, JSON, text); nothing from it is ever run.
# Then: node scripts/tracks/convert.mjs .tools/tmp/trackdata/raw src/sim/track/data
#
#  - TUMFTM racetrack-database (LGPL-3.0): centreline x/y and the widths left and right, for
#    Monza, Silverstone and Spa; with the repo's LICENSE and README.
#  - OpenStreetMap through the Overpass API (ODbL 1.0, © OpenStreetMap contributors): the
#    circuits TUMFTM lacks (Monaco, Laguna Seca, the Top Gear test track at Dunsfold).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RAW="$ROOT/.tools/tmp/trackdata/raw"
UA="apex-track-data/1.0 (educational site)"

for d in tumftm osm; do
  if [ -e "$RAW/$d" ] && [ -n "$(ls -A "$RAW/$d")" ]; then
    echo "$RAW/$d is not empty: move it away first" >&2
    exit 1
  fi
  mkdir -p "$RAW/$d"
done

TUM=https://raw.githubusercontent.com/TUMFTM/racetrack-database/master
for f in tracks/Monza.csv tracks/Silverstone.csv tracks/Spa.csv LICENSE README.md; do
  curl -sS -L --fail -A "$UA" -o "$RAW/tumftm/$(basename "$f")" "$TUM/$f"
done

overpass() {
  curl -sS --fail -A "$UA" -o "$RAW/osm/$1" --data-urlencode "data=$2" \
    https://overpass-api.de/api/interpreter
  sleep 2
}
# Monaco: the circuit relation (its ways and its start-finish node) and the raceway ways
overpass monaco.json '[out:json][timeout:90];(relation(148194);way["highway"="raceway"](43.728,7.410,43.748,7.440););out geom;'
# Laguna Seca: the circuit's route relation and the raceway ways
overpass laguna-seca.json '[out:json][timeout:90];(relation(21195763);way["highway"="raceway"](36.578,-121.762,36.592,-121.745););out geom;'
# Dunsfold aerodrome: the Top Gear test track's raceway ways
overpass dunsfold.json '[out:json][timeout:90];(way["highway"="raceway"](51.100,-0.570,51.130,-0.510););out geom;'

ls -l "$RAW/tumftm" "$RAW/osm"
