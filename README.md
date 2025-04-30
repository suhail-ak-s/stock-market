# Financial Datasets MCP Server

A Model Context Protocol (MCP) server implementation for the Financial Datasets API. This server allows language models to interact with stock market and cryptocurrency data through a standardized interface.

## Features

- Query company information by ticker or CIK
- Retrieve historical stock prices and financial data
- Access company financial statements (income, balance sheet, cash flow)
- View financial metrics, ratios and press releases
- Get cryptocurrency price data and real-time snapshots
- Access financial prompts for company and crypto analysis
- Use templates for constructing financial data queries
- Seamless integration with Claude Desktop and other AI tools

## Installation & Usage

### Using npx (recommended)

The easiest way to use this package is through npx:

```bash
npx stock-market-mcp-server --api-key YOUR_API_KEY
```

If you don't provide an API key via the command line, you'll be prompted to enter one.

Additional options:
```bash
npx stock-market-mcp-server --help
```

### Using with Claude Desktop

To use with Claude Desktop:

1. Open Claude Desktop
2. Enable the Plugins feature
3. In a terminal window, run:
   ```bash
   npx stock-market-mcp-server --api-key YOUR_API_KEY
   ```
4. In Claude Desktop, click Add Plugin and connect to the MCP server
5. Ask Claude to retrieve financial data about companies and crypto markets

### Install from GitHub Packages

You can install the package from GitHub Packages with:

```bash
# Add this to your .npmrc file
@suhail-ak-s:registry=https://npm.pkg.github.com

# Then install the package
npm install @suhail-ak-s/stock-market-mcp-server
```

### Global Installation

You can install the package globally using:

```bash
npm install -g stock-market-mcp-server
```

Or install directly from the GitHub repository:

```bash
npm install -g git+https://github.com/suhail-ak-s/stock-market.git
```

Then run:

```bash
stock-market-mcp-server --api-key YOUR_API_KEY
```

The API key will be stored securely for future use if you choose to save it.

### Manual Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

4. Start the server:

```bash
node dist/index.js --api-key YOUR_API_KEY
```

### Command Line Options

