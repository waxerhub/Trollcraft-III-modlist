#!/usr/bin/env bash
# Builds trollcraft_spawnskip-1.0.0.jar against a Forge 1.20.1 (47.4.10) server's own libraries.
# Usage: bash build.sh <server folder>   (needs a JDK 17: javac and jar on PATH, or JDK set)
set -e
cd "$(dirname "$0")"
S=${1:?server folder}
JDK=${JDK:-}
JAVAC=${JDK:+$JDK/bin/}javac; JAR=${JDK:+$JDK/bin/}jar
L=$S/libraries
CP=$L/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-server.jar
for j in $(find "$L" -name "*.jar" | grep -vE "forge-1.20.1-47.4.10-server|server-1.20.1-20230612.114412-(extra|slim)"); do CP="$CP:$j"; done
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) CP=$(echo "$CP" | tr ':' '\n' | while read p; do cygpath -m "$p"; done | paste -sd ';');; esac
rm -rf out && mkdir out
{ echo "-cp"; echo "\"$CP\""; echo "-d"; echo out; echo "-proc:none"; echo "--release"; echo 17; find src -name "*.java"; } > args.txt
"$JAVAC" @args.txt
rm -f trollcraft_spawnskip-1.0.0.jar
"$JAR" --create --file trollcraft_spawnskip-1.0.0.jar --manifest manifest.txt -C out . -C res .
rm -rf out args.txt
echo built trollcraft_spawnskip-1.0.0.jar
