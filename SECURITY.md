# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in NirnayDAG, please **do not** open a public GitHub issue. Instead, report it privately via GitHub Security Advisories on the repository (`https://github.com/Yash4305d-y/NirnayDAG/security/advisories/new`) or by contacting the maintainer directly (`howbow4305@gmail.com`).

Please include:
- A description of the issue and potential impact
- Steps to reproduce or a minimal proof of concept
- Affected version(s)

## Security Architecture & Guarantees

- **GitHub Token Handling**: When loading ADRs from a GitHub repository, any provided `GITHUB_TOKEN` (or `token` option) is sent solely in the `Authorization` header to `https://api.github.com` and is never written to disk, logged, or persisted by NirnayDAG.
- **MCP Path Traversal Protection**: The MCP server (`src/mcp/server.ts`) operates over `stdio` only and validates file and directory inputs (e.g. in `get_adrs_for_files`) to reject path traversal attempts (including `..` segments and Windows `..\\` sequences) outside the workspace root.
- **Local Web Server Binding**: `ndag serve` (`src/server/serve.ts`) binds exclusively to `127.0.0.1` (loopback only) and enforces path-traversal checks on static asset requests so files outside the built `dist/` directory cannot be read.
