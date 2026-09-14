#!/bin/sh
set -eu

cd /opt/nooshin-vroom
exec 9>/var/lock/nooshin-vroom-deploy.lock
flock 9
if [ -s /var/lib/nooshin-vroom-deployed-sha ] \
  && [ "$(cat /var/lib/nooshin-vroom-deployed-sha)" = "${GITHUB_SHA:?missing GitHub SHA}" ]; then
  echo "Already deployed ${GITHUB_SHA}."
  exit 0
fi
git fetch --prune origin master
git checkout -B master FETCH_HEAD
test "$(git rev-parse HEAD)" = "${GITHUB_SHA:?missing GitHub SHA}"
docker compose up -d --build
docker compose ps
docker compose -f deploy/infra.compose.yaml up -d
docker compose -f deploy/infra.compose.yaml ps
install -d -m 0755 /var/lib
printf '%s\n' "$GITHUB_SHA" > /var/lib/nooshin-vroom-deployed-sha
