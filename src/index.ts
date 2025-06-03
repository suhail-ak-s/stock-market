/**
 * Financial Datasets MCP Server
 * A low-level server implementation using Model Context Protocol for Stock Market API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

const logFile = path.join(os.tmpdir(), 'financial-mcp.log');

fs.writeFileSync(logFile, `[INFO] ${new Date().toISOString()} - Starting Financial Datasets MCP Server...\n`);

console.log = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  fs.appendFileSync(logFile, `[INFO] ${new Date().toISOString()} - ${message}\n`);
};

console.error = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  fs.appendFileSync(logFile, `[ERROR] ${new Date().toISOString()} - ${message}\n`);
};

const logger = {
  log: (message: string) => {
    fs.appendFileSync(logFile, `[INFO] ${new Date().toISOString()} - ${message}\n`);
  },
  error: (message: string, error?: any) => {
    fs.appendFileSync(logFile, `[ERROR] ${new Date().toISOString()} - ${message}\n`);
    if (error) {
      fs.appendFileSync(logFile, `${error.stack || error}\n`);
    }
  }
};

type FinancialConfig = {
  apiKey: string;
  baseUrl: string;
};

let financialConfig: FinancialConfig;
let apiClient: any;

/**
 * Helper function to safely extract parameters from request arguments
 */
function safeGetArgs<T>(args: any, defaultValues: T): T {
  if (!args || typeof args !== 'object') {
    return defaultValues;
  }
  
  const result = { ...defaultValues };
  for (const key in defaultValues) {
    if (args[key] !== undefined) {
      result[key] = args[key];
    }
  }
  
  return result;
}

function parseArgs(): FinancialConfig {
  // First check for environment variables (used when running in npx mode)
  if (process.env.FINANCIAL_API_KEY) {
    logger.log('Using API key from environment variable');
    return {
      apiKey: process.env.FINANCIAL_API_KEY,
      baseUrl: process.env.FINANCIAL_API_BASE_URL || 'https://api.financialdatasets.ai'
    };
  }

  // Otherwise parse from command line
  const args = process.argv.slice(2);
  const config: Partial<FinancialConfig> = {
    baseUrl: 'https://api.financialdatasets.ai',
    apiKey: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--api-key' && i + 1 < args.length) {
      config.apiKey = args[++i];
    } else if (arg === '--base-url' && i + 1 < args.length) {
      config.baseUrl = args[++i];
    }
  }

  if (!config.apiKey) {
    throw new Error('Financial Datasets API key is required. Use --api-key argument or set FINANCIAL_API_KEY environment variable.');
  }

  return config as FinancialConfig;
}

function initApiClient(config: FinancialConfig) {
  return axios.create({
    baseURL: config.baseUrl,
    headers: {
      'X-API-KEY': config.apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });
}

const server = new Server(
  {
    name: "financial-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: {
        read: true,
        list: true,
        templates: true
      },
      tools: {
        list: true,
        call: true
      },
      prompts: {
        list: true,
        get: true
      }
    }
  }
);

async function fetchAvailableTickers(limit = 20): Promise<string[]> {
  try {
    logger.log('Fetching available tickers...');
    // This is a hypothetical endpoint - adjust as needed
    const response = await apiClient.get('/company/facts/tickers/');
    const tickers = response.data.tickers || [];
    logger.log(`Found ${tickers.length} tickers`);
    return tickers.slice(0, limit);
  } catch (error) {
    logger.error('Error fetching tickers:', error);
    // Return some common tickers if API fails
    return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
  }
}

async function fetchAvailableCryptoTickers(limit = 10): Promise<string[]> {
  try {
    logger.log('Fetching available crypto tickers...');
    const response = await apiClient.get('/crypto/prices/tickers/');
    const tickers = response.data.tickers || [];
    logger.log(`Found ${tickers.length} crypto tickers`);
    return tickers.slice(0, limit);
  } catch (error) {
    logger.error('Error fetching crypto tickers:', error);
    // Return some common crypto tickers if API fails
    return ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD'];
  }
}

// Set up the resource listing request handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.log('Received list resources request');

  try {
    const stockTickers = await fetchAvailableTickers();
    const cryptoTickers = await fetchAvailableCryptoTickers();
    
    const resources = [
      ...stockTickers.map(ticker => ({
        uri: new URL(`financial://company/${ticker}`),
        name: ticker,
        description: `Company data for ${ticker}`
      })),
      ...cryptoTickers.map(ticker => ({
        uri: new URL(`financial://crypto/${ticker}`),
        name: ticker,
        description: `Cryptocurrency data for ${ticker}`
      }))
    ];

    logger.log(`Returning ${resources.length} resources (stocks and crypto)`);
    return { resources };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error handling list resources request:', error);
    throw new Error(`Financial API error: ${errorMessage}`);
  }
});

