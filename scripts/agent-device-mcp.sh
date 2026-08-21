#!/bin/sh
# agent-device を MCP サーバーとして起動するラッパー。
# 前提: MCP はエディタ/Claude Code から直接 spawn されるため mise のタスク環境を通らない。
#   このマシンは /usr/local/bin/node (v18) が PATH で勝つが agent-device は Node 22.12+ 必須。
#   そのため mise の node を明示的に前置する(mise.toml の EC_TOOL_PATH と同じ理由)。
# shims 経由なので mise.toml のバージョン変更に自動追従する
export PATH="$HOME/.local/share/mise/shims:$PATH"
exec "$(dirname "$0")/../mobile/node_modules/.bin/agent-device" mcp
