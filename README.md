# mcp-denue

INEGI DENUE MCP — Mexico's directory of economic units (~6M businesses).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `denue_search_nearby` | Find businesses near a coordinate. Returns establishments matching the keyword within the given radius (max 5000m). |
| `denue_search_by_name` | Search businesses by name or brand across Mexico or a single state. Paginated — set page_size and page_start to walk results. |
| `denue_search_in_state` | Search businesses in a single Mexican state by keyword — matches against name, activity, or address. Use this for state-scoped queries that need more than just business name (e.g., "panaderia", "ferreteria"). Returns paginated results. |
| `denue_establishment` | Get full details for a single establishment by DENUE ID (the "Id" field from search results). |
| `denue_count` | Count establishments by economic activity + geography + size stratum. Returns totals — no detail records. Use for market-sizing questions like "how many pharmacies are in Jalisco". |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "denue": {
      "url": "https://gateway.pipeworx.io/denue/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Denue data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
