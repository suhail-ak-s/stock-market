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
  ListResourceTemplatesRequestSchema,
  CompleteRequestSchema
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

/**
 * Helper function to recursively find text content in a response object
 */
function findTextInObject(obj: any): string | null {
  if (typeof obj === 'string') {
    return obj;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    // Check common text properties
    if (obj.text && typeof obj.text === 'string') {
      return obj.text;
    }
    if (obj.content && typeof obj.content === 'string') {
      return obj.content;
    }
    if (obj.message && typeof obj.message === 'string') {
      return obj.message;
    }
    
    // Recursively search in nested objects
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const result = findTextInObject(obj[key]);
        if (result) {
          return result;
        }
      }
    }
  }
  
  return null;
}

/**
 * Helper function to request LLM sampling from the client
 */
async function requestSampling(
  server: any, 
  messages: any[], 
  systemPrompt?: string, 
  modelPreferences?: any
): Promise<string> {
  console.log('🚀 [TRANSPORT] === STARTING SAMPLING REQUEST ===');
  
  try {
    logger.log('Initiating sampling request to client');
    
    const samplingParams = {
      messages,
      systemPrompt: systemPrompt || "You are a financial analysis expert. Provide clear, accurate, and actionable insights.",
      modelPreferences: modelPreferences || {
        hints: [
          { name: "claude-3-sonnet" },
          { name: "gpt-4" },
          { name: "claude" }
        ],
        intelligencePriority: 0.9,
        speedPriority: 0.6,
        costPriority: 0.4
      },
      maxTokens: 4000
    };
    
    logger.log('Sending sampling request with params: ' + JSON.stringify(samplingParams, null, 2));
    
    // TRANSPORT LOG: Sampling request being sent to client
    console.log('\n📡 [TRANSPORT] SENDING SAMPLING REQUEST TO CLIENT:');
    console.log('=====================================');
    console.log('Method: sampling/createMessage');
    console.log('Message Count:', samplingParams.messages.length);
    console.log('System Prompt Length:', samplingParams.systemPrompt?.length || 0, 'characters');
    console.log('Model Preferences:', JSON.stringify(samplingParams.modelPreferences, null, 2));
    console.log('Max Tokens:', samplingParams.maxTokens);
    console.log('Message Preview (first 200 chars):', samplingParams.messages[0]?.content?.text?.substring(0, 200) + '...');
    console.log('=====================================\n');
    
    // Send the sampling request to the client
    let response;
    try {
      console.log('🔄 [TRANSPORT] CALLING server.request() for sampling...');
      console.log('🔍 [TRANSPORT] Server object type:', typeof server);
      console.log('🔍 [TRANSPORT] Server has request method:', typeof server.request);
      console.log('🔍 [TRANSPORT] Server methods:', Object.getOwnPropertyNames(server));
      console.log('🔍 [TRANSPORT] Server prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(server)));
      console.log('🔍 [TRANSPORT] Server constructor name:', server.constructor.name);
      
      // Check available methods for sampling
      console.log('🔍 [TRANSPORT] Checking for sampling methods...');
      console.log('🔍 [TRANSPORT] server.request:', typeof server.request);
      console.log('🔍 [TRANSPORT] server.requestSampling:', typeof server.requestSampling);
      console.log('🔍 [TRANSPORT] server.createMessage:', typeof server.createMessage);
      console.log('🔍 [TRANSPORT] server.sendRequest:', typeof server.sendRequest);
      
      // Try different methods based on what's available
      let requestMethod = null;
      let methodName = '';
      
      if (typeof server.requestSampling === 'function') {
        requestMethod = server.requestSampling.bind(server);
        methodName = 'requestSampling';
      } else if (typeof server.createMessage === 'function') {
        requestMethod = server.createMessage.bind(server);
        methodName = 'createMessage';
      } else if (typeof server.sendRequest === 'function') {
        requestMethod = server.sendRequest.bind(server);
        methodName = 'sendRequest';
      } else if (typeof server.request === 'function') {
        requestMethod = server.request.bind(server);
        methodName = 'request';
      } else {
        console.error('❌ [TRANSPORT] Server does not have any request methods');
        throw new Error('Server instance does not support making requests to client');
      }
      
      console.log(`✅ [TRANSPORT] Using method: ${methodName}`);
      
      // Create the request object
      const requestObject = {
        method: "sampling/createMessage",
        params: samplingParams
      };
      
      console.log('📤 [TRANSPORT] Request object:', JSON.stringify(requestObject, null, 2));
      
      // Use the appropriate method based on what's available
      if (methodName === 'requestSampling') {
        console.log('🔄 [TRANSPORT] Using requestSampling method...');
        response = await requestMethod(samplingParams);
      } else if (methodName === 'createMessage') {
        console.log('🔄 [TRANSPORT] Using createMessage method...');
        response = await requestMethod(samplingParams);
      } else {
        console.log(`🔄 [TRANSPORT] Using ${methodName} method...`);
        response = await requestMethod(requestObject);
      }
      
      console.log('✅ [TRANSPORT] SAMPLING REQUEST COMPLETED SUCCESSFULLY');
      
    } catch (requestError) {
      console.error('❌ [TRANSPORT] SAMPLING REQUEST FAILED:', requestError);
      console.error('Error details:', {
        name: requestError instanceof Error ? requestError.name : 'Unknown',
        message: requestError instanceof Error ? requestError.message : String(requestError),
        stack: requestError instanceof Error ? requestError.stack : 'No stack trace'
      });
      
      // Check if it's the specific parsing error
      if (requestError instanceof Error && requestError.message.includes('Cannot read properties of undefined')) {
        console.error('🚨 [TRANSPORT] DETECTED PARSING ERROR - This might be an MCP SDK issue');
        console.error('Full error object:', JSON.stringify(requestError, null, 2));
        
        // For now, return a placeholder indicating sampling is not working
        console.log('⚠️ [TRANSPORT] SAMPLING NOT WORKING - RETURNING PLACEHOLDER');
        return "⚠️ **AI Analysis Not Available** ⚠️\n\nSampling request failed due to MCP SDK limitations. The server can send sampling requests to the client, but cannot receive the responses properly.\n\n**Technical Details:**\n- Client successfully receives sampling requests\n- Client generates LLM responses\n- Server fails to parse the response due to MCP SDK issue\n\n**Workaround needed:** This requires fixing the MCP transport layer or using a different approach for server-to-client sampling requests.";
      }
      
      throw new Error(`Sampling request failed: ${requestError instanceof Error ? requestError.message : 'Unknown error'}`);
    }
    
    // TRANSPORT LOG: Raw sampling response received from client
    console.log('\n🔄 [TRANSPORT] SAMPLING RESPONSE RECEIVED FROM CLIENT:');
    console.log('=====================================');
    console.log(JSON.stringify(response, null, 2));
    console.log('=====================================\n');
    
    logger.log('Received sampling response: ' + JSON.stringify(response));
    
    // Extract the text content from the response
    let extractedText: string;
    
    // Handle different possible response formats
    try {
      if (response && typeof response === 'object') {
        // Check for standard MCP sampling response format
        if (response.content && response.content.type === 'text' && response.content.text) {
          extractedText = response.content.text;
          console.log('📝 [TRANSPORT] EXTRACTED TEXT FROM SAMPLING RESPONSE (content.text):');
        }
        // Check for direct text property
        else if (response.text && typeof response.text === 'string') {
          extractedText = response.text;
          console.log('📝 [TRANSPORT] EXTRACTED TEXT FROM SAMPLING RESPONSE (.text):');
        }
        // Check for result property (some MCP implementations)
        else if (response.result && response.result.content && response.result.content.text) {
          extractedText = response.result.content.text;
          console.log('📝 [TRANSPORT] EXTRACTED TEXT FROM SAMPLING RESPONSE (result.content.text):');
        }
        // Check if response itself has the text directly
        else if (typeof response.content === 'string') {
          extractedText = response.content;
          console.log('📝 [TRANSPORT] EXTRACTED TEXT FROM SAMPLING RESPONSE (content as string):');
        }
        else {
          // Try to find any text property recursively
          const textValue = findTextInObject(response);
          if (textValue) {
            extractedText = textValue;
            console.log('📝 [TRANSPORT] EXTRACTED TEXT FROM SAMPLING RESPONSE (found recursively):');
          } else {
            console.error('❌ [TRANSPORT] NO TEXT FOUND IN SAMPLING RESPONSE:', JSON.stringify(response, null, 2));
            throw new Error('No text content found in sampling response');
          }
        }
      }
      // Handle string response
      else if (typeof response === 'string') {
        extractedText = response;
        console.log('📝 [TRANSPORT] RESPONSE IS STRING:');
      }
      else {
        console.error('❌ [TRANSPORT] UNEXPECTED SAMPLING RESPONSE FORMAT:', response);
        throw new Error('Received unexpected response format from sampling request');
      }
      
      // Log the extracted text details
      console.log('Text Length:', extractedText.length, 'characters');
      console.log('First 200 chars:', extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));
      console.log('Last 100 chars:', extractedText.length > 100 ? '...' + extractedText.substring(extractedText.length - 100) : extractedText);
      console.log('');
      
      return extractedText;
      
    } catch (parseError) {
      console.error('❌ [TRANSPORT] ERROR PARSING SAMPLING RESPONSE:', parseError);
      console.error('Raw response:', JSON.stringify(response, null, 2));
      throw new Error(`Failed to parse sampling response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
    }
    
  } catch (error) {
    logger.error('💥 [TRANSPORT] === SAMPLING REQUEST FAILED ===');
    logger.error('Error type:', typeof error);
    logger.error('Error constructor:', error?.constructor?.name);
    logger.error('Error message:', error instanceof Error ? error.message : String(error));
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    logger.error('Full error object:', JSON.stringify(error, null, 2));
    
    logger.error('Sampling request failed T:', error);
    throw new Error(`Failed to request LLM analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    console.log('🏁 [TRANSPORT] === SAMPLING REQUEST COMPLETE ===\n');
  }
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
        get: true,
        listChanged: true
      },
      completion: {
        complete: true
      },
      sampling: {
        createMessage: true
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

// === FRESH RESOURCES IMPLEMENTATION ===
// Following MCP 2025-06-18 specification exactly

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
      },
      {
        "name": "ai_financial_analysis",
        "description": "Get AI-powered financial analysis and insights using LLM sampling",
        "inputSchema": {
          "type": "object",
          "properties": {
            "ticker": {
              "type": "string",
              "description": "The ticker symbol of the company to analyze"
            },
            "analysis_type": {
              "type": "string",
              "description": "Type of analysis to perform",
              "enum": ["comprehensive", "valuation", "risks", "opportunities", "comparison"]
            },
            "context": {
              "type": "string",
              "description": "Additional context or specific questions for the analysis"
            }
          },
          "required": ["ticker", "analysis_type"]
        }
      },
      {
        "name": "ai_market_insights",
        "description": "Get AI-powered market insights and trend analysis using LLM sampling",
        "inputSchema": {
          "type": "object",
          "properties": {
            "focus_area": {
              "type": "string",
              "description": "Market focus area",
              "enum": ["overall_market", "sector_analysis", "economic_indicators", "risk_assessment"]
            },
            "tickers": {
              "type": "array",
              "description": "Optional list of ticker symbols to focus on",
              "items": {
                "type": "string"
              }
            },
            "context": {
              "type": "string",
              "description": "Specific questions or context for the market analysis"
            }
          },
          "required": ["focus_area"]
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
    
    case "ai_financial_analysis": {
      const args = safeGetArgs(request.params.arguments, {
        ticker: '',
        analysis_type: 'comprehensive',
        context: ''
      });
      
      if (!args.ticker) {
        throw new Error("Ticker is required for AI financial analysis");
      }
      
      try {
        // Gather comprehensive financial data
        const [factResponse, metricsResponse, priceResponse] = await Promise.all([
          apiClient.get(`/company/facts?ticker=${args.ticker}`),
          apiClient.get(`/financial-metrics/snapshot?ticker=${args.ticker}`),
          apiClient.get(`/prices/snapshot?ticker=${args.ticker}`)
        ]);
        
        const companyFacts = factResponse.data.company_facts;
        const metrics = metricsResponse.data.snapshot;
        const priceData = priceResponse.data.snapshot;
        
        // Prepare data for LLM analysis
        const analysisData = {
          company: companyFacts,
          metrics: metrics,
          price: priceData,
          analysisType: args.analysis_type,
          context: args.context
        };
        
        // Create messages for sampling
        const messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a ${args.analysis_type} financial analysis for ${args.ticker}.

**Company Data:**
${JSON.stringify(companyFacts, null, 2)}

**Financial Metrics:**
${JSON.stringify(metrics, null, 2)}

**Current Price Data:**
${JSON.stringify(priceData, null, 2)}

**Analysis Type:** ${args.analysis_type}
${args.context ? `**Additional Context:** ${args.context}` : ''}

Please provide detailed insights, key findings, and actionable recommendations.`
            }
          }
        ];
        
        // Request LLM sampling
        const analysis = await requestSampling(
          server,
          messages,
          `You are an expert financial analyst. Provide comprehensive, accurate, and actionable financial analysis based on the provided data. Focus on ${args.analysis_type} analysis and include specific numbers, ratios, and concrete recommendations.`,
          {
            hints: [
              { name: "claude-3-sonnet" },
              { name: "gpt-4" }
            ],
            intelligencePriority: 0.95, // High intelligence for complex financial analysis
            speedPriority: 0.4,
            costPriority: 0.3
          }
        );
        
        // TRANSPORT LOG: Log the AI analysis result
        console.log('\n🤖 [TRANSPORT] AI ANALYSIS RESULT FROM SAMPLING:');
        console.log('Analysis Length:', analysis.length, 'characters');
        console.log('Analysis Preview (first 300 chars):', analysis.substring(0, 300) + (analysis.length > 300 ? '...' : ''));
        console.log('');
        
        // Prepare the final tool response
        const toolResponse = {
          content: [{
            type: "text",
            text: `AI Financial Analysis for ${args.ticker} (${args.analysis_type}):\n\n${analysis}\n\n---\nData Sources: Company Facts, Financial Metrics, Current Price Data\nAnalysis Generated: ${new Date().toISOString()}`
          }]
        };
        
        // TRANSPORT LOG: Final tool response being sent to client
        console.log('📤 [TRANSPORT] FINAL TOOL RESPONSE BEING SENT TO CLIENT:');
        console.log('=====================================');
        console.log(JSON.stringify(toolResponse, null, 2));
        console.log('=====================================\n');
        
        return toolResponse;
        
      } catch (error) {
        throw new Error(`Failed to generate AI financial analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    case "ai_market_insights": {
      const args = safeGetArgs(request.params.arguments, {
        focus_area: 'overall_market',
        tickers: [],
        context: ''
      });
      
      try {
        let marketData = {};
        
        // Gather relevant market data based on focus area
        if (args.tickers && args.tickers.length > 0) {
          // Get data for specific tickers
          const tickerData: { [key: string]: { facts: any; metrics: any } } = {};
          for (const ticker of args.tickers.slice(0, 5)) { // Limit to 5 tickers
            try {
              const [factResp, metricsResp] = await Promise.all([
                apiClient.get(`/company/facts?ticker=${ticker}`),
                apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`)
              ]);
              tickerData[ticker] = {
                facts: factResp.data.company_facts,
                metrics: metricsResp.data.snapshot
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.log(`Failed to get data for ${ticker}: ${errorMessage}`);
            }
          }
          marketData = { specificTickers: tickerData };
        } else {
          // Get general market data
          try {
            const tickersResponse = await apiClient.get('/company/facts/tickers/');
            const availableTickers = (tickersResponse.data.tickers || []).slice(0, 10);
            marketData = { availableTickers, sampleSize: availableTickers.length };
          } catch (error) {
            marketData = { note: "General market data not available, providing analysis based on focus area" };
          }
        }
        
        // Create messages for sampling
        const messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide market insights and analysis focusing on: ${args.focus_area}

**Market Data:**
${JSON.stringify(marketData, null, 2)}

**Focus Area:** ${args.focus_area}
${args.context ? `**Additional Context:** ${args.context}` : ''}
${args.tickers?.length ? `**Specific Tickers:** ${args.tickers.join(', ')}` : ''}

Please provide comprehensive market analysis, trends, risks, and opportunities.`
            }
          }
        ];
        
        // Request LLM sampling
        const insights = await requestSampling(
          server,
          messages,
          `You are an expert market analyst. Provide comprehensive market insights covering current trends, sector analysis, risk assessment, and investment opportunities. Focus on ${args.focus_area} and provide actionable recommendations.`,
          {
            hints: [
              { name: "claude-3-sonnet" },
              { name: "gpt-4" }
            ],
            intelligencePriority: 0.9,
            speedPriority: 0.5,
            costPriority: 0.4
          }
        );
        
        // TRANSPORT LOG: Log the AI insights result
        console.log('\n🌍 [TRANSPORT] AI MARKET INSIGHTS RESULT FROM SAMPLING:');
        console.log('Insights Length:', insights.length, 'characters');
        console.log('Insights Preview (first 300 chars):', insights.substring(0, 300) + (insights.length > 300 ? '...' : ''));
        console.log('');
        
        // Prepare the final tool response
        const toolResponse = {
          content: [{
            type: "text",
            text: `AI Market Insights (${args.focus_area}):\n\n${insights}\n\n---\nAnalysis Focus: ${args.focus_area}\nData Coverage: ${args.tickers?.length || 'General Market'}\nGenerated: ${new Date().toISOString()}`
          }]
        };
        
        // TRANSPORT LOG: Final tool response being sent to client
        console.log('📤 [TRANSPORT] FINAL TOOL RESPONSE BEING SENT TO CLIENT:');
        console.log('=====================================');
        console.log(JSON.stringify(toolResponse, null, 2));
        console.log('=====================================\n');
        
        return toolResponse;
        
      } catch (error) {
        throw new Error(`Failed to generate AI market insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// ================================================================================
// RESOURCES IMPLEMENTATION - Following MCP 2025-06-18 Specification
// ================================================================================

/**
 * List available financial resources for context
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.log('📋 [RESOURCES] Received list resources request');
  
  try {
    // Get sample tickers for resources
    const stockTickers = await fetchAvailableTickers(10);
    const cryptoTickers = await fetchAvailableCryptoTickers(5);
    
    const resources = [
      // Stock Company Resources
      ...stockTickers.map(ticker => ({
        uri: `financial://company/${ticker}`,
        name: `${ticker} Company Profile`,
        title: `📈 ${ticker} Company Information`,
        description: `Complete company profile and facts for ${ticker}`,
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.7,
          lastModified: new Date().toISOString()
        }
      })),
      
      // Crypto Resources
      ...cryptoTickers.map(ticker => ({
        uri: `financial://crypto/${ticker}`,
        name: `${ticker} Crypto Data`,
        title: `₿ ${ticker} Cryptocurrency`,
        description: `Current price snapshot and data for ${ticker}`,
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.6,
          lastModified: new Date().toISOString()
        }
      })),
      
      // Market Overview Resource
      {
        uri: "financial://market/overview",
        name: "Market Overview",
        title: "🌍 Current Market Overview",
        description: "General market conditions and available tickers",
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.8,
          lastModified: new Date().toISOString()
        }
      },
      
      // Financial Analysis Guide
      {
        uri: "financial://guide/analysis",
        name: "Financial Analysis Guide",
        title: "📊 Financial Analysis Guide",
        description: "Guide to understanding financial metrics and analysis",
        mimeType: "text/markdown",
        annotations: {
          audience: ["user", "assistant"],
          priority: 0.9,
          lastModified: new Date().toISOString()
        }
      }
    ];
    
    logger.log(`📋 [RESOURCES] Returning ${resources.length} resources`);
    return { resources };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ [RESOURCES] Error listing resources:', error);
    throw new Error(`Failed to list resources: ${errorMessage}`);
  }
});

/**
 * Read specific financial resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  logger.log('📖 [RESOURCES] Received read resource request: ' + request.params.uri);
  
  try {
    const uri = request.params.uri;
    logger.log(`📖 [RESOURCES] Parsing URI: ${uri}`);
    
    const url = new URL(uri);
    // For custom schemes like financial://company/A, the host is 'company' and pathname is '/A'
    // So we need to combine host + pathname parts
    const resourceType = url.host; // 'company', 'crypto', 'market', 'guide'
    const pathParts = url.pathname.split('/').filter(Boolean); // ['A'] for '/A'
    
    logger.log(`📖 [RESOURCES] Resource type: "${resourceType}", Path parts: ${JSON.stringify(pathParts)}`);
    
    // Handle different resource types
    if (resourceType === 'company' && pathParts.length >= 1) {
      const ticker = pathParts[0]; // First path part is the ticker
      
      logger.log(`📈 [RESOURCES] Fetching company data for ${ticker}`);
      
      try {
        // Get comprehensive company data
        const [factsResponse, metricsResponse, priceResponse] = await Promise.all([
          apiClient.get(`/company/facts?ticker=${ticker}`),
          apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`),
          apiClient.get(`/prices/snapshot?ticker=${ticker}`)
        ]);
        
        const companyData = {
          company_facts: factsResponse.data.company_facts,
          financial_metrics: metricsResponse.data.snapshot,
          current_price: priceResponse.data.snapshot,
          last_updated: new Date().toISOString()
        };
        
        return {
          contents: [{
            uri: uri,
            name: `${ticker} Company Profile`,
            title: `📈 ${ticker} Complete Company Data`,
            mimeType: "application/json",
            text: JSON.stringify(companyData, null, 2),
            annotations: {
              audience: ["assistant"],
              priority: 0.8,
              lastModified: new Date().toISOString()
            }
          }]
        };
      } catch (apiError) {
        logger.error(`❌ [RESOURCES] API error for ticker ${ticker}:`, apiError);
        logger.log(`📈 [RESOURCES] Returning error response for invalid ticker: ${ticker}`);
        
        // Return a helpful error message for invalid tickers
        return {
          contents: [{
            uri: uri,
            name: `${ticker} - Not Found`,
            title: `❌ ${ticker} - Invalid Ticker Symbol`,
            mimeType: "text/plain",
            text: `The ticker symbol "${ticker}" is not valid or not available in our database. Please check the ticker symbol and try again.`,
            annotations: {
              audience: ["assistant"],
              priority: 0.1,
              lastModified: new Date().toISOString()
            }
          }]
        };
      }
    }
    
    else if (resourceType === 'crypto' && pathParts.length >= 1) {
      // Handle crypto tickers that may contain hyphens (e.g., 1INCH-USD)
      const ticker = pathParts.join('/'); // Join all path parts for complex tickers
      
      logger.log(`₿ [RESOURCES] Fetching crypto data for ${ticker}`);
      
      try {
        const response = await apiClient.get(`/crypto/prices/snapshot?ticker=${ticker}`);
        const cryptoData = {
          snapshot: response.data.snapshot,
          last_updated: new Date().toISOString()
        };
        
        return {
          contents: [{
            uri: uri,
            name: `${ticker} Crypto Data`,
            title: `₿ ${ticker} Cryptocurrency Data`,
            mimeType: "application/json",
            text: JSON.stringify(cryptoData, null, 2),
            annotations: {
              audience: ["assistant"],
              priority: 0.7,
              lastModified: new Date().toISOString()
            }
          }]
        };
      } catch (apiError) {
        logger.error(`❌ [RESOURCES] API error for crypto ticker ${ticker}:`, apiError);
        
        // Return a helpful error message for invalid crypto tickers
        return {
          contents: [{
            uri: uri,
            name: `${ticker} - Not Found`,
            title: `❌ ${ticker} - Invalid Crypto Symbol`,
            mimeType: "text/plain",
            text: `The cryptocurrency symbol "${ticker}" is not valid or not available in our database. Please check the symbol and try again.`,
            annotations: {
              audience: ["assistant"],
              priority: 0.1,
              lastModified: new Date().toISOString()
            }
          }]
        };
      }
    }
    
    else if (resourceType === 'market' && pathParts[0] === 'overview') {
      logger.log('🌍 [RESOURCES] Fetching market overview');
      
      const [stockTickers, cryptoTickers] = await Promise.all([
        fetchAvailableTickers(20),
        fetchAvailableCryptoTickers(10)
      ]);
      
      const marketOverview = {
        available_stocks: stockTickers,
        available_crypto: cryptoTickers,
        total_stocks: stockTickers.length,
        total_crypto: cryptoTickers.length,
        last_updated: new Date().toISOString(),
        market_status: "Data available for analysis"
      };
      
      return {
        contents: [{
          uri: uri,
          name: "Market Overview",
          title: "🌍 Current Market Overview",
          mimeType: "application/json",
          text: JSON.stringify(marketOverview, null, 2),
          annotations: {
            audience: ["assistant"],
            priority: 0.9,
            lastModified: new Date().toISOString()
          }
        }]
      };
    }
    
    else if (resourceType === 'guide' && pathParts[0] === 'analysis') {
      logger.log('📊 [RESOURCES] Providing financial analysis guide');
      
      const analysisGuide = `# Financial Analysis Guide

## Key Financial Metrics

### Valuation Metrics
- **P/E Ratio**: Price-to-Earnings ratio indicates valuation relative to earnings
- **P/B Ratio**: Price-to-Book ratio shows valuation relative to book value
- **EV/EBITDA**: Enterprise Value to EBITDA for operational valuation

### Profitability Metrics
- **Gross Margin**: (Revenue - COGS) / Revenue
- **Operating Margin**: Operating Income / Revenue
- **Net Margin**: Net Income / Revenue
- **ROE**: Return on Equity measures shareholder returns
- **ROA**: Return on Assets measures asset efficiency

### Liquidity & Solvency
- **Current Ratio**: Current Assets / Current Liabilities
- **Quick Ratio**: (Current Assets - Inventory) / Current Liabilities
- **Debt-to-Equity**: Total Debt / Total Equity

### Growth Metrics
- **Revenue Growth**: Year-over-year revenue change
- **Earnings Growth**: Year-over-year earnings change
- **Free Cash Flow Growth**: FCF trend analysis

## Analysis Framework

1. **Company Overview**: Industry, business model, competitive position
2. **Financial Health**: Profitability, liquidity, solvency analysis
3. **Growth Prospects**: Revenue trends, market opportunities
4. **Valuation**: Relative and absolute valuation metrics
5. **Risk Assessment**: Business, financial, and market risks

## Using This Server's Tools

- Use \`get_company_facts\` for basic company information
- Use \`get_financial_metrics\` for key ratios and metrics
- Use \`get_stock_prices\` for price and performance data
- Use \`ai_financial_analysis\` for comprehensive AI-powered analysis

Last Updated: ${new Date().toISOString()}`;
      
      return {
        contents: [{
          uri: uri,
          name: "Financial Analysis Guide",
          title: "📊 Financial Analysis Guide",
          mimeType: "text/markdown",
          text: analysisGuide,
          annotations: {
            audience: ["user", "assistant"],
            priority: 1.0,
            lastModified: new Date().toISOString()
          }
        }]
      };
    }
    
    else {
      throw new Error(`Unknown resource URI format: ${uri}`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ [RESOURCES] Error reading resource:', error);
    throw new Error(`Failed to read resource: ${errorMessage}`);
  }
});

/**
 * List available resource templates
 */
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  logger.log('📋 [RESOURCES] Received list resource templates request');
  
  return {
    resourceTemplates: [
      {
        uriTemplate: "financial://company/{ticker}",
        name: "Company Profile",
        title: "📈 Company Profile",
        description: "Complete company information including facts, metrics, and current price",
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.8
        }
      },
      {
        uriTemplate: "financial://crypto/{ticker}",
        name: "Cryptocurrency Data",
        title: "₿ Cryptocurrency Data", 
        description: "Current cryptocurrency price snapshot and market data",
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.7
        }
      },
      {
        uriTemplate: "financial://market/overview",
        name: "Market Overview",
        title: "🌍 Market Overview",
        description: "Current market conditions and available securities",
        mimeType: "application/json",
        annotations: {
          audience: ["assistant"],
          priority: 0.9
        }
      },
      {
        uriTemplate: "financial://guide/analysis",
        name: "Analysis Guide",
        title: "📊 Financial Analysis Guide",
        description: "Comprehensive guide to financial analysis and metrics",
        mimeType: "text/markdown",
        annotations: {
          audience: ["user", "assistant"],
          priority: 1.0
        }
      }
    ]
  };
});

