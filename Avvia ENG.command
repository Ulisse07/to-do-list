#!/bin/zsh
set -e
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  eng_runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [[ -x "$eng_runtime/node/bin/node" ]]; then
    export PATH="$eng_runtime/node/bin:$eng_runtime/bin/fallback:$PATH"
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Installa Node.js 22.12 o successivo da https://nodejs.org e riapri questo file.'
  read '?Premi Invio per chiudere. '
  exit 1
fi
if [[ ! -d node_modules/vite ]]; then
  if command -v npm >/dev/null 2>&1; then
    npm install
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  else
    print 'Installa Node.js con npm, quindi riapri questo file.'
    read '?Premi Invio per chiudere. '
    exit 1
  fi
fi
if [[ ! -f .env.local && ! -f .env ]]; then
  print 'VITE_DEMO_MODE=true' > .env.local
  print 'Avvio in demo locale: i dati restano soltanto in questo browser.'
fi
exec node scripts/launch.mjs