/**
 * Handler for reading company information.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  logger.log('Received read resource request: ' + JSON.stringify(request));
  
  try {
    const url = new URL(request.params.uri);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts[0] === 'company' && pathParts.length > 1) {
      const ticker = pathParts[1];
      
      // Get company facts
      const response = await apiClient.get(`/company/facts?ticker=${ticker}`);
      const companyFacts = response.data.company_facts;
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(companyFacts, null, 2)
        }]
      };
    }
    
    if (pathParts[0] === 'crypto' && pathParts.length > 1) {
      const ticker = pathParts[1];
      
      // Get crypto snapshot
      const response = await apiClient.get(`/crypto/prices/snapshot?ticker=${ticker}`);
      const cryptoSnapshot = response.data.snapshot;
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(cryptoSnapshot, null, 2)
        }]
      };
    }
    
    throw new Error("Invalid resource URI format. Expected: financial://company/{ticker} or financial://crypto/{ticker}");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error handling read resource request:', error);
    throw new Error(`Failed to read resource: ${errorMessage}`);
  }
});

/**
 * List available tools for interacting with financial data.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        "name": "get_company_facts",
        "description": "Get company facts including name, CIK, market cap, employees, etc.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company (e.g., AAPL)."
            },
            "cik": {
              "type": "string",
              "description": "The CIK (Central Index Key) of the company."
            }
          },
          "required": []
        }
      },
      {
        "name": "get_stock_prices",
        "description": "Get historical stock prices for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company (e.g., AAPL)."
            },
            "period": {
              "type": "string",
              "description": "Time period for the data (e.g., '1d', '1m', '1y')."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 30
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "search_companies",
        "description": "Search for companies by name or industry",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Search query for company name, industry, or sector."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of results to return.",
              "default": 10
            }
          },
          "required": ["query"]
        }
      },
      {
        "name": "get_crypto_prices",
        "description": "Get historical price data for a cryptocurrency",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The cryptocurrency ticker symbol (e.g., BTC-USD)."
            },
            "interval": {
              "type": "string",
              "description": "The time interval for price data ('minute', 'day', 'week', 'month', 'year').",
              "enum": ["minute", "day", "week", "month", "year"]
            },
            "interval_multiplier": {
              "type": "integer",
              "description": "The multiplier for the interval (e.g., 5 for every 5 minutes).",
              "minimum": 1
            },
            "start_date": {
              "type": "string",
              "description": "The start date for price data (format: YYYY-MM-DD)."
            },
            "end_date": {
              "type": "string",
              "description": "The end date for price data (format: YYYY-MM-DD)."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of price records to return.",
              "default": 1000,
              "maximum": 5000,
              "minimum": 1
            }
          },
          "required": ["ticker", "interval", "interval_multiplier", "start_date", "end_date"]
        }
      },
      {
        "name": "get_crypto_snapshot",
        "description": "Get the current price snapshot for a cryptocurrency",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The cryptocurrency ticker symbol (e.g., BTC-USD)."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_earnings_press_releases",
        "description": "Get earnings press releases for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_financial_metrics",
        "description": "Get historical financial metrics for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data ('annual', 'quarterly', 'ttm').",
              "enum": ["annual", "quarterly", "ttm"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 4
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker", "period"]
        }
      },
      {
        "name": "get_financial_metrics_snapshot",
        "description": "Get current financial metrics snapshot for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_income_statements",
        "description": "Get income statements for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data ('annual', 'quarterly', 'ttm').",
              "enum": ["annual", "quarterly", "ttm"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 4
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker", "period"]
        }
      },
      {
        "name": "get_balance_sheets",
        "description": "Get balance sheets for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data ('annual', 'quarterly', 'ttm').",
              "enum": ["annual", "quarterly", "ttm"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 4
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker", "period"]
        }
      },
      {
        "name": "get_cash_flow_statements",
        "description": "Get cash flow statements for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data ('annual', 'quarterly', 'ttm').",
              "enum": ["annual", "quarterly", "ttm"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 4
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker", "period"]
        }
      },
      {
        "name": "get_all_financial_statements",
        "description": "Get all financial statements for a company in one call",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data ('annual', 'quarterly', 'ttm').",
              "enum": ["annual", "quarterly", "ttm"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of records to return.",
              "default": 4
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker", "period"]
        }
      },
      {
        "name": "get_insider_trades",
        "description": "Get insider trades (buys and sells) for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of trades to return.",
              "default": 100,
              "maximum": 1000
            },
            "filing_date_gte": {
              "type": "string",
              "description": "Filter for filing dates greater than or equal to date (format: YYYY-MM-DD)."
            },
            "filing_date_lte": {
              "type": "string",
              "description": "Filter for filing dates less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_institutional_ownership_by_investor",
        "description": "Get institutional ownership data by investor",
        "inputSchema": {
          "type": "object",
          "properties": {
            "investor": {
              "type": "string",
              "description": "The name of the investment manager (e.g., BERKSHIRE_HATHAWAY_INC)."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of holdings to return.",
              "default": 10
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["investor"]
        }
      },
      {
        "name": "get_institutional_ownership_by_ticker",
        "description": "Get institutional ownership data by ticker",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of institutional owners to return.",
              "default": 10
            },
            "report_period_gte": {
              "type": "string",
              "description": "Filter for report periods greater than or equal to date (format: YYYY-MM-DD)."
            },
            "report_period_lte": {
              "type": "string",
              "description": "Filter for report periods less than or equal to date (format: YYYY-MM-DD)."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_company_news",
        "description": "Get news articles for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "start_date": {
              "type": "string",
              "description": "The start date for news articles (format: YYYY-MM-DD)."
            },
            "end_date": {
              "type": "string",
              "description": "The end date for news articles (format: YYYY-MM-DD)."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of news articles to return.",
              "default": 100,
              "maximum": 100,
              "minimum": 1
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "search_financials",
        "description": "Search for financial data across income statements, balance sheets, and cash flow statements",
        "inputSchema": {
          "type": "object",
          "properties": {
            "search_type": {
              "type": "string",
              "description": "Type of search to perform: 'filters' for filtering by metrics or 'line_items' for retrieving specific data points.",
              "enum": ["filters", "line_items"]
            },
            "filters": {
              "type": "array",
              "description": "Array of filter objects to apply (required when search_type=filters).",
              "items": {
                "type": "object",
                "properties": {
                  "field": {
                    "type": "string",
                    "description": "The financial metric to filter on (e.g., revenue, total_debt, capital_expenditure)."
                  },
                  "operator": {
                    "type": "string",
                    "description": "The comparison operator.",
                    "enum": ["eq", "gt", "gte", "lt", "lte"]
                  },
                  "value": {
                    "type": "number",
                    "description": "The value to compare against."
                  }
                },
                "required": ["field", "operator", "value"]
              }
            },
            "line_items": {
              "type": "array",
              "description": "Array of financial metrics to retrieve (required when search_type=line_items).",
              "items": {
                "type": "string"
              }
            },
            "tickers": {
              "type": "array",
              "description": "Array of ticker symbols (required when search_type=line_items).",
              "items": {
                "type": "string"
              }
            },
            "period": {
              "type": "string",
              "description": "The time period for the financial data.",
              "enum": ["annual", "quarterly", "ttm"],
              "default": "ttm"
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of results to return.",
              "default": 100
            },
            "currency": {
              "type": "string",
              "description": "The currency for the financial data.",
              "enum": ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK"]
            },
            "order_by": {
              "type": "string",
              "description": "Field to order results by.",
              "enum": ["ticker", "-ticker", "report_period", "-report_period"],
              "default": "ticker"
            }
          },
          "required": ["search_type"]
        }
      },
      {
        "name": "get_stock_price_snapshot",
        "description": "Get the real-time price snapshot for a stock ticker",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            }
          },
          "required": ["ticker"]
        }
      },
      {
        "name": "get_stock_prices_advanced",
        "description": "Get ranged price data for a ticker with customizable intervals",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "interval": {
              "type": "string",
              "description": "The time interval for price data.",
              "enum": ["second", "minute", "day", "week", "month", "year"]
            },
            "interval_multiplier": {
              "type": "integer",
              "description": "The multiplier for the interval (e.g., 5 for every 5 minutes).",
              "minimum": 1
            },
            "start_date": {
              "type": "string",
              "description": "The start date for price data (format: YYYY-MM-DD)."
            },
            "end_date": {
              "type": "string",
              "description": "The end date for price data (format: YYYY-MM-DD)."
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of price records to return.",
              "default": 5000,
              "maximum": 5000,
              "minimum": 1
            }
          },
          "required": ["ticker", "interval", "interval_multiplier", "start_date", "end_date"]
        }
      },
      {
        "name": "get_sec_filing_items",
        "description": "Get specific sections (items) from a company's SEC filings",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "filing_type": {
              "type": "string",
              "description": "The type of filing to extract items from.",
              "enum": ["10-K", "10-Q"]
            },
            "year": {
              "type": "integer",
              "description": "The year of the filing."
            },
            "quarter": {
              "type": "integer",
              "description": "The quarter of the filing if 10-Q.",
              "minimum": 1,
              "maximum": 4
            },
            "items": {
              "type": "array",
              "description": "Specific items to extract from the filing. If not provided, all items are returned.",
              "items": {
                "type": "string",
                "enum": ["Item-1", "Item-1A", "Item-1B", "Item-2", "Item-3", "Item-4", "Item-5", "Item-6", "Item-7", "Item-7A", "Item-8", "Item-9", "Item-9A", "Item-9B", "Item-10", "Item-11", "Item-12", "Item-13", "Item-14", "Item-15", "Item-16"]
              }
            }
          },
          "required": ["ticker", "filing_type", "year"]
        }
      },
      {
        "name": "get_segmented_revenues",
        "description": "Get detailed, segmented revenue data for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "period": {
              "type": "string",
              "description": "The time period for the data.",
              "enum": ["annual", "quarterly"]
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of reports to return.",
              "default": 4
            }
          },
          "required": ["period"]
        }
      },
      {
        "name": "get_sec_filings",
        "description": "Get a list of SEC filings for a company",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company."
            },
            "cik": {
              "type": "string",
              "description": "Alternative: The CIK of the company."
            },
            "filing_type": {
              "type": "string",
              "description": "Type of filing to filter results.",
              "enum": ["10-K", "10-Q", "8-K", "4", "144"]
            }
          },
          "required": []
        }
      }
    ]
  };
});

/**
 * Handle tool calls to the financial API.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.log('Received call tool request: ' + JSON.stringify(request));
  
  // Ensure API client is initialized
  if (!apiClient) {
    if (!financialConfig) {
      throw new Error("Financial API client is not initialized. Please configure it before querying.");
    }
    apiClient = initApiClient(financialConfig);
  }
  
  switch (request.params.name) {
    case "get_company_facts": {
      const args = safeGetArgs(request.params.arguments, { ticker: '', cik: '' });
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/company/facts';
        if (args.ticker) {
          endpoint += `?ticker=${args.ticker}`;
        } else {
          endpoint += `?cik=${args.cik}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.company_facts, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get company facts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_stock_prices": {
      const args = safeGetArgs(request.params.arguments, { ticker: '', period: '1m', limit: 30 });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        // Use the correct Financial Datasets API endpoint for basic stock prices
        // This is a simplified version compared to get_stock_prices_advanced
        const response = await apiClient.get(`/prices/snapshot?ticker=${args.ticker}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.snapshot, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get stock prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "search_companies": {
      const args = safeGetArgs(request.params.arguments, { query: '', limit: 10 });
      
      if (!args.query) {
        throw new Error("Search query is required");
      }
      
      try {
        // Since Financial Datasets API doesn't have a dedicated company search endpoint,
        // we'll use the available tickers endpoint and filter the results
        // This is a workaround until a proper search endpoint is available
        const response = await apiClient.get('/company/facts/tickers/');
        const allTickers = response.data.tickers || [];
        
        // Simple search: filter tickers that contain the search query
        const searchQuery = args.query.toLowerCase();
        const matchingTickers = allTickers
          .filter((ticker: string) => ticker.toLowerCase().includes(searchQuery))
          .slice(0, args.limit);
        
        // For better search, you might want to use the search_financials endpoint instead
        const searchResults = {
          query: args.query,
          results: matchingTickers,
          total_found: matchingTickers.length,
          note: "This is a basic ticker symbol search. For more advanced company searching, consider using the search_financials tool with filters."
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(searchResults, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to search companies: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_crypto_prices": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        interval: '',
        interval_multiplier: 1,
        start_date: '',
        end_date: '',
        limit: 5000
      });
      
      // Validate required parameters
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      if (!args.interval) {
        throw new Error("Interval is required");
      }
      if (!args.interval_multiplier || args.interval_multiplier < 1) {
        throw new Error("Interval multiplier must be at least 1");
      }
      if (!args.start_date) {
        throw new Error("Start date is required");
      }
      if (!args.end_date) {
        throw new Error("End date is required");
      }
      
      try {
        const endpoint = `/crypto/prices/?ticker=${args.ticker}&interval=${args.interval}&interval_multiplier=${args.interval_multiplier}&start_date=${args.start_date}&end_date=${args.end_date}&limit=${args.limit}`;
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.prices, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get crypto prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_crypto_snapshot": {
      const args = safeGetArgs(request.params.arguments, { ticker: '' });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        const response = await apiClient.get(`/crypto/prices/snapshot?ticker=${args.ticker}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.snapshot, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get crypto snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_earnings_press_releases": {
      const args = safeGetArgs(request.params.arguments, { ticker: '' });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        const response = await apiClient.get(`/earnings/press-releases?ticker=${args.ticker}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.press_releases, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get earnings press releases: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_financial_metrics": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        period: 'annual', 
        limit: 4,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        let endpoint = `/financial-metrics?ticker=${args.ticker}&period=${args.period}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.financial_metrics, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get financial metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_financial_metrics_snapshot": {
      const args = safeGetArgs(request.params.arguments, { ticker: '' });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        const response = await apiClient.get(`/financial-metrics/snapshot?ticker=${args.ticker}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.snapshot, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get financial metrics snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_income_statements": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        cik: '',
        period: 'annual', 
        limit: 4,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/financials/income-statements?';
        
        if (args.ticker) {
          endpoint += `ticker=${args.ticker}`;
        } else {
          endpoint += `cik=${args.cik}`;
        }
        
        endpoint += `&period=${args.period}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.income_statements, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get income statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_balance_sheets": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        cik: '',
        period: 'annual', 
        limit: 4,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/financials/balance-sheets?';
        
        if (args.ticker) {
          endpoint += `ticker=${args.ticker}`;
        } else {
          endpoint += `cik=${args.cik}`;
        }
        
        endpoint += `&period=${args.period}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.balance_sheets, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get balance sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_cash_flow_statements": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        cik: '',
        period: 'annual', 
        limit: 4,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/financials/cash-flow-statements?';
        
        if (args.ticker) {
          endpoint += `ticker=${args.ticker}`;
        } else {
          endpoint += `cik=${args.cik}`;
        }
        
        endpoint += `&period=${args.period}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.cash_flow_statements, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get cash flow statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_all_financial_statements": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        cik: '',
        period: 'annual', 
        limit: 4,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/financials?';
        
        if (args.ticker) {
          endpoint += `ticker=${args.ticker}`;
        } else {
          endpoint += `cik=${args.cik}`;
        }
        
        endpoint += `&period=${args.period}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.financials, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get all financial statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_insider_trades": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        limit: 100,
        filing_date_gte: '',
        filing_date_lte: ''
      });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        let endpoint = `/insider-trades?ticker=${args.ticker}&limit=${args.limit}`;
        
        if (args.filing_date_gte) {
          endpoint += `&filing_date_gte=${args.filing_date_gte}`;
        }
        
        if (args.filing_date_lte) {
          endpoint += `&filing_date_lte=${args.filing_date_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.insider_trades, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get insider trades: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_institutional_ownership_by_investor": {
      const args = safeGetArgs(request.params.arguments, { 
        investor: '', 
        limit: 10,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.investor) {
        throw new Error("Investor name is required");
      }
      
      try {
        let endpoint = `/institutional-ownership?investor=${encodeURIComponent(args.investor)}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.institutional_ownership, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get institutional ownership data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_institutional_ownership_by_ticker": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        limit: 10,
        report_period_gte: '',
        report_period_lte: ''
      });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        let endpoint = `/institutional-ownership?ticker=${args.ticker}&limit=${args.limit}`;
        
        if (args.report_period_gte) {
          endpoint += `&report_period_gte=${args.report_period_gte}`;
        }
        
        if (args.report_period_lte) {
          endpoint += `&report_period_lte=${args.report_period_lte}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.institutional_ownership, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get institutional ownership data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_company_news": {
      const args = safeGetArgs(request.params.arguments, { 
        ticker: '', 
        start_date: '',
        end_date: '',
        limit: 100
      });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        let endpoint = `/news?ticker=${args.ticker}`;
        
        if (args.start_date) {
          endpoint += `&start_date=${args.start_date}`;
        }
        
        if (args.end_date) {
          endpoint += `&end_date=${args.end_date}`;
        }
        
        if (args.limit) {
          endpoint += `&limit=${args.limit}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.news, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get company news: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "search_financials": {
      const args = safeGetArgs(request.params.arguments, {
        search_type: '',
        filters: [],
        line_items: [],
        tickers: [],
        period: 'ttm',
        limit: 100,
        currency: 'USD',
        order_by: 'ticker'
      });
      
      if (!args.search_type) {
        throw new Error("Search type is required");
      }
      
      try {
        let endpoint = '';
        let requestBody = {};
        
        if (args.search_type === 'filters') {
          endpoint = '/financials/search';
          
          if (!Array.isArray(args.filters) || args.filters.length === 0) {
            throw new Error("At least one filter is required for filters search type");
          }
          
          requestBody = {
            filters: args.filters,
            period: args.period,
            limit: args.limit,
            currency: args.currency,
            order_by: args.order_by
          };
        } else if (args.search_type === 'line_items') {
          endpoint = '/financials/search/line-items';
          
          if (!Array.isArray(args.line_items) || args.line_items.length === 0) {
            throw new Error("At least one line item is required for line_items search type");
          }
          
          if (!Array.isArray(args.tickers) || args.tickers.length === 0) {
            throw new Error("At least one ticker is required for line_items search type");
          }
          
          requestBody = {
            line_items: args.line_items,
            tickers: args.tickers,
            period: args.period,
            limit: args.limit
          };
        } else {
          throw new Error(`Invalid search type: ${args.search_type}. Must be 'filters' or 'line_items'`);
        }
        
        const response = await apiClient.post(endpoint, requestBody);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.search_results, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to search financials: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_stock_price_snapshot": {
      const args = safeGetArgs(request.params.arguments, { ticker: '' });
      
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      
      try {
        const response = await apiClient.get(`/prices/snapshot?ticker=${args.ticker}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.snapshot, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get stock price snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_stock_prices_advanced": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        interval: '',
        interval_multiplier: 1,
        start_date: '',
        end_date: '',
        limit: 5000
      });
      
      // Validate required parameters
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      if (!args.interval) {
        throw new Error("Interval is required");
      }
      if (!args.interval_multiplier || args.interval_multiplier < 1) {
        throw new Error("Interval multiplier must be at least 1");
      }
      if (!args.start_date) {
        throw new Error("Start date is required");
      }
      if (!args.end_date) {
        throw new Error("End date is required");
      }
      
      try {
        const endpoint = `/prices/?ticker=${args.ticker}&interval=${args.interval}&interval_multiplier=${args.interval_multiplier}&start_date=${args.start_date}&end_date=${args.end_date}&limit=${args.limit}`;
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.prices, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get stock prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_sec_filing_items": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        filing_type: '',
        year: 0,
        quarter: 0,
        items: []
      });
      
      // Validate required parameters
      if (!args.ticker) {
        throw new Error("Ticker is required");
      }
      if (!args.filing_type) {
        throw new Error("Filing type is required");
      }
      if (!args.year || args.year <= 0) {
        throw new Error("Valid year is required");
      }
      
      // Validate quarter for 10-Q filings
      if (args.filing_type === '10-Q' && (!args.quarter || args.quarter < 1 || args.quarter > 4)) {
        throw new Error("Valid quarter (1-4) is required for 10-Q filings");
      }
      
      try {
        let endpoint = `/filings/items?ticker=${args.ticker}&filing_type=${args.filing_type}&year=${args.year}`;
        
        if (args.filing_type === '10-Q' && args.quarter) {
          endpoint += `&quarter=${args.quarter}`;
        }
        
        // Add specific items if provided
        if (Array.isArray(args.items) && args.items.length > 0) {
          args.items.forEach(item => {
            endpoint += `&item=${item}`;
          });
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get SEC filing items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_segmented_revenues": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        cik: '',
        period: '',
        limit: 4
      });
      
      // Validate required parameters
      if (!args.period) {
        throw new Error("Period is required (annual or quarterly)");
      }
      
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = `/financials/segmented-revenues/?period=${args.period}&limit=${args.limit}`;
        
        if (args.ticker) {
          endpoint += `&ticker=${args.ticker}`;
        } else if (args.cik) {
          endpoint += `&cik=${args.cik}`;
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.segmented_revenues, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get segmented revenues: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "get_sec_filings": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        cik: '',
        filing_type: ''
      });
      
      // Validate parameters
      if (!args.ticker && !args.cik) {
        throw new Error("Either ticker or CIK is required");
      }
      
      try {
        let endpoint = '/filings?';
        
        if (args.ticker) {
          endpoint += `ticker=${args.ticker}`;
        } else if (args.cik) {
          endpoint += `cik=${args.cik}`;
        }
        
        if (args.filing_type) {
          if (endpoint.endsWith('?')) {
            endpoint += `filing_type=${args.filing_type}`;
          } else {
            endpoint += `&filing_type=${args.filing_type}`;
          }
        }
        
        const response = await apiClient.get(endpoint);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.filings, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get SEC filings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

/**
 * List available prompts for financial analysis.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze_company",
        description: "Get a comprehensive analysis of a company",
        arguments: [
          {
            name: "ticker",
            description: "The ticker symbol of the company",
            required: true
          }
        ]
      },
      {
        name: "market_overview",
        description: "Get a market overview with key metrics and trends",
        arguments: []
      },
      {
        name: "analyze_crypto",
        description: "Get a comprehensive analysis of a cryptocurrency",
        arguments: [
          {
            name: "ticker",
            description: "The ticker symbol of the cryptocurrency (e.g., BTC-USD)",
            required: true
          }
        ]
      },
      {
        name: "analyze_financial_statements",
        description: "Get a comprehensive analysis of a company's financial statements",
        arguments: [
          {
            name: "ticker",
            description: "The ticker symbol of the company",
            required: true
          },
          {
            name: "period",
            description: "The time period for the data (annual, quarterly, ttm)",
            required: false
          }
        ]
      }
    ]
  };
});

/**
 * Handle prompt requests for financial analysis.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  logger.log('Received get prompt request: ' + JSON.stringify(request));
  
  const promptName = request.params.name;
  
  if (promptName === "analyze_company") {
    const ticker = request.params.arguments?.ticker || '';
    if (!ticker) {
      throw new Error("Ticker is required for company analysis");
    }
    
    try {
      const factResponse = await apiClient.get(`/company/facts?ticker=${ticker}`);
      const companyFacts = factResponse.data.company_facts;
      
      // This is hypothetical - assume we have price data endpoint
      const priceResponse = await apiClient.get(`/market/prices?ticker=${ticker}&period=1m&limit=30`);
      const priceData = priceResponse.data;
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the following company:
Ticker: ${ticker}

Company Information:
${JSON.stringify(companyFacts, null, 2)}

Recent Price History:
${JSON.stringify(priceData, null, 2)}`
            }
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "Provide a comprehensive financial analysis of this company, including its strengths, weaknesses, opportunities, and risks based on this data."
            }
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze company: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } 
  
  if (promptName === "market_overview") {
    // Hypothetical market overview data
    try {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a comprehensive market overview based on the latest data available.

Include:
1. Major market indices performance
2. Sector performance
3. Key economic indicators
4. Current market trends
5. Significant market events

Please make this analysis concise yet thorough, highlighting the most important factors affecting the markets today.`
            }
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get market overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (promptName === "analyze_crypto") {
    const ticker = request.params.arguments?.ticker || '';
    if (!ticker) {
      throw new Error("Ticker is required for cryptocurrency analysis");
    }
    
    try {
      // Get current snapshot
      const snapshotResponse = await apiClient.get(`/crypto/prices/snapshot?ticker=${ticker}`);
      const snapshot = snapshotResponse.data.snapshot;
      
      // Get historical prices - last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const formattedToday = today.toISOString().split('T')[0];
      const formattedThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];
      
      const pricesResponse = await apiClient.get(
        `/crypto/prices/?ticker=${ticker}&interval=day&interval_multiplier=1&start_date=${formattedThirtyDaysAgo}&end_date=${formattedToday}&limit=30`
      );
      const priceData = pricesResponse.data.prices;
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the following cryptocurrency:
Ticker: ${ticker}

Current Snapshot:
${JSON.stringify(snapshot, null, 2)}

Last 30 Days Price History:
${JSON.stringify(priceData, null, 2)}`
            }
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "Provide a comprehensive analysis of this cryptocurrency, including price trends, volatility, and major factors affecting its value. Compare its performance to major cryptocurrencies like Bitcoin and Ethereum where relevant."
            }
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze cryptocurrency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (promptName === "analyze_financial_statements") {
    const ticker = request.params.arguments?.ticker || '';
    const period = request.params.arguments?.period || 'annual';
    
    if (!ticker) {
      throw new Error("Ticker is required for financial statement analysis");
    }
    
    try {
      // Get company facts
      const factResponse = await apiClient.get(`/company/facts?ticker=${ticker}`);
      const companyFacts = factResponse.data.company_facts;
      
      // Get financial metrics
      const metricsResponse = await apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`);
      const metricsSnapshot = metricsResponse.data.snapshot;
      
      // Get financial statements
      const financialsResponse = await apiClient.get(`/financials?ticker=${ticker}&period=${period}&limit=3`);
      const financials = financialsResponse.data.financials;
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the financial statements and metrics for the following company:
Ticker: ${ticker}

Company Information:
${JSON.stringify(companyFacts, null, 2)}

Financial Metrics:
${JSON.stringify(metricsSnapshot, null, 2)}

Financial Statements (${period}):
${JSON.stringify(financials, null, 2)}`
            }
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on these financial statements and metrics, please provide:

1. A summary of the company's financial health
2. Analysis of revenue trends, profitability, and growth
3. Assessment of balance sheet strength and liquidity
4. Cash flow analysis
5. Key financial ratios interpretation
6. Noteworthy aspects of the financial statements
7. Areas of concern or potential red flags
8. Overall financial outlook`
            }
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze financial statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  throw new Error(`Unknown prompt: ${promptName}`);
});

/**
 * List templates for constructing financial data URIs.
 */
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        name: "company_profile",
        description: "Template for viewing a company's profile",
        uriTemplate: "financial://company/{ticker}",
        text: `This template is used to view a company's profile information.

The URI format follows this pattern:
financial://company/{ticker}

For example:
financial://company/AAPL

This will return information about the company including:
- Company name and ticker
- Industry and sector classification
- Market capitalization
- Number of employees
- Location
- SEC filings URL
- Website URL
and more.`
      },
      {
        name: "stock_prices",
        description: "Template for viewing stock price history",
        uriTemplate: "financial://prices/{ticker}/{period}",
        text: `This template is used to view historical stock prices.

The URI format follows this pattern:
financial://prices/{ticker}/{period}

For example:
financial://prices/AAPL/1m

Period options:
- 1d: One day
- 1w: One week
- 1m: One month
- 3m: Three months
- 6m: Six months
- 1y: One year
- 5y: Five years
- max: Maximum available history`
      },
      {
        name: "crypto_profile",
        description: "Template for viewing cryptocurrency data",
        uriTemplate: "financial://crypto/{ticker}",
        text: `This template is used to view current cryptocurrency price data.

The URI format follows this pattern:
financial://crypto/{ticker}

For example:
financial://crypto/BTC-USD

This will return the current price snapshot including:
- Current price
- Day change
- Day change percentage
- Latest time stamp`
      },
      {
        name: "crypto_prices",
        description: "Template for viewing cryptocurrency price history",
        uriTemplate: "financial://crypto/prices/{ticker}/{interval}/{interval_multiplier}",
        text: `This template is used to view historical cryptocurrency prices.

The URI format follows this pattern:
financial://crypto/prices/{ticker}/{interval}/{interval_multiplier}

For example:
financial://crypto/prices/BTC-USD/day/1

Interval options:
- minute: Minutes
- day: Days
- week: Weeks
- month: Months
- year: Years

The interval_multiplier specifies how many units of the interval (e.g., 5 for every 5 minutes).`
      },
      {
        name: "earnings_press_releases",
        description: "Template for viewing company earnings press releases",
        uriTemplate: "financial://earnings/{ticker}/press-releases",
        text: `This template is used to view earnings press releases for a company.

The URI format follows this pattern:
financial://earnings/{ticker}/press-releases

For example:
financial://earnings/AAPL/press-releases

This will return a list of press releases including:
- Title
- URL
- Date
- Text content`
      },
      {
        name: "financial_metrics",
        description: "Template for viewing company financial metrics",
        uriTemplate: "financial://metrics/{ticker}/{period}",
        text: `This template is used to view financial metrics for a company.

The URI format follows this pattern:
financial://metrics/{ticker}/{period}

For example:
financial://metrics/AAPL/annual

Period options:
- annual: Annual metrics
- quarterly: Quarterly metrics
- ttm: Trailing twelve months

This will return financial metrics including:
- Valuation metrics (P/E, P/B, EV/EBITDA)
- Profitability metrics (margins, ROE, ROA)
- Efficiency, Liquidity, and Leverage metrics
- Growth metrics and per-share figures`
      },
      {
        name: "financial_statements",
        description: "Template for viewing company financial statements",
        uriTemplate: "financial://financials/{ticker}/{statement_type}/{period}",
        text: `This template is used to view financial statements for a company.

The URI format follows this pattern:
financial://financials/{ticker}/{statement_type}/{period}

For example:
financial://financials/AAPL/income/annual

Statement type options:
- income: Income statements
- balance: Balance sheets
- cash-flow: Cash flow statements
- all: All statement types combined

Period options:
- annual: Annual statements
- quarterly: Quarterly statements
- ttm: Trailing twelve months

This will return detailed financial statement data.`
      }
    ]
  };
});

/**
 * Main function to initialize and run the MCP server
 */
async function main() {
  try {
    financialConfig = parseArgs();
    logger.log('Financial API configuration: ' + JSON.stringify(financialConfig));

    apiClient = initApiClient(financialConfig);
    logger.log('Financial API client initialized');

    try {
      // Test connection to API
      await apiClient.get('/company/facts/tickers/');
      logger.log('Financial API connection test successful');
    } catch (error) {
      logger.error('Financial API connection test failed:', error);
    }

    logger.log('Connecting to stdio transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.log('MCP server connected and ready');

  } catch (error) {
    logger.error('Error running MCP server:', error);
    process.exit(1);
  }
}

main().catch(err => logger.error('Unhandled error:', err));