/**
 * List available prompts for financial analysis.
 * Following MCP 2025-06-18 specification format.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze-stock",
        title: "📈 Analyze Stock",
        description: "Analyze a company's financial health, performance metrics, and market position with comprehensive data",
        arguments: [
          {
            name: "ticker",
            description: "The stock ticker symbol (e.g., AAPL, MSFT, GOOGL)",
            required: true
          },
          {
            name: "analysis_depth",
            description: "Level of analysis detail: basic, detailed, or comprehensive",
            required: false
          }
        ]
      },
      {
        name: "market-overview",
        title: "🌍 Market Overview",
        description: "Get current market conditions, trends, and key economic indicators affecting the financial markets",
        arguments: [
          {
            name: "market_focus",
            description: "Specific market focus: general, tech, healthcare, finance, energy, or all_sectors",
            required: false
          }
        ]
      },
      {
        name: "analyze-crypto", 
        title: "₿ Analyze Crypto",
        description: "Comprehensive analysis of cryptocurrency price trends, volatility, and market factors",
        arguments: [
          {
            name: "crypto_ticker",
            description: "The cryptocurrency ticker symbol (e.g., BTC-USD, ETH-USD, SOL-USD)",
            required: true
          },
          {
            name: "timeframe",
            description: "Analysis timeframe: 7d, 30d, 90d, or 1y",
            required: false
          }
        ]
      },
      {
        name: "financial-statements",
        title: "📊 Financial Statements",
        description: "In-depth analysis of income statements, balance sheets, and cash flow statements",
        arguments: [
          {
            name: "ticker",
            description: "The stock ticker symbol for financial statement analysis",
            required: true
          },
          {
            name: "period",
            description: "Reporting period: annual, quarterly, or ttm (trailing twelve months)",
            required: false
          },
          {
            name: "years_back",
            description: "Number of years of historical data to include (1-5)",
            required: false
          }
        ]
      },
      {
        name: "investment-research",
        title: "🔍 Investment Research",
        description: "Complete investment research including valuation, risks, opportunities, and recommendations",
        arguments: [
          {
            name: "ticker",
            description: "The stock ticker symbol for investment research",
            required: true
          },
          {
            name: "investment_horizon",
            description: "Investment timeframe: short_term, medium_term, or long_term",
            required: false
          }
        ]
      },
      {
        name: "compare-stocks",
        title: "⚖️ Compare Stocks",
        description: "Compare companies within the same sector or against market benchmarks",
        arguments: [
          {
            name: "primary_ticker",
            description: "Primary company ticker for comparison",
            required: true
          },
          {
            name: "comparison_tickers",
            description: "Comma-separated list of peer company tickers to compare against",
            required: false
          },
          {
            name: "metrics_focus",
            description: "Focus metrics: valuation, growth, profitability, or efficiency",
            required: false
          }
        ]
      },
      {
        name: "investment-committee-analysis",
        title: "🏛️ Investment Committee Analysis",
        description: "Comprehensive investment analysis for committee presentation including company evaluation, peer comparison, market context, and investment recommendation.",
        arguments: [
          {
            name: "target_company",
            description: "Primary company ticker for investment analysis (default: AAPL)",
            required: false
          },
          {
            name: "peer_companies",
            description: "Comma-separated peer company tickers for comparison (default: MSFT,GOOGL)",
            required: false
          },
          {
            name: "investment_amount",
            description: "Proposed investment amount in millions USD (default: 50)",
            required: false
          },
          {
            name: "time_horizon",
            description: "Investment time horizon: short_term, medium_term, or long_term (default: medium_term)",
            required: false
          }
        ]
      }
    ]
  };
});

/**
 * Handle prompt requests for financial analysis.
 * Following MCP 2025-06-18 specification format.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  logger.log('Received get prompt request: ' + JSON.stringify(request));
  
  const promptName = request.params.name;
  const args = request.params.arguments || {};
  
  switch (promptName) {
    case "analyze-stock": {
      const ticker = args.ticker;
      const analysisDepth = args.analysis_depth || 'detailed';
      
      if (!ticker) {
        throw new Error("Ticker is required for company analysis");
      }
      
      try {
        // Get company facts
        const factResponse = await apiClient.get(`/company/facts?ticker=${ticker}`);
        const companyFacts = factResponse.data.company_facts;
        
        // Get financial metrics snapshot
        const metricsResponse = await apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`);
        const metricsSnapshot = metricsResponse.data.snapshot;
        
        // Get stock price snapshot
        const priceResponse = await apiClient.get(`/prices/snapshot?ticker=${ticker}`);
        const priceSnapshot = priceResponse.data.snapshot;
        
        return {
          description: `Company analysis for ${ticker}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Perform a ${analysisDepth} financial analysis for ${ticker} based on the following data:

**Company Overview:**
${JSON.stringify(companyFacts, null, 2)}

**Current Financial Metrics:**
${JSON.stringify(metricsSnapshot, null, 2)}

**Current Stock Price:**
${JSON.stringify(priceSnapshot, null, 2)}`
              }
            },
            {
              role: "user", 
              content: {
                type: "text",
                text: `Please provide a comprehensive analysis covering:

1. **Company Overview & Business Model**
2. **Financial Performance Analysis**
   - Revenue trends and growth
   - Profitability metrics
   - Efficiency ratios
3. **Financial Health Assessment**
   - Liquidity position
   - Debt levels and capital structure
   - Cash flow analysis
4. **Valuation Analysis**
   - P/E, P/B, and other valuation multiples
   - Comparison to industry averages
5. **Investment Perspective**
   - Strengths and competitive advantages
   - Risks and concerns
   - Overall investment thesis

Format your analysis with clear sections and bullet points for key insights.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to analyze company: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "market-overview": {
      const marketFocus = args.market_focus || 'general';
      
      try {
        // Get some sample tickers for market overview
        const tickersResponse = await apiClient.get('/company/facts/tickers/');
        const sampleTickers = (tickersResponse.data.tickers || []).slice(0, 5);
        
        return {
          description: `Market overview with focus on ${marketFocus}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Provide a comprehensive market overview focusing on ${marketFocus === 'general' ? 'overall market conditions' : `the ${marketFocus} sector`}.

**Available Market Data:**
Sample major tickers: ${sampleTickers.join(', ')}

Please analyze and discuss:`
              }
            },
            {
              role: "user",
              content: {
                type: "text", 
                text: `**Market Analysis Framework:**

1. **Current Market Environment**
   - Overall market sentiment and direction
   - Key market drivers and themes
   - Economic indicators impact

2. **Sector Performance** ${marketFocus !== 'general' ? `(Focus: ${marketFocus})` : ''}
   - Leading and lagging sectors
   - Sector rotation trends
   - Industry-specific developments

3. **Key Market Metrics**
   - Volatility levels
   - Trading volumes
   - Market breadth indicators

4. **Risk Factors & Opportunities**
   - Geopolitical influences
   - Monetary policy impacts
   - Emerging trends and opportunities

5. **Outlook & Recommendations**
   - Short-term market direction
   - Investment themes to watch
   - Risk management considerations

Please provide specific insights and actionable information for investors.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to get market overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "analyze-crypto": {
      const cryptoTicker = args.crypto_ticker;
      const timeframe = args.timeframe || '30d';
      
      if (!cryptoTicker) {
        throw new Error("Crypto ticker is required for cryptocurrency analysis");
      }
      
      try {
        // Get current snapshot
        const snapshotResponse = await apiClient.get(`/crypto/prices/snapshot?ticker=${cryptoTicker}`);
        const snapshot = snapshotResponse.data.snapshot;
        
        // Calculate date range based on timeframe
        const today = new Date();
        const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(today.getDate() - daysBack);
        
        const formattedToday = today.toISOString().split('T')[0];
        const formattedStartDate = startDate.toISOString().split('T')[0];
        
        // Get historical prices
        const pricesResponse = await apiClient.get(
          `/crypto/prices/?ticker=${cryptoTicker}&interval=day&interval_multiplier=1&start_date=${formattedStartDate}&end_date=${formattedToday}&limit=1000`
        );
        const priceData = pricesResponse.data.prices;
        
        return {
          description: `Cryptocurrency analysis for ${cryptoTicker} over ${timeframe}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Analyze ${cryptoTicker} cryptocurrency over the ${timeframe} timeframe:

**Current Market Data:**
${JSON.stringify(snapshot, null, 2)}

**Historical Price Data (${timeframe}):**
${JSON.stringify(priceData, null, 2)}`
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide a comprehensive cryptocurrency analysis including:

1. **Price Performance Analysis**
   - Price trends and momentum over ${timeframe}
   - Key support and resistance levels
   - Volatility assessment

2. **Technical Analysis**
   - Chart patterns and technical indicators
   - Trading volume analysis
   - Momentum indicators

3. **Market Context**
   - Performance vs Bitcoin and Ethereum
   - Correlation with traditional markets
   - Market cap ranking and dominance

4. **Fundamental Factors**
   - Technology and use case analysis
   - Adoption metrics and partnerships
   - Regulatory environment impact

5. **Risk Assessment**
   - Volatility risks
   - Liquidity considerations
   - Regulatory and technical risks

6. **Investment Outlook**
   - Short and medium-term price outlook
   - Key catalysts to watch
   - Risk/reward assessment

Focus on actionable insights for crypto investors and traders.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to analyze cryptocurrency: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "financial-statements": {
      const ticker = args.ticker;
      const period = args.period || 'annual';
      const yearsBack = parseInt(args.years_back) || 3;
      
      if (!ticker) {
        throw new Error("Ticker is required for financial statements analysis");
      }
      
      try {
        // Get company facts
        const factResponse = await apiClient.get(`/company/facts?ticker=${ticker}`);
        const companyFacts = factResponse.data.company_facts;
        
        // Get all financial statements
        const financialsResponse = await apiClient.get(`/financials?ticker=${ticker}&period=${period}&limit=${yearsBack}`);
        const financials = financialsResponse.data.financials;
        
        // Get financial metrics
        const metricsResponse = await apiClient.get(`/financial-metrics?ticker=${ticker}&period=${period}&limit=${yearsBack}`);
        const metrics = metricsResponse.data.financial_metrics;
        
        return {
          description: `Financial statements analysis for ${ticker} (${period}, ${yearsBack} years)`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Analyze the financial statements for ${ticker} over the past ${yearsBack} years (${period} periods):

**Company Information:**
${JSON.stringify(companyFacts, null, 2)}

**Financial Statements (${period}):**
${JSON.stringify(financials, null, 2)}

**Financial Metrics (${period}):**
${JSON.stringify(metrics, null, 2)}`
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide an in-depth financial statements analysis covering:

**1. Income Statement Analysis**
- Revenue growth trends and sustainability
- Gross, operating, and net margin analysis
- Expense management and cost structure
- Earnings quality and recurring vs. non-recurring items

**2. Balance Sheet Analysis**
- Asset composition and quality
- Capital structure and debt analysis
- Working capital management
- Shareholder equity trends

**3. Cash Flow Statement Analysis**
- Operating cash flow generation and quality
- Capital allocation decisions
- Free cash flow trends
- Cash flow coverage ratios

**4. Financial Ratios & Metrics**
- Profitability ratios (ROE, ROA, ROIC)
- Efficiency ratios (asset turnover, inventory turnover)
- Liquidity ratios (current ratio, quick ratio)
- Leverage ratios (debt-to-equity, interest coverage)

**5. Trend Analysis & Red Flags**
- Multi-year trend identification
- Potential accounting red flags
- Seasonal or cyclical patterns
- Management guidance vs. actual performance

**6. Financial Health Assessment**
- Overall financial strength rating
- Key areas of concern or improvement
- Comparison to industry benchmarks
- Future outlook based on financial trends

Provide specific numbers, percentages, and actionable insights throughout the analysis.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to analyze financial statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "investment-research": {
      const ticker = args.ticker;
      const investmentHorizon = args.investment_horizon || 'medium_term';
      
      if (!ticker) {
        throw new Error("Ticker is required for investment research");
      }
      
      try {
        // Get comprehensive data
        const [factResponse, metricsResponse, priceResponse, newsResponse] = await Promise.all([
          apiClient.get(`/company/facts?ticker=${ticker}`),
          apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`),
          apiClient.get(`/prices/snapshot?ticker=${ticker}`),
          apiClient.get(`/news?ticker=${ticker}&limit=10`)
        ]);
        
        const companyFacts = factResponse.data.company_facts;
        const metrics = metricsResponse.data.snapshot;
        const priceData = priceResponse.data.snapshot;
        const news = newsResponse.data.news;
        
        return {
          description: `Investment research report for ${ticker} (${investmentHorizon})`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Prepare a comprehensive investment research report for ${ticker} with a ${investmentHorizon.replace('_', ' ')} investment horizon:

**Company Data:**
${JSON.stringify(companyFacts, null, 2)}

**Financial Metrics:**
${JSON.stringify(metrics, null, 2)}

**Current Price Data:**
${JSON.stringify(priceData, null, 2)}

**Recent News:**
${JSON.stringify(news, null, 2)}`
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide a complete investment research report structured as follows:

**EXECUTIVE SUMMARY**
- Investment recommendation (Buy/Hold/Sell)
- Target price and expected return
- Key investment thesis points
- Major risks and catalysts

**COMPANY ANALYSIS**
- Business model and competitive position
- Market opportunity and industry dynamics
- Management quality and strategy
- ESG considerations

**FINANCIAL ANALYSIS**
- Revenue and earnings growth prospects
- Margin trends and profitability
- Balance sheet strength and capital allocation
- Cash generation and dividend policy

**VALUATION ANALYSIS**
- Multiple-based valuation (P/E, EV/EBITDA, P/B)
- DCF analysis considerations
- Peer comparison and industry multiples
- Historical valuation ranges

**RISK ASSESSMENT**
- Company-specific risks
- Industry and market risks
- Regulatory and competitive threats
- Scenario analysis (bull/base/bear cases)

**INVESTMENT RECOMMENDATION**
- ${investmentHorizon.replace('_', ' ')} outlook and price target
- Portfolio fit and position sizing
- Key milestones and catalysts to monitor
- Exit strategy considerations

**APPENDIX**
- Key financial metrics summary
- Peer comparison table
- Recent news impact analysis

Tailor the analysis depth and focus to the ${investmentHorizon.replace('_', ' ')} investment timeframe.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to generate investment research: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "compare-stocks": {
      const primaryTicker = args.primary_ticker;
      const comparisonTickers = args.comparison_tickers ? args.comparison_tickers.split(',').map(t => t.trim()) : [];
      const metricsFocus = args.metrics_focus || 'comprehensive';
      
      if (!primaryTicker) {
        throw new Error("Primary ticker is required for sector comparison");
      }
      
      try {
        // Get data for primary company
        const primaryFactsResponse = await apiClient.get(`/company/facts?ticker=${primaryTicker}`);
        const primaryFacts = primaryFactsResponse.data.company_facts;
        
        const primaryMetricsResponse = await apiClient.get(`/financial-metrics/snapshot?ticker=${primaryTicker}`);
        const primaryMetrics = primaryMetricsResponse.data.snapshot;
        
        // Get comparison data if tickers provided
        let comparisonData: { [key: string]: { facts: any; metrics: any } } = {};
        if (comparisonTickers.length > 0) {
          for (const ticker of comparisonTickers.slice(0, 5)) { // Limit to 5 peers
            try {
              const [factsResp, metricsResp] = await Promise.all([
                apiClient.get(`/company/facts?ticker=${ticker}`),
                apiClient.get(`/financial-metrics/snapshot?ticker=${ticker}`)
              ]);
              comparisonData[ticker] = {
                facts: factsResp.data.company_facts,
                metrics: metricsResp.data.snapshot
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.log(`Failed to get data for ${ticker}: ${errorMessage}`);
            }
          }
        }
        
        return {
          description: `Sector comparison for ${primaryTicker} focusing on ${metricsFocus}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Perform a sector and peer comparison analysis for ${primaryTicker} with focus on ${metricsFocus} metrics:

**Primary Company (${primaryTicker}):**
Company Facts: ${JSON.stringify(primaryFacts, null, 2)}
Financial Metrics: ${JSON.stringify(primaryMetrics, null, 2)}

**Peer Comparison Data:**
${Object.keys(comparisonData).length > 0 ? JSON.stringify(comparisonData, null, 2) : 'No peer data provided - please analyze against industry averages'}`
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide a comprehensive sector and peer comparison analysis:

**1. SECTOR OVERVIEW**
- Industry classification and characteristics
- Sector growth trends and dynamics
- Key industry drivers and challenges
- Regulatory environment

**2. PEER GROUP ANALYSIS** ${comparisonTickers.length > 0 ? `(vs ${comparisonTickers.join(', ')})` : '(vs industry averages)'}
- Market position and size comparison
- Business model similarities and differences
- Geographic and product diversification

**3. FINANCIAL METRICS COMPARISON** (Focus: ${metricsFocus})
${metricsFocus === 'valuation' || metricsFocus === 'comprehensive' ? `
**Valuation Metrics:**
- P/E, P/B, EV/EBITDA ratios
- PEG ratio and growth-adjusted valuations
- Price-to-sales and enterprise value multiples
- Dividend yield comparison` : ''}

${metricsFocus === 'growth' || metricsFocus === 'comprehensive' ? `
**Growth Metrics:**
- Revenue growth rates (1Y, 3Y, 5Y)
- Earnings growth sustainability
- Market share trends
- Geographic expansion rates` : ''}

${metricsFocus === 'profitability' || metricsFocus === 'comprehensive' ? `
**Profitability Metrics:**
- Gross, operating, and net margins
- Return on equity (ROE) and assets (ROA)
- Return on invested capital (ROIC)
- Profit margin stability` : ''}

${metricsFocus === 'efficiency' || metricsFocus === 'comprehensive' ? `
**Efficiency Metrics:**
- Asset turnover ratios
- Working capital management
- Inventory and receivables turnover
- Capital allocation efficiency` : ''}

**4. COMPETITIVE POSITIONING**
- Relative strengths and weaknesses
- Competitive advantages and moats
- Market share and competitive threats
- Innovation and R&D capabilities

**5. INVESTMENT IMPLICATIONS**
- Relative valuation attractiveness
- Risk-adjusted return potential
- Sector rotation considerations
- Best-in-class investment picks

**6. KEY TAKEAWAYS**
- ${primaryTicker}'s ranking within peer group
- Most attractive investment opportunities
- Key risks and red flags by company
- Sector outlook and recommendations

Provide specific numerical comparisons and rank companies where possible.`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to generate sector comparison: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    case "investment-committee-analysis": {
      const targetCompany = args.target_company || 'AAPL';
      const peerCompanies = (args.peer_companies || 'MSFT,GOOGL').split(',').map(t => t.trim());
      const investmentAmount = args.investment_amount || '50';
      const timeHorizon = args.time_horizon || 'medium_term';
      
      logger.log(`🏛️ [INVESTMENT] Creating investment committee analysis for ${targetCompany}`);
      
      const analysisPrompt = `# 🏛️ INVESTMENT COMMITTEE ANALYSIS

You are preparing a comprehensive investment analysis for the Investment Committee meeting. The committee is considering a ${investmentAmount}M investment in **${targetCompany}** with a **${timeHorizon}** investment horizon.

## 📊 REQUIRED ANALYSIS WORKFLOW

### **PHASE 1: TARGET COMPANY DEEP DIVE**
Conduct thorough analysis of **${targetCompany}**:

1. **Company Fundamentals:**
   - Use \`get_company_facts\` to gather company background, business model, and key metrics
   - Use \`get_financial_metrics\` to analyze profitability, valuation, and financial health ratios
   - Use \`get_prices_snapshot\` to assess current market valuation and recent performance

2. **Access Company Resource:**
   - Read \`financial://company/${targetCompany}\` resource for comprehensive company data context

### **PHASE 2: COMPETITIVE ANALYSIS**
Compare **${targetCompany}** against key peers **${peerCompanies.join(', ')}**:

${peerCompanies.map(peer => `
3. **${peer} Analysis:**
   - Use \`get_company_facts\` for ${peer} company information
   - Use \`get_financial_metrics\` for ${peer} financial ratios
   - Read \`financial://company/${peer}\` resource for additional context`).join('')}

### **PHASE 3: MARKET CONTEXT**
Assess broader market conditions:

4. **Market Overview:**
   - Use \`get_market_overview\` to understand current market conditions
   - Read \`financial://market/overview\` resource for market trends
   - Read \`financial://guide/analysis\` for analytical framework reference

### **PHASE 4: AI-POWERED INVESTMENT ANALYSIS**
Generate professional investment recommendation:

5. **Investment Thesis:**
   - Use \`ai_financial_analysis\` with ticker "${targetCompany}"
   - Set analysis_type to "investment_thesis" 
   - Include context: "Investment Committee analysis for ${investmentAmount}M ${timeHorizon} investment"

### **PHASE 5: RISK ASSESSMENT**
Evaluate investment risks and opportunities:

6. **Risk Analysis:**
   - Use \`ai_financial_analysis\` with ticker "${targetCompany}"
   - Set analysis_type to "risk_assessment"
   - Include context: "${timeHorizon} investment horizon risk evaluation"

## 🎯 INVESTMENT COMMITTEE DELIVERABLES

Your final analysis must include:

### **EXECUTIVE SUMMARY**
- Investment recommendation (BUY/HOLD/SELL)
- Target price and expected returns
- Key investment thesis points
- Major risks and mitigations

### **FINANCIAL HIGHLIGHTS**
- Revenue growth trends and projections
- Profitability metrics vs peers
- Balance sheet strength
- Cash flow generation capacity

### **COMPETITIVE POSITIONING**
- Market share and competitive advantages
- Peer comparison on key metrics
- Industry trends and positioning

### **RISK-RETURN PROFILE**
- Expected returns for ${timeHorizon} horizon
- Downside protection and risk factors
- Portfolio fit and diversification benefits

### **IMPLEMENTATION STRATEGY**
- Recommended position sizing (${investmentAmount}M)
- Entry strategy and timing
- Exit criteria and milestones
- Monitoring framework

## 💼 COMMITTEE CONTEXT

The Investment Committee expects:
- **Data-driven analysis** with current market data
- **Peer-relative assessment** showing competitive positioning
- **Clear investment thesis** with supporting evidence
- **Risk-adjusted returns** appropriate for ${timeHorizon} horizon
- **Actionable recommendations** with specific next steps

**BEGIN ANALYSIS** - Execute all phases systematically to build a comprehensive investment case for the committee.`;

      return {
        description: `🏛️ Investment Committee Analysis: ${investmentAmount}M ${timeHorizon} investment in ${targetCompany} vs peers ${peerCompanies.join(', ')}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: analysisPrompt
            }
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown prompt: ${promptName}`);
  }
});


/**
 * Handle completion requests for prompt arguments.
 * Provides autocomplete suggestions for ticker symbols and other arguments.
 */
