#!/usr/bin/env bash
# Refreshes the bundled copy of the lichess-org/chess-openings dataset (CC0).
set -euo pipefail
dest="$(dirname "$0")/../src/data/openings"
for f in a b c d e; do
  curl -fsSL -o "$dest/$f.tsv" "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv"
done
echo "Updated $(cat "$dest"/*.tsv | wc -l) lines in $dest"
