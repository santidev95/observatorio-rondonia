#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
if [[ $EUID != 0 || $# != 2 || ! $2 =~ ^cloudflare/cloudflared:[0-9]{4}\.[0-9]{1,2}\.[0-9]+$ ]]; then
  echo 'Uso como root: bash install.sh /caminho/chave.pub cloudflare/cloudflared:AAAA.M.N' >&2
  exit 64
fi
key=$(tr -d '\r' < "$1")
if [[ ! $key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9@._-]+)?$ ]]; then
  echo 'Informe uma única chave pública Ed25519.' >&2
  exit 64
fi
command -v sudo >/dev/null
command -v flock >/dev/null
docker compose version >/dev/null
source_dir=$(cd "$(dirname "$0")" && pwd)
root=/opt/observatorio-rondonia
install -d -m 700 "$root" "$root/secrets"
install -m 640 "$source_dir/docker-compose.production.yml" "$root/docker-compose.production.yml"
install -o root -g root -m 755 "$source_dir/deploy.sh" /usr/local/sbin/observatorio-rondonia-deploy
install -o root -g root -m 755 "$source_dir/ssh-entrypoint.sh" /usr/local/bin/observatorio-rondonia-ssh

if ! id observatorio-deploy >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/observatorio-deploy --shell /bin/bash observatorio-deploy
fi
if [[ $(getent passwd observatorio-deploy | cut -d: -f6) != /var/lib/observatorio-deploy || $(id -u observatorio-deploy) == 0 ]]; then
  echo 'A conta de deploy existente exige revisão manual.' >&2
  exit 65
fi
if id -nG observatorio-deploy | tr ' ' '\n' | grep -Eq '^(docker|sudo|wheel)$'; then
  echo 'A conta de deploy não deve pertencer a grupos administrativos.' >&2
  exit 65
fi
chown root:root /var/lib/observatorio-deploy
chmod 755 /var/lib/observatorio-deploy
install -d -o root -g root -m 755 /var/lib/observatorio-deploy/.ssh
printf 'restrict,command="/usr/local/bin/observatorio-rondonia-ssh" %s\n' "$key" > /var/lib/observatorio-deploy/.ssh/authorized_keys
chown root:root /var/lib/observatorio-deploy/.ssh/authorized_keys
chmod 644 /var/lib/observatorio-deploy/.ssh/authorized_keys
sudoers=$(mktemp)
trap 'rm -f -- "$sudoers"' EXIT
printf '%s\n' 'observatorio-deploy ALL=(root) NOPASSWD: /usr/local/sbin/observatorio-rondonia-deploy *' > "$sudoers"
chmod 440 "$sudoers"
visudo -cf "$sudoers" >/dev/null
install -o root -g root -m 440 "$sudoers" /etc/sudoers.d/observatorio-rondonia

if [[ ! -f $root/runtime.env ]]; then
  umask 077
  password=$(od -An -N48 -tx1 /dev/urandom | tr -d ' \n')
  printf 'REDIS_PASSWORD=%s\nCLOUDFLARED_IMAGE=%s\n' "$password" "$2" > "$root/runtime.env"
fi
echo 'Configuração instalada. Falta gravar o token do Tunnel e executar o primeiro deploy.'
