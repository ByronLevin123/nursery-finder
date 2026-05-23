# NurseryMatch MCP Server

An MCP (Model Context Protocol) server that lets Claude Desktop search and browse UK nurseries from NurseryMatch.

## Setup

```bash
cd mcp-server
npm install
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "nurserymatch": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"]
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude things like:

- "Find Outstanding nurseries near SW11"
- "Compare these two nurseries: 123456 and 789012"
- "What's the family score for BS6?"

## Available Tools

| Tool | Description |
|------|-------------|
| `search_nurseries` | Search by postcode, place name, or nursery name |
| `get_nursery` | Full details for a single nursery by URN |
| `compare_nurseries` | Side-by-side comparison of 2-10 nurseries |
| `get_area` | Area family score, crime, parks, property prices |
| `get_nursery_markdown` | Nursery profile as readable markdown |
| `get_area_markdown` | Area summary as readable markdown |

## Configuration

Set `NURSERYMATCH_API_URL` to use a different API endpoint (defaults to the production API).
