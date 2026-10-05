#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p build
"${CXX:-g++}" -std=c++17 -Wall -Wextra -Wpedantic -Werror -pthread -Iinclude \
    src/candidate_guard.cpp tests/candidate_guard_tests.cpp -o build/candidate_guard_tests
./build/candidate_guard_tests
