#!/bin/bash
# playwright-mcp.sh - Run one Playwright MCP server per machine instead of one per Claude Code session
# Safe to re-run. docs/claude/DEVELOPER.md has the steps to undo it.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

LABEL="com.inixiative.playwright-mcp"
URL="http://localhost:8931/mcp"
PLUGIN="playwright@claude-plugins-official"
DOMAIN="gui/$(id -u)"
SERVICE="${DOMAIN}/${LABEL}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$HOME/Library/Logs/${LABEL}.log"
START_TIMEOUT_SECONDS=120

skip() {
    echo -e "${YELLOW}⚠️  Skipping shared Playwright MCP server: $1${NC}"
    exit 0
}

is_playwright_mcp() {
    curl -s --max-time 5 -X POST "$URL" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json, text/event-stream' \
        -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"playwright-mcp-setup","version":"1"}}}' \
        | node -e '
const body = require("fs").readFileSync(0, "utf8");
const isPlaywright = body.split("\n").some((line) => {
    try {
        return JSON.parse(line.replace(/^data: /, "")).result.serverInfo.name === "Playwright";
    } catch {
        return false;
    }
});
process.exit(isPlaywright ? 0 : 1);'
}

plugin_enabled() {
    claude plugin list --json | node -e '
const plugins = JSON.parse(require("fs").readFileSync(0, "utf8"));
process.exit(plugins.some((plugin) => plugin.id === process.argv[1] && plugin.enabled === true) ? 0 : 1);' "$PLUGIN"
}

[ "$(uname)" = "Darwin" ] || skip "macOS only"
command -v claude >/dev/null 2>&1 || skip "claude CLI not found"
command -v npx >/dev/null 2>&1 || skip "npx not found"
command -v node >/dev/null 2>&1 || skip "node not found"

NPX=$(command -v npx)
TEMP_PLIST=$(mktemp)

cat > "$TEMP_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NPX}</string>
        <string>-y</string>
        <string>@playwright/mcp@latest</string>
        <string>--port</string>
        <string>8931</string>
        <string>--host</string>
        <string>localhost</string>
        <string>--isolated</string>
        <string>--headless</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "$NPX"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG}</string>
    <key>StandardErrorPath</key>
    <string>${LOG}</string>
</dict>
</plist>
EOF

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

if cmp -s "$TEMP_PLIST" "$PLIST" && launchctl print "$SERVICE" >/dev/null 2>&1; then
    rm -f "$TEMP_PLIST"
    echo -e "${GREEN}✅ Login service already installed${NC}"
elif ! launchctl print "$SERVICE" >/dev/null 2>&1 && is_playwright_mcp; then
    rm -f "$TEMP_PLIST"
    echo -e "${GREEN}✅ Another service already runs a Playwright MCP server at ${URL}; using it${NC}"
else
    echo -e "${BLUE}📝 Installing login service ${LABEL}${NC}"
    launchctl bootout "$SERVICE" 2>/dev/null || true
    while launchctl print "$SERVICE" >/dev/null 2>&1; do
        sleep 1
    done
    mv "$TEMP_PLIST" "$PLIST"
    launchctl bootstrap "$DOMAIN" "$PLIST"
fi

echo -e "${BLUE}🔍 Waiting for the server at ${URL}...${NC}"
ELAPSED=0
until is_playwright_mcp; do
    if [ "$ELAPSED" -ge "$START_TIMEOUT_SECONDS" ]; then
        echo -e "${YELLOW}⚠️  No Playwright MCP server answered at ${URL} within ${START_TIMEOUT_SECONDS}s. Claude's settings are unchanged.${NC}"
        echo -e "${YELLOW}   Check that nothing else holds port 8931. Log: ${LOG}${NC}"
        exit 1
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done
echo -e "${GREEN}✅ Server is running${NC}"

claude mcp remove -s user playwright >/dev/null 2>&1 || true
claude mcp add -s user -t http playwright "$URL" >/dev/null
echo -e "${GREEN}✅ Registered for every repo as 'playwright'${NC}"

if plugin_enabled; then
    claude plugin disable -s user "$PLUGIN" >/dev/null
    echo -e "${GREEN}✅ Turned off the per-session plugin${NC}"
fi

echo ""
echo -e "${BLUE}Open Claude Code sessions keep their own servers until they restart.${NC}"
