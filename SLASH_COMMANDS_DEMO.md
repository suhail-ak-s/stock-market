# 🔥 Financial MCP Server - Slash Commands Demo

This demonstrates how your financial prompts work as **slash commands** in MCP clients like Claude Desktop.

## How It Works

### 1. **Prompt Discovery**
When users type `/` in MCP clients, they see all available prompts from connected servers:

```bash
# User types: /
# Client shows:
📈 /analyze-stock     - Analyze a company's financial health
🌍 /market-overview   - Get current market conditions  
₿ /analyze-crypto     - Analyze cryptocurrency trends
📊 /financial-statements - Deep dive into financial statements
🔍 /investment-research  - Complete investment research
⚖️ /compare-stocks    - Compare companies and sectors
```

### 2. **Filtered Search**
Users can filter prompts by typing partial names:

```bash
# User types: /analyze
# Client shows:
📈 /analyze-stock
₿ /analyze-crypto

# User types: /market
# Client shows:
🌍 /market-overview
```

### 3. **Argument Autocomplete**
When users select a prompt, they get intelligent argument suggestions:

```bash
# User selects: /analyze-stock
# Client shows argument form:

/analyze-stock
├── ticker: [REQUIRED] 🔍 Type to search tickers...
│   ├── AAPL (Apple Inc.)
│   ├── MSFT (Microsoft Corporation)  
│   ├── GOOGL (Alphabet Inc.)
│   └── TSLA (Tesla Inc.)
└── analysis_depth: [OPTIONAL]
    ├── basic (Basic financial overview)
    ├── detailed (Detailed financial analysis)
    └── comprehensive (Comprehensive deep-dive)
```

## Complete User Journey Example

### **Step 1: Discovery**
```
User: /
Client: Shows all available financial prompts with emojis and descriptions
```

### **Step 2: Selection**
```
User: /analyze-stock
Client: Shows argument form with autocomplete
```

### **Step 3: Argument Input**
```
User: ticker: AA
Client: Shows matching tickers:
- AAPL (Apple Inc.)
- AAL (American Airlines)
- AABA (Altaba Inc.)

User: selects AAPL
Client: ticker: AAPL ✓
```

### **Step 4: Optional Arguments**
```
User: analysis_depth: det
Client: Shows: detailed (Detailed financial analysis)

User: selects detailed
Client: analysis_depth: detailed ✓
```

### **Step 5: Execution**
```
User: Hits Enter
Client: Executes prompt with arguments:
{
  "name": "analyze-stock",
  "arguments": {
    "ticker": "AAPL",
    "analysis_depth": "detailed"
  }
}
```

## All Available Slash Commands

| Command | Description | Required Args | Optional Args |
|---------|-------------|---------------|---------------|
| `/analyze-stock` | 📈 Company financial analysis | `ticker` | `analysis_depth` |
| `/market-overview` | 🌍 Market conditions & trends | - | `market_focus` |
| `/analyze-crypto` | ₿ Cryptocurrency analysis | `crypto_ticker` | `timeframe` |
| `/financial-statements` | 📊 Financial statements deep dive | `ticker` | `period`, `years_back` |
| `/investment-research` | 🔍 Complete investment research | `ticker` | `investment_horizon` |
| `/compare-stocks` | ⚖️ Sector & peer comparison | `primary_ticker` | `comparison_tickers`, `metrics_focus` |

## Technical Implementation

### **Prompt Registration**
```typescript
{
  name: "analyze-stock",           // Becomes /analyze-stock
  title: "📈 Analyze Stock",       // Shows in UI
  description: "Analyze a company's financial health...",
  arguments: [...]
}
```

### **Client Integration**
1. **Connection**: Client connects to MCP server
2. **Discovery**: Client calls `prompts/list` to get available prompts  
3. **UI Integration**: Client exposes prompts as slash commands
4. **Autocomplete**: Client uses `completion` API for arguments
5. **Execution**: Client calls `prompts/get` with user arguments

## Why This Is Powerful

✅ **Discoverability**: Users can explore available financial analysis without documentation
✅ **Type Safety**: Arguments are validated and autocompleted  
✅ **User Experience**: Familiar slash command interface
✅ **Efficiency**: No need to remember exact ticker symbols or parameters
✅ **Context Aware**: Smart suggestions based on what user is typing

This creates a **ChatGPT-like experience** where users can discover and use financial analysis tools through an intuitive command interface!