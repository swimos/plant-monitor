#!/usr/bin/env bash
BLUE='\033[0;34m'
NC='\033[0m' # No Color
GREEN='\033[0;32m'
GREY='\033[1;30m'
LTGREEN='\033[1;32m'

cd java

printf "${GREY}Remove and retore dist folder\n${NC}"
rm -rf ./dist
mkdir dist

printf "${GREY}Run Gradle to build SWIM\n${NC}"
./gradlew build

printf "${GREY}Unpack build tar file to dist folder\n${NC}"
tar -xf build/distributions/swim-plantmonitor-0.1.tar -C dist/

cd ../

printf "${LTGREEN}done.\n${NC}"
