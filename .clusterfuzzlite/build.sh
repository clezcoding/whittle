#!/bin/bash -eu
# Builds the cargo-fuzz targets in fuzz/ and copies them to $OUT, where ClusterFuzzLite runs them.
cd "$SRC/whittle"
cargo fuzz build -O --debug-assertions
for target in safety_check rules_yaml settings_json; do
  cp "fuzz/target/x86_64-unknown-linux-gnu/release/$target" "$OUT/"
done
