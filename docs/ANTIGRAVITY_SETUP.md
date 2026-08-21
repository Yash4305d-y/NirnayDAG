# Google Antigravity MCP Setup for NirnayDAG

Follow this quickstart guide to connect NirnayDAG directly to your Google Antigravity coding assistant environment, allowing Antigravity to analyze your architecture, check for cyclic dependencies, and query blast radiuses.

## Setup Instructions

**Step 1: Install Dependencies**
Ensure you have installed the project dependencies in the NirnayDAG directory:
```bash
npm install
```

**Step 2: Prepare Your ADR Directory**
Ensure your Architecture Decision Records (Markdown files) exist in the `./docs/adr` folder. 
If you store them in a different directory, update the `ADR_DIR` environment variable inside the `antigravity.config.json` file to point to your custom folder.

**Step 3: Link the Configuration**
Copy or link the provided `antigravity.config.json` into your Antigravity workspace settings directory to register the `nirnay-dag` MCP server. Once linked, restart your Antigravity session.

## Example Queries

Once set up, you can try the following prompts directly in your Antigravity chat:

- *"Run `validate_architecture` with NirnayDAG to check for cycles."*
- *"What is the blast radius and downstream risk score if we deprecate ADR-0001?"*
- *"Show me all accepted decisions related to the database."*

## Testing the Server (Developers)

If you are developing or debugging the MCP server, you can use the interactive inspector:
```bash
npm run mcp:inspect
```
This will open a web interface where you can manually trigger and test the MCP tools.
