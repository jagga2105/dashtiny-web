#!/usr/bin/env bash
# DashTiny central runner shortcut
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/start_all.sh" "$@"
