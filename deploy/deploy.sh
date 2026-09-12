#!/bin/sh
set -eu

cd /opt/nooshin-vroom
git fetch --prune origin master
git checkout -B master FETCH_HEAD
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing GitHub SHA}"
docker compose up -d --build
docker compose ps
