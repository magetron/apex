# Source me (bash):  source scripts/env.sh
# Repo-local toolchain: puts the portable Node from .tools/ on PATH and points every cache,
# temp dir and tool download at .tools/, so nothing is written to $HOME or system locations.
APEX_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APEX_NODE="$(ls -d "$APEX_ROOT"/.tools/node-v* 2>/dev/null | head -n1)"
if [ -n "$APEX_NODE" ]; then
  export PATH="$APEX_NODE:$APEX_NODE/bin:$PATH"
else
  echo "scripts/env.sh: no portable Node found in .tools/ (expected .tools/node-v*)" >&2
fi
mkdir -p "$APEX_ROOT/.tools/tmp"
export npm_config_cache="$APEX_ROOT/.tools/npm-cache"
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false
export TMPDIR="$APEX_ROOT/.tools/tmp" TMP="$APEX_ROOT/.tools/tmp" TEMP="$APEX_ROOT/.tools/tmp"
export PLAYWRIGHT_BROWSERS_PATH="$APEX_ROOT/.tools/ms-playwright"
export NODE_REPL_HISTORY=""
