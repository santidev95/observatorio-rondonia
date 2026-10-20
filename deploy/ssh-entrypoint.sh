#!/usr/bin/env bash
set -euo pipefail

# A chave do Actions só aceita esta operação, com argumentos sem metacaracteres.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ (sha256:[a-f0-9]{64})\ ([a-f0-9]{40})$ ]]; then
  exec /usr/bin/sudo -n /usr/local/sbin/observatorio-rondonia-deploy "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
printf '%s\n' 'Comando de deploy inválido.' >&2
exit 64