- `--api-key`, `-k` (required): Your Financial Datasets API key
- `--base-url`, `-u` (optional): Custom API base URL (defaults to https://api.financialdatasets.ai)
- `--debug`, `-d`: Enable debug output
- `--non-interactive`, `-n`: Run in non-interactive mode (no prompt)
- `--help`, `-h`: Show help message

## MCP Integration

This server implements the Model Context Protocol, allowing language models to:

1. List available financial resources (stock & crypto tickers)
2. Read company and cryptocurrency information
3. Call tools to query financial data
4. Access prompts for financial analysis
5. Use templates for constructing queries

## Tools

The server provides the following tools:

### Stock Market Tools
1. `get_company_facts`: Get company facts including name, CIK, market cap, etc.
2. `get_stock_prices`: Get historical stock prices for a company
3. `search_companies`: Search for companies by name or industry
4. `get_company_news`: Get news articles for a company
5. `get_insider_trades`: Get insider trades (buys and sells) for a company
6. `get_stock_price_snapshot`: Get real-time price snapshot for a ticker
7. `get_stock_prices_advanced`: Get ranged price data with customizable intervals
8. `get_sec_filings`: Get a list of SEC filings for a company by ticker or CIK

### Financial Data Tools
9. `get_earnings_press_releases`: Get company earnings press releases
10. `get_financial_metrics`: Get historical financial metrics for a company
11. `get_insider_ownership`: Get insider ownership for a company
12. `get_institutional_ownership_by_ticker`: Get institutional ownership by ticker
13. `get_institutional_ownership_by_investor`: Get institutional ownership by investor
14. `get_institutional_investors`: Get institutional investors for a company
15. `get_sec_filing_items`: Get SEC financial filing items in XBRL format
16. `get_financial_metrics_snapshot`: Get current financial metrics snapshot
17. `get_income_statements`: Get company income statements
18. `get_balance_sheets`: Get company balance sheets
19. `get_cash_flow_statements`: Get company cash flow statements
20. `get_all_financial_statements`: Get all statements in a single call
21. `search_financials`: Search for financial data across income statements, balance sheets, and cash flow statements using filters or retrieving specific line items
22. `get_segmented_revenues`: Get detailed, segmented revenue data by product lines, business segments, and regions

### Cryptocurrency Tools
23. `get_crypto_prices`: Get historical price data for a cryptocurrency
24. `get_crypto_snapshot`: Get the current price snapshot for a cryptocurrency

## Prompts

The server provides the following analytical prompts:

1. `analyze_company`: Get a comprehensive analysis of a company
2. `market_overview`: Get a market overview with key metrics and trends
3. `analyze_crypto`: Get a comprehensive analysis of a cryptocurrency
4. `analyze_financial_statements`: Get an analysis of company financial statements

## Resource Templates

The server provides these templates for constructing financial data URIs:

1. `company_profile`: Template for viewing a company's profile (`financial://company/{ticker}`)
2. `stock_prices`: Template for viewing stock price history (`financial://prices/{ticker}/{period}`)
3. `crypto_profile`: Template for viewing cryptocurrency data (`financial://crypto/{ticker}`)
4. `crypto_prices`: Template for viewing cryptocurrency price history (`financial://crypto/prices/{ticker}/{interval}/{interval_multiplier}`)
5. `earnings_press_releases`: Template for viewing company earnings press releases (`financial://earnings/{ticker}/press-releases`)
6. `financial_metrics`: Template for viewing company financial metrics (`financial://metrics/{ticker}/{period}`)
7. `financial_statements`: Template for viewing company financial statements (`financial://financials/{ticker}/{statement_type}/{period}`)

## Troubleshooting

If you encounter issues with the server:

1. Check the log files in your temporary directory:
   - `/tmp/financial-mcp.log` - Server logs
   - `/tmp/stock-market-debug.log` - Debug logs

2. Run the diagnostics test:
   ```bash
   npx -p stock-market-mcp-server stock-market-test --diagnostics
   ```

3. Ensure your API key is valid and has access to the Financial Datasets API

4. If using with Claude Desktop and having connection issues, try running in non-interactive mode:
   ```bash
   npx stock-market-mcp-server --api-key YOUR_API_KEY --non-interactive
   ```

## Development

For development, you can run the server directly using ts-node:

```bash
npm run dev -- --api-key YOUR_API_KEY
```

### Environment Variables

The server supports the following environment variables:

- `FINANCIAL_API_KEY`: Your API key for the Financial Datasets API
- `FINANCIAL_API_BASE_URL`: Custom API base URL (defaults to https://api.financialdatasets.ai)
- `CLAUDE_API_KEY`: Set by Claude Desktop for MCP context detection

## Logging

The server logs all activity to temporary files:
- `/tmp/financial-mcp.log` - Main server logs (Unix/macOS) or equivalent temporary directory on Windows
- `/tmp/stock-market-debug.log` - Debug logs for troubleshooting

## Version History

- **v1.0.12** - Fixed npm publishing and workflow issues
- **v1.0.7** - Fixed ESM syntax issues in test script
- **v1.0.6** - Enhanced npx compatibility and added diagnostics mode
- **v1.0.5** - Improved Claude Desktop integration for MCP communication
- **v1.0.4** - Initial public release

## Contributors

Thanks to all the contributors who have helped make this project better:

| Name | GitHub | Contributions |
| ---- | ------ | ------------- |
| Suhail AK | [@suhail-ak-s](https://github.com/suhail-ak-s) | Project creator and main developer |
| Claude AI | | Workflow optimization and bug fixes |
| Your Name Here | | We welcome contributions! |

Want to contribute? Check out our [contributing guidelines](CONTRIBUTING.md) to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Suhail AK. All rights reserved. 