#!/bin/sh
# Builds the harness bundle and a page that loads the Saira fonts from node_modules.
set -e
cd "$(dirname "$0")/../.."
OUT=${1:-/tmp/vt}
mkdir -p "$OUT"
npx esbuild qa/voucher-harness/entry.tsx --bundle --outfile="$OUT/harness.js" --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --log-level=warning
F="$PWD/node_modules/@fontsource"
face() { echo "@font-face{font-family:'$1';font-weight:$2;src:url('file://$F/$3/files/$3-latin-$2-normal.woff') format('woff');}"; }
{
  echo "<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#fff}#root{width:1275px}"
  for w in 400 600 700; do face "Saira Condensed" $w saira-condensed; done
  for w in 400 600 700 800; do face "Saira Extra Condensed" $w saira-extra-condensed; done
  for w in 500 600 700 800; do face "Saira Semi Condensed" $w saira-semi-condensed; done
  face "Saira" 400 saira
  echo "</style><div id=root></div><script src=harness.js></script>"
} > "$OUT/harness.html"
echo "built $OUT/harness.html"
