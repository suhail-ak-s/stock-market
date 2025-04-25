export const tools = {
  get_all_financial_statements: {
    description: "Get financial statements for a company",
    parameters: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g., AAPL for Apple)",
      },
      cik: {
        type: "string",
        description: "Central Index Key (CIK) number assigned by the SEC",
      },
      period: {
        type: "string",
        description: "Period of financial statements, either 'annual' or 'quarter'",
        default: "annual",
      },
      limit: {
        type: "number",
        description: "Limit the number of statements returned",
        default: 4,
      },
      report_period_gte: {
        type: "string",
        description: "Get statements with a report period greater than or equal to this date (YYYY-MM-DD)",
      },
      report_period_lte: {
        type: "string",
        description: "Get statements with a report period less than or equal to this date (YYYY-MM-DD)",
      }
    },
    required: [],
  },
  
  get_insider_trades: {
    description: "Get insider trades for a specific company ticker",
    parameters: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g., AAPL for Apple)",
      },
      limit: {
        type: "number",
        description: "Maximum number of records to return",
        default: 100,
      },
      filing_date_gte: {
        type: "string",
        description: "Get trades with a filing date greater than or equal to this date (YYYY-MM-DD)",
      },
      filing_date_lte: {
        type: "string",
        description: "Get trades with a filing date less than or equal to this date (YYYY-MM-DD)",
      }
    },
    required: ["ticker"],
  },
  
  get_institutional_ownership_by_investor: {
    description: "Get institutional ownership data for a specific investor",
    parameters: {
      investor: {
        type: "string",
        description: "Name of the institutional investor",
      },
      limit: {
        type: "number",
        description: "Maximum number of records to return",
        default: 10,
      },
      report_period_gte: {
        type: "string",
        description: "Get holdings with a report period greater than or equal to this date (YYYY-MM-DD)",
      },
      report_period_lte: {
        type: "string",
        description: "Get holdings with a report period less than or equal to this date (YYYY-MM-DD)",
      }
    },
    required: ["investor"],
  },
  
  get_institutional_ownership_by_ticker: {
    description: "Get institutional ownership data for a specific company ticker",
    parameters: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g., AAPL for Apple)",
      },
      limit: {
        type: "number",
        description: "Maximum number of records to return",
        default: 10,
      },
      report_period_gte: {
        type: "string",
        description: "Get holdings with a report period greater than or equal to this date (YYYY-MM-DD)",
      },
      report_period_lte: {
        type: "string",
        description: "Get holdings with a report period less than or equal to this date (YYYY-MM-DD)",
      }
    },
    required: ["ticker"],
  },
  
  get_company_news: {
    description: "Get news articles for a specific company ticker",
    parameters: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g., AAPL for Apple)",
      },
      start_date: {
        type: "string",
        description: "Get news published on or after this date (YYYY-MM-DD)",
      },
      end_date: {
        type: "string",
        description: "Get news published on or before this date (YYYY-MM-DD)",
      },
      limit: {
        type: "number",
        description: "Maximum number of articles to return",
        default: 100,
      }
    },
    required: ["ticker"],
  },
  
  search_financials: {
    description: "Search for financial data across income statements, balance sheets, and cash flow statements",
    parameters: {
      search_type: {
        type: "string",
        description: "Type of search: 'filters' for filtering by metrics or 'line_items' for retrieving specific data points",
        enum: ["filters", "line_items"]
      },
      filters: {
        type: "array",
        description: "Array of filter objects (required when search_type=filters)",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "Financial metric to filter on (e.g., revenue, total_debt, capital_expenditure)"
            },
            operator: {
              type: "string",
              description: "Comparison operator (eq, gt, gte, lt, lte)",
              enum: ["eq", "gt", "gte", "lt", "lte"]
            },
            value: {
              type: "number",
              description: "Value to compare against"
            }
          },
          required: ["field", "operator", "value"]
        }
      },
      line_items: {
        type: "array",
        description: "Array of financial metrics to retrieve (required when search_type=line_items)",
        items: {
          type: "string"
        }
      },
      tickers: {
        type: "array",
        description: "Array of ticker symbols (required when search_type=line_items)",
        items: {
          type: "string"
        }
      },
      period: {
        type: "string",
        description: "Time period for financial data (annual, quarterly, ttm)",
        enum: ["annual", "quarterly", "ttm"],
        default: "ttm"
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return",
        default: 100
      },
      currency: {
        type: "string",
        description: "Currency for financial data",
        enum: ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK"]
      }
    },
    required: ["search_type"],
  },
  
  get_stock_price_snapshot: {
    description: "Get the real-time price snapshot for a stock ticker",
    parameters: {
      ticker: {
        type: "string",
        description: "The ticker symbol of the company",
      }
    },
    required: ["ticker"],
  },
  
  get_stock_prices_advanced: {
    description: "Get ranged price data for a ticker with customizable intervals",
    parameters: {
      ticker: {
        type: "string",
        description: "The ticker symbol of the company",
      },
      interval: {
        type: "string",
        description: "The time interval for price data",
        enum: ["second", "minute", "day", "week", "month", "year"]
      },
      interval_multiplier: {
        type: "number",
        description: "The multiplier for the interval (e.g., 5 for every 5 minutes)",
        minimum: 1
      },
      start_date: {
        type: "string",
        description: "The start date for price data (format: YYYY-MM-DD)"
      },
      end_date: {
        type: "string", 
        description: "The end date for price data (format: YYYY-MM-DD)"
      },
      limit: {
        type: "number",
        description: "Maximum number of price records to return",
        default: 5000,
        maximum: 5000,
        minimum: 1
      }
    },
    required: ["ticker", "interval", "interval_multiplier", "start_date", "end_date"],
  },
  
  get_sec_filing_items: {
    description: "Get specific sections (items) from a company's SEC filings",
    parameters: {
      ticker: {
        type: "string",
        description: "The ticker symbol of the company"
      },
      filing_type: {
        type: "string",
        description: "The type of filing to extract items from",
        enum: ["10-K", "10-Q"]
      },
      year: {
        type: "number",
        description: "The year of the filing"
      },
      quarter: {
        type: "number",
        description: "The quarter of the filing if 10-Q",
        minimum: 1,
        maximum: 4
      },
      items: {
        type: "array",
        description: "Specific items to extract from the filing. If not provided, all items are returned",
        items: {
          type: "string",
          enum: ["Item-1", "Item-1A", "Item-1B", "Item-2", "Item-3", "Item-4", "Item-5", "Item-6", "Item-7", "Item-7A", "Item-8", "Item-9", "Item-9A", "Item-9B", "Item-10", "Item-11", "Item-12", "Item-13", "Item-14", "Item-15", "Item-16"]
        }
      }
    },
    required: ["ticker", "filing_type", "year"],
  },
  
  get_segmented_revenues: {
    description: "Get detailed, segmented revenue data for a company",
    parameters: {
      ticker: {
        type: "string",
        description: "The ticker symbol of the company"
      },
      cik: {
        type: "string",
        description: "Alternative: The CIK of the company"
      },
      period: {
        type: "string",
        description: "The time period for the data",
        enum: ["annual", "quarterly"]
      },
      limit: {
        type: "number",
        description: "Maximum number of reports to return",
        default: 4
      }
    },
    required: ["period"],
  },
  
  get_sec_filings: {
    description: "Get a list of SEC filings for a company, including 10-Ks, 10-Qs, 8-Ks, and other filing types.",
    parameters: {
      ticker: {
        type: "string",
        description: "The ticker symbol of the company (e.g., AAPL for Apple Inc.)"
      },
      cik: {
        type: "string",
        description: "The Central Index Key (CIK) identifier for the company"
      },
      filing_type: {
        type: "string",
        description: "The type of filing to filter for (e.g., 10-K, 10-Q, 8-K)"
      }
    },
    required: []
  }
}; 