#!/usr/bin/env bash
set -euo pipefail
image=$1
[[ $image =~ ^ghcr.io/santidev95/observatorio-rondonia:sha-[a-f0-9]{40}$ ]]
network=observatorio-worker-smoke
cleanup() {
  docker rm -f observatorio-worker-smoke >/dev/null 2>&1 || true
  docker network disconnect "$network" redis-test >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create --internal "$network" >/dev/null
docker network connect "$network" redis-test
node --import tsx scripts/seed-worker-smoke.ts
docker run --detach --name observatorio-worker-smoke --network "$network" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  --env REDIS_URL=redis://redis-test:6379 --env "REDIS_PASSWORD=$TEST_REDIS_PASSWORD" "$image" node revenues-worker.cjs
for attempt in $(seq 1 30); do
  if docker exec observatorio-worker-smoke node revenues-worker.cjs --healthcheck; then
    node --import tsx scripts/seed-worker-smoke.ts --verify
    exit 0
  fi
  sleep 2
done
echo 'O worker não confirmou a saúde na rede isolada do teste.' >&2
exit 1
