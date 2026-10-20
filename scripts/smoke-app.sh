#!/usr/bin/env bash
set -euo pipefail
image=$1
revision=$2
[[ $revision =~ ^[a-f0-9]{40}$ ]]
[[ $image == "ghcr.io/santidev95/observatorio-rondonia:sha-$revision" ]]
trap 'docker rm -f observatorio-smoke >/dev/null 2>&1 || true' EXIT
docker run --detach --name observatorio-smoke --network none --read-only \
  --tmpfs /tmp --tmpfs /app/.next/cache:uid=1000,gid=1000 \
  --cap-drop ALL --security-opt no-new-privileges:true "$image"
for attempt in $(seq 1 30); do
  if docker exec observatorio-smoke node -e 'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(3000)}).then(async r=>{const h=await r.json();if(!r.ok||h.status!=="ok"||h.revision!==process.argv[1])process.exit(1)}).catch(()=>process.exit(1))' "$revision"; then
    exit 0
  fi
  sleep 2
done
echo 'A imagem não respondeu à verificação de saúde.' >&2
exit 1