server.setRequestHandler(CompleteRequestSchema, async (request) => {
  logger.log('Received completion request: ' + JSON.stringify(request));
  
  const { ref, argument } = request.params;
  
  // Handle completion for prompt arguments
  if (ref.type === "ref/prompt") {
    const promptName = ref.name;
    
    switch (promptName) {
      case "analyze-stock":
      case "financial-statements":
      case "investment-research":
      case "compare-stocks":
        if (argument?.name === "ticker" || argument?.name === "primary_ticker") {
          try {
            // Get available tickers for completion
            const response = await apiClient.get('/company/facts/tickers/');
            const allTickers = response.data.tickers || [];
            
            // Filter tickers based on current input
            const currentInput = argument?.value || '';
            const matchingTickers = allTickers
              .filter((ticker: string) => 
                ticker.toLowerCase().startsWith(currentInput.toLowerCase())
              )
              .slice(0, 20) // Limit to 20 suggestions
              .map((ticker: string) => ({
                values: [ticker],
                description: `Stock ticker: ${ticker}`
              }));
            
            return {
              completion: {
                values: matchingTickers.length > 0 ? matchingTickers : [
                  { values: ["AAPL"], description: "Apple Inc." },
                  { values: ["MSFT"], description: "Microsoft Corporation" },
                  { values: ["GOOGL"], description: "Alphabet Inc." },
                  { values: ["AMZN"], description: "Amazon.com Inc." },
                  { values: ["TSLA"], description: "Tesla Inc." }
                ],
                total: matchingTickers.length,
                hasMore: allTickers.length > 20
              }
            };
          } catch (error) {
            // Fallback to common tickers if API fails
            return {
              completion: {
                values: [
                  { values: ["AAPL"], description: "Apple Inc." },
                  { values: ["MSFT"], description: "Microsoft Corporation" },
                  { values: ["GOOGL"], description: "Alphabet Inc." },
                  { values: ["AMZN"], description: "Amazon.com Inc." },
                  { values: ["TSLA"], description: "Tesla Inc." },
                  { values: ["META"], description: "Meta Platforms Inc." },
                  { values: ["NVDA"], description: "NVIDIA Corporation" },
                  { values: ["JPM"], description: "JPMorgan Chase & Co." },
                  { values: ["V"], description: "Visa Inc." },
                  { values: ["JNJ"], description: "Johnson & Johnson" }
                ],
                total: 10,
                hasMore: false
              }
            };
          }
        }
        
        if (argument?.name === "comparison_tickers") {
          try {
            const response = await apiClient.get('/company/facts/tickers/');
            const allTickers = response.data.tickers || [];
            
            const currentInput = argument?.value || '';
            const lastTicker = currentInput.split(',').pop()?.trim() || '';
            
            const matchingTickers = allTickers
              .filter((ticker: string) => 
                ticker.toLowerCase().startsWith(lastTicker.toLowerCase())
              )
              .slice(0, 10)
              .map((ticker: string) => ({
                values: [ticker],
                description: `Add peer: ${ticker}`
              }));
            
            return {
              completion: {
                values: matchingTickers,
                total: matchingTickers.length,
                hasMore: false
              }
            };
          } catch (error) {
            return { completion: { values: [], total: 0, hasMore: false } };
          }
        }
        
        if (argument?.name === "analysis_depth") {
          return {
            completion: {
              values: [
                { values: ["basic"], description: "Basic financial overview" },
                { values: ["detailed"], description: "Detailed financial analysis" },
                { values: ["comprehensive"], description: "Comprehensive deep-dive analysis" }
              ],
              total: 3,
              hasMore: false
            }
          };
        }
        
        if (argument?.name === "period") {
          return {
            completion: {
              values: [
                { values: ["annual"], description: "Annual financial data" },
                { values: ["quarterly"], description: "Quarterly financial data" },
                { values: ["ttm"], description: "Trailing twelve months data" }
              ],
              total: 3,
              hasMore: false
            }
          };
        }
        
        if (argument?.name === "investment_horizon") {
          return {
            completion: {
              values: [
                { values: ["short_term"], description: "Short-term (< 1 year) investment horizon" },
                { values: ["medium_term"], description: "Medium-term (1-5 years) investment horizon" },
                { values: ["long_term"], description: "Long-term (5+ years) investment horizon" }
              ],
              total: 3,
              hasMore: false
            }
          };
        }
        
        if (argument?.name === "metrics_focus") {
          return {
            completion: {
              values: [
                { values: ["valuation"], description: "Focus on valuation metrics (P/E, P/B, EV/EBITDA)" },
                { values: ["growth"], description: "Focus on growth metrics (revenue, earnings growth)" },
                { values: ["profitability"], description: "Focus on profitability metrics (margins, ROE, ROA)" },
                { values: ["efficiency"], description: "Focus on efficiency metrics (turnover ratios)" },
                { values: ["comprehensive"], description: "Comprehensive analysis of all metrics" }
              ],
              total: 5,
              hasMore: false
            }
          };
        }
        break;
        
      case "analyze-crypto":
        if (argument?.name === "crypto_ticker") {
          try {
            const response = await apiClient.get('/crypto/prices/tickers/');
            const allCryptoTickers = response.data.tickers || [];
            
            const currentInput = argument?.value || '';
            const matchingTickers = allCryptoTickers
              .filter((ticker: string) => 
                ticker.toLowerCase().startsWith(currentInput.toLowerCase())
              )
              .slice(0, 15)
              .map((ticker: string) => ({
                values: [ticker],
                description: `Cryptocurrency: ${ticker}`
              }));
            
            return {
              completion: {
                values: matchingTickers.length > 0 ? matchingTickers : [
                  { values: ["BTC-USD"], description: "Bitcoin" },
                  { values: ["ETH-USD"], description: "Ethereum" },
                  { values: ["SOL-USD"], description: "Solana" },
                  { values: ["ADA-USD"], description: "Cardano" },
                  { values: ["DOGE-USD"], description: "Dogecoin" }
                ],
                total: matchingTickers.length,
                hasMore: allCryptoTickers.length > 15
              }
            };
          } catch (error) {
            return {
              completion: {
                values: [
                  { values: ["BTC-USD"], description: "Bitcoin" },
                  { values: ["ETH-USD"], description: "Ethereum" },
                  { values: ["SOL-USD"], description: "Solana" },
                  { values: ["ADA-USD"], description: "Cardano" },
                  { values: ["DOGE-USD"], description: "Dogecoin" },
                  { values: ["XRP-USD"], description: "XRP" },
                  { values: ["MATIC-USD"], description: "Polygon" },
                  { values: ["AVAX-USD"], description: "Avalanche" }
                ],
                total: 8,
                hasMore: false
              }
            };
          }
        }
        
        if (argument?.name === "timeframe") {
          return {
            completion: {
              values: [
                { values: ["7d"], description: "7 days of price history" },
                { values: ["30d"], description: "30 days of price history" },
                { values: ["90d"], description: "90 days of price history" },
                { values: ["1y"], description: "1 year of price history" }
              ],
              total: 4,
              hasMore: false
            }
          };
        }
        break;
        
      case "market-overview":
        if (argument?.name === "market_focus") {
          return {
            completion: {
              values: [
                { values: ["general"], description: "General market overview" },
                { values: ["tech"], description: "Technology sector focus" },
                { values: ["healthcare"], description: "Healthcare sector focus" },
                { values: ["finance"], description: "Financial sector focus" },
                { values: ["energy"], description: "Energy sector focus" },
                { values: ["all_sectors"], description: "All sectors analysis" }
              ],
              total: 6,
              hasMore: false
            }
          };
        }
        break;
    }
  }
  
  // Default empty completion
  return {
    completion: {
      values: [],
      total: 0,
      hasMore: false
    }
  };
});

/**
 * List templates for constructing financial data URIs.
 */
// === FRESH RESOURCE TEMPLATES IMPLEMENTATION ===
// Will be implemented below with the other resource handlers

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