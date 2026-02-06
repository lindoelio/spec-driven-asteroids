#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "spec-driven-asteroids-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool: verify_ears_syntax
 * Validates requirements against EARS (Easy Approach to Requirements Syntax)
 */
function verifyEarsSyntax(content: string) {
  const errors: string[] = [];

  if (!content.includes('## Requirements')) {
    errors.push('Missing Requirements section');
  }
  if (!content.includes('Acceptance Criteria')) {
    errors.push('Missing Acceptance Criteria');
  }

  const hasEarsPattern = /WHEN|WHILE|WHERE|IF.*THEN|SHALL/.test(content);
  if (!hasEarsPattern) {
    errors.push('No EARS patterns detected (requires WHEN, WHILE, WHERE, IF...THEN, or SHALL)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Tool: verify_mermaid_syntax
 * Validates design documents for Mermaid diagrams and structure
 */
function verifyMermaidSyntax(content: string) {
  const errors: string[] = [];

  if (!content.includes('```mermaid')) {
    errors.push('Design must include Mermaid diagrams (```mermaid code blocks)');
  }
  if (!content.includes('DES-')) {
    errors.push('Design elements must be numbered with IDs starting with DES- (e.g., DES-1, DES-2)');
  }
  if (!content.includes('Code Anatomy')) {
    errors.push('Missing Code Anatomy section to explain implementation details');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "verify_ears_syntax",
        description: "Validates a requirements document against EARS (Easy Approach to Requirements Syntax).",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The Markdown content of the requirements document to validate."
            }
          },
          required: ["content"]
        }
      },
      {
        name: "verify_mermaid_syntax",
        description: "Validates a design document for architectural standards and Mermaid diagrams.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The Markdown content of the design document to validate."
            }
          },
          required: ["content"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "verify_ears_syntax": {
      const result = verifyEarsSyntax(args.content as string);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    case "verify_mermaid_syntax": {
      const result = verifyMermaidSyntax(args.content as string);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Spec Driven Asteroids MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP Server:", error);
  process.exit(1);
});
