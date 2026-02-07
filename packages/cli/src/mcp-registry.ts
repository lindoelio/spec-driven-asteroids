export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  category: 'git' | 'project-management' | 'database' | 'auth' | 'testing' | 'development' | 'productivity';
  npmPackage: string;
  command: string;
  args: string[];
  requiresApiKey: boolean;
  documentationUrl: string;
}

export const MCP_SERVERS: McpServerConfig[] = [
  // Git Integration
  {
    id: 'github',
    name: 'Official GitHub MCP',
    category: 'git',
    description: 'Repository management, file operations, GitHub API integration',
    npmPackage: '@github/mcp-server',
    command: 'npx',
    args: ['@github/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://github.com/github/mcp-server'
  },

  // Project Management
  {
    id: 'linear',
    name: 'Linear MCP',
    category: 'project-management',
    description: 'Issue tracking, projects, and comments',
    npmPackage: '@linear/mcp-server',
    command: 'npx',
    args: ['@linear/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://github.com/mcplinear/mcp'
  },
  {
    id: 'atlassian',
    name: 'Atlassian MCP',
    category: 'project-management',
    description: 'Jira and Confluence integration',
    npmPackage: '@atlassian/mcp-server',
    command: 'npx',
    args: ['@atlassian/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://github.com/atlassian/mcp-server'
  },

  // Database
  {
    id: 'supabase',
    name: 'Supabase MCP',
    category: 'database',
    description: 'Database and auth services',
    npmPackage: '@supabase/mcp-server',
    command: 'npx',
    args: ['@supabase/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://supabase.com/docs/guides/functions/mcp'
  },
  {
    id: 'firebase',
    name: 'Firebase MCP',
    category: 'database',
    description: 'Firebase tools integration',
    npmPackage: '@firebase/mcp-server',
    command: 'npx',
    args: ['@firebase/mcp-server'],
    requiresApiKey: false,
    documentationUrl: 'https://github.com/firebase/mcp-server'
  },

  // Authentication
  {
    id: 'notion',
    name: 'Notion MCP',
    category: 'auth',
    description: 'Notion API integration',
    npmPackage: 'notionhq/mcp-server',
    command: 'npx',
    args: ['notionhq/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://github.com/notionhq/mcp-server'
  },

  // Testing
  {
    id: 'postman',
    name: 'Postman MCP',
    category: 'testing',
    description: 'API collection and testing',
    npmPackage: '@postman/mcp-server',
    command: 'npx',
    args: ['@postman/mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://github.com/postmanlabs/mcp-server'
  },
  {
    id: 'playwright',
    name: 'Playwright MCP',
    category: 'testing',
    description: 'Browser automation and testing',
    npmPackage: '@playwright/mcp',
    command: 'npx',
    args: ['@playwright/mcp'],
    requiresApiKey: false,
    documentationUrl: 'https://playwright.dev'
  },

  // Development
  {
    id: 'svelte',
    name: 'Svelte MCP',
    category: 'development',
    description: 'Svelte development tools',
    npmPackage: '@sveltejs/opencode',
    command: 'npx',
    args: ['@sveltejs/opencode'],
    requiresApiKey: false,
    documentationUrl: 'https://svelte.dev'
  },
  {
    id: 'context7',
    name: 'Context7 MCP',
    category: 'development',
    description: 'Search with Context7 API',
    npmPackage: 'context7-mcp-server',
    command: 'npx',
    args: ['context7-mcp-server'],
    requiresApiKey: true,
    documentationUrl: 'https://context7.io'
  },

  // Needs research
  {
    id: 'teststrike',
    name: 'TestStrike MCP',
    category: 'testing',
    description: 'Test automation (research needed)',
    npmPackage: '@teststrike/mcp-server',
    command: 'npx',
    args: ['@teststrike/mcp-server'],
    requiresApiKey: false,
    documentationUrl: 'https://teststrike.com'
  }
];
