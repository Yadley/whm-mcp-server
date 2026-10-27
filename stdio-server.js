#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env in the current directory or server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const WHMService = require('./src/services/whm.service');

const server = new McpServer({
  name: 'whm-mcp-server',
  version: '1.1.0'
});

const fs = require('fs');

// Get WHM service with fresh environment variables
function getWhmService() {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  } catch (e) {
    // fallback to existing env
  }
  return new WHMService();
}

// Format response helper
function formatResponse(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  };
}

// 1. Generic WHM API Call
server.tool(
  'whm_api_call',
  'Execute any generic WHM JSON-API v1 call (GET or POST)',
  {
    endpoint: z.string().describe('WHM API endpoint (e.g., listaccts, gethostname, version)'),
    method: z.enum(['GET', 'POST']).default('GET').describe('HTTP method'),
    params: z.record(z.any()).optional().describe('Key-value parameters to pass to the WHM API call')
  },
  async ({ endpoint, method, params = {} }) => {
    try {
      const whm = getWhmService();
      const result = method === 'POST' ? await whm.post(endpoint, params) : await whm.get(endpoint, params);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 2. List Accounts
server.tool(
  'whm_list_accounts',
  'List all cPanel accounts hosted on this WHM server',
  {},
  async () => {
    try {
      const whm = getWhmService();
      const result = await whm.listAccounts();
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 3. Account Summary
server.tool(
  'whm_account_summary',
  'Get account summary and details for a specific cPanel user',
  {
    username: z.string().describe('cPanel username (e.g. creativeyadley)')
  },
  async ({ username }) => {
    try {
      const result = await getWhmService().getAccountSummary(username);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 4. Create Account
server.tool(
  'whm_create_account',
  'Create a new cPanel account on the WHM server',
  {
    username: z.string().max(16).describe('cPanel username'),
    domain: z.string().describe('Primary domain name'),
    password: z.string().describe('Password for the cPanel user'),
    email: z.string().email().optional().describe('Contact email address'),
    package: z.string().optional().describe('Hosting package name')
  },
  async ({ username, domain, password, email, package: pkg }) => {
    try {
      const result = await getWhmService().createAccount({
        username,
        domain,
        password,
        contactemail: email,
        plan: pkg
      });
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 5. Suspend Account
server.tool(
  'whm_suspend_account',
  'Suspend a cPanel account',
  {
    username: z.string().describe('cPanel username to suspend'),
    reason: z.string().optional().describe('Reason for suspension')
  },
  async ({ username, reason = 'Administrative action' }) => {
    try {
      const result = await getWhmService().suspendAccount(username, reason);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 6. Unsuspend Account
server.tool(
  'whm_unsuspend_account',
  'Unsuspend a suspended cPanel account',
  {
    username: z.string().describe('cPanel username to unsuspend')
  },
  async ({ username }) => {
    try {
      const result = await getWhmService().unsuspendAccount(username);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 7. Terminate Account
server.tool(
  'whm_terminate_account',
  'Permanently remove/terminate a cPanel account',
  {
    username: z.string().describe('cPanel username to terminate')
  },
  async ({ username }) => {
    try {
      const result = await getWhmService().terminateAccount(username);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 8. Server Status
server.tool(
  'whm_server_status',
  'Get the current WHM server status and system metrics',
  {},
  async () => {
    try {
      const result = await getWhmService().getServerStatus();
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 9. Service Status
server.tool(
  'whm_service_status',
  'Get status of core server services (httpd, mysql, exim, etc.)',
  {},
  async () => {
    try {
      const result = await getWhmService().getServiceStatus();
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 10. Restart Service
server.tool(
  'whm_restart_service',
  'Restart a specific server service',
  {
    service: z.string().describe('Service name (e.g. httpd, mysql, cpanel, exim)')
  },
  async ({ service }) => {
    try {
      const result = await getWhmService().restartService(service);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

// 11. List Domains
server.tool(
  'whm_list_domains',
  'List all domains for a cPanel user account',
  {
    username: z.string().describe('cPanel username')
  },
  async ({ username }) => {
    try {
      const result = await getWhmService().listDomains(username);
      return formatResponse(result);
    } catch (err) {
      return formatResponse({ error: err.message, details: err.data || null });
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error starting WHM MCP server:', err);
  process.exit(1);
});
