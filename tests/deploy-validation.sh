#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
digest="sha256:$(printf 'a%.0s' {1..64})"
revision=$(printf 'b%.0s' {1..40})
for command in '' 'id' "deploy $digest $revision; id" "deploy $digest $revision extra" "deploy $digest \$(id)" "deploy latest $revision"; do
  status=0
  SSH_ORIGINAL_COMMAND="$command" bash "$root/deploy/ssh-entrypoint.sh" >/dev/null 2>&1 || status=$?
  [[ $status == 64 ]] || { echo 'Comando indevido aceito pelo SSH.' >&2; exit 1; }
done
for arg in latest 'sha256:123' "$digest; id"; do
  status=0
  bash "$root/deploy/deploy.sh" "$arg" "$revision" >/dev/null 2>&1 || status=$?
  [[ $status == 64 ]] || { echo 'Digest indevido aceito pelo deploy.' >&2; exit 1; }
done
echo 'Limites do comando SSH validados.'
