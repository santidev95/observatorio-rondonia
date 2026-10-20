#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

# Este arquivo e o Compose precisam pertencer a root, sem escrita pelo usuário CI.
if [[ $# != 2 || ! $1 =~ ^sha256:[a-f0-9]{64}$ || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' 'Digest ou revisão inválidos.' >&2
  exit 64
fi
if [[ $EUID != 0 ]]; then
  printf '%s\n' 'Execute pelo acesso restrito de deploy.' >&2
  exit 77
fi
cd /opt/observatorio-rondonia
exec 9>/run/lock/observatorio-rondonia-deploy.lock
flock -w 600 9
umask 077

readonly image="ghcr.io/santidev95/observatorio-rondonia@$1"
readonly revision=$2
auth_dir=$(mktemp -d /run/observatorio-registry.XXXXXX)
trap 'rm -f -- "$auth_dir/config.json"; rmdir -- "$auth_dir"' EXIT
export DOCKER_CONFIG="$auth_dir"
# Token efêmero do job recebido por stdin; nunca vira argumento nem arquivo durável.
docker login ghcr.io --username santidev95 --password-stdin >/dev/null
docker pull "$image" >/dev/null
actual=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
if [[ $actual != "$revision" ]]; then
  printf '%s\n' 'A imagem não corresponde à revisão solicitada.' >&2
  exit 65
fi

compose() {
  docker compose --project-name observatorio-rondonia --env-file runtime.env -f docker-compose.production.yml "$@"
}
previous=$(cat current-image 2>/dev/null || true)
export APP_IMAGE="$image"
if compose up -d --wait --wait-timeout 120 redis app; then
  container=$(compose ps -q app)
  if docker exec "$container" node -e 'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(5000)}).then(async r=>{const h=await r.json();if(!r.ok||h.status!=="ok"||h.revision!==process.argv[1])process.exit(1)}).catch(()=>process.exit(1))' "$revision"; then
    printf '%s\n' "$image" >current-image.next
    mv current-image.next current-image
    printf 'Deploy saudável: %s\n' "$revision"
    # Inicializa o Tunnel no primeiro deploy; containers já iguais não são recriados.
    compose --profile public up -d --no-deps cloudflared
    # Faz uma volta HTTPS pela Cloudflare a partir da VPS. A zona pode restringir
    # países dos visitantes, incluindo o país variável dos runners do GitHub.
    for attempt in $(seq 1 18); do
      if docker exec "$container" node -e 'fetch("https://rondonia.dadosabertos.org/api/health",{signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok){console.error("Verificação pública HTTP "+r.status);process.exit(1)}const h=await r.json();if(h.status!=="ok"||h.revision!==process.argv[1])process.exit(1)}).catch(()=>process.exit(1))' "$revision"; then
        printf 'HTTPS público e revisão confirmados: %s\n' "$revision"
        exit 0
      fi
      sleep 5
    done
    printf '%s\n' 'Aplicação local saudável, mas o endereço público não confirmou a revisão. Verifique DNS e Tunnel.' >&2
    exit 1
  fi
fi

printf '%s\n' 'Verificação local falhou.' >&2
if [[ $previous =~ ^ghcr.io/santidev95/observatorio-rondonia@sha256:[a-f0-9]{64}$ ]]; then
  export APP_IMAGE="$previous"
  if compose up -d --no-deps --wait --wait-timeout 120 app; then
    printf '%s\n' 'Imagem anterior restaurada.' >&2
  else
    printf '%s\n' 'Rollback falhou; intervenção na VPS necessária.' >&2
  fi
else
  # Primeiro deploy não possui versão anterior. Não deixe imagem defeituosa servindo.
  compose stop app
  printf '%s\n' 'Primeiro deploy interrompido; nenhuma imagem anterior disponível.' >&2
fi
exit 1
