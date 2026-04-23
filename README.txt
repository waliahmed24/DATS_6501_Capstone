================================================================================
                 StockSense - AI-Powered Financial Forecasting Engine
================================================================================

A multi-model investment decision support platform combining deep learning, 
statistical, and gradient boosting approaches to deliver institutional-grade 
stock price forecasts and risk analysis for retail investors.

================================================================================
PROBLEM ADDRESSED
================================================================================

Retail investors face significant information gaps when making investment 
decisions:

- Model fragmentation: No unified platform combining multiple forecasting 
  methodologies
- Lack of transparency: Black-box AI models without interpretability or 
  accuracy benchmarking
- Inaccessible tools: Institutional-grade analysis unavailable to non-expert 
  investors due to cost and complexity
- No comparative framework: Investors cannot evaluate which model performs best 
  on their specific stock before acting

StockSense solves these gaps by integrating four complementary forecasting 
models, quantitative performance metrics, investment ratings, and a portfolio 
simulator under one transparent, accessible interface.

================================================================================
PROPOSED SOLUTION
================================================================================

StockSense is a full-stack web application that combines:

FORECASTING MODELS
------------------
- Chronos AI: Amazon's pretrained foundation model for probabilistic 
  time-series forecasting
- Weighted Linear Regression: OLS with 3-month recency weighting + 
  confidence intervals
- LightGBM: Gradient boosting on detrended lag features with early stopping
- CatBoost: Ordered boosting with automatic trend restoration

DECISION SUPPORT FEATURES
------------------------
- Multi-horizon investment ratings (30/90/365 days) blending technical 
  momentum + forecast returns
- Market signals: Moving averages (MA-50, MA-200) and annualized volatility
- Investment simulator: Backtest your capital allocation against historical 
  performance
- Model comparison framework: Holdout evaluation showing MAPE, directional 
  accuracy, and return prediction across all four models
- Backtesting engine: In-sample model accuracy scoring on historical data

USER EXPERIENCE
---------------
- Secure authentication: Email/password registration with JWT tokens and 
  SQLite persistence
- Subscription tiers: Free (1 ticker, LR only) / Basic (all features) / 
  Pro (backtesting + alerts)
- Live watchlist: Track 8 major tickers (GOOGL, AAPL, TSLA, MSFT, AMZN, 
  NVDA, BTC-USD, ETH-USD)
- Real-time data: Integrates Yahoo Finance for historical and actual price 
  overlays
- Interactive charts: Chart.js visualization of forecasts, confidence bands, 
  and actual performance

================================================================================
TECH STACK
================================================================================

BACKEND
-------
Framework: Flask (Python)
Database: SQLite (lightweight, file-based)
Auth: Custom JWT (HMAC-SHA256) with secure password hashing

Forecasting Libraries:
  - chronos (Amazon's pretrained model)
  - scikit-learn (Linear Regression with sample weighting)
  - lightgbm (LGBMRegressor with early stopping)
  - catboost (CatBoostRegressor)

Data & ML Utils:
  - yfinance (Yahoo Finance data)
  - pandas, numpy (data manipulation)
  - torch (for Chronos)
  - scipy (scientific computing)

FRONTEND
--------
Framework: React 19 (functional components, hooks)
State Management: React hooks (useState, useEffect, useCallback)
API Client: Axios with Bearer token authentication
Charts: Chart.js + react-chartjs-2
Styling: CSS-in-JS (embedded in React)
Fonts: Cabinet Grotesk (headings), DM Mono (data)

DEPLOYMENT & DEVELOPMENT
------------------------
Backend Server: Flask development server (port 5000)
Frontend Dev Server: Create React App (port 3000)
CORS: Enabled via flask-cors
Proxy: React dev server proxies /forecast, /simulate, /compare to Flask

================================================================================
STEPS TO LAUNCH THE DEMO
================================================================================

1. PREREQUISITES
   - Python 3.9+
   - Node.js 16+ and npm
   - ~2GB disk space for ML models (Chronos)

2. BACKEND SETUP
   $ cd /path/to/stocksense
   $ python3 -m venv venv
   $ source venv/bin/activate    # On Windows: venv\Scripts\activate
   $ pip install -r requirements.txt
   
   Optional environment variables (for production):
   $ export SECRET_KEY="your-secret-key-32-chars-minimum"
   $ export DB_PATH="stocksense.db"

3. START FLASK SERVER
   $ python3 app.py
   
   You should see: * Running on http://127.0.0.1:5000

4. FRONTEND SETUP (in a new terminal)
   $ cd /path/to/stocksense/frontend
   $ npm install
   
   Ensure package.json has proxy configured:
   "proxy": "http://127.0.0.1:5000"
   
   $ npm start
   
   Your browser will auto-open to http://localhost:3000

5. FIRST-TIME USAGE
   a) Sign up with email and password (stored securely in SQLite)
   b) Choose a plan (Free / Basic / Pro)
   c) Run a forecast:
      - Select a ticker (GOOGL, AAPL, TSLA, etc.)
      - Set training window (e.g., 2023-01-01 to 2025-01-01)
      - Choose forecast horizon (30-365 days)
      - Pick a model or run all four
      - Click "Run Analysis"
   d) Interpret results:
      - Investment Ratings: BUY/HOLD/SELL with confidence %
      - Market Signals: Price vs moving averages + volatility
      - Model Comparison: Click "Compare All Models" to benchmark MAPE
      - Investment Simulator: Enter capital amount to see projected returns

6. TROUBLESHOOTING
   
   CORS error when running forecast
   -> Ensure Flask is running on port 5000 and React proxy is configured
   
   Module not found (chronos, lightgbm, etc.)
   -> Run "pip install -r requirements.txt" again
   
   Database is locked
   -> Close other instances; SQLite is single-writer. For production, 
      migrate to PostgreSQL
   
   Chart not rendering
   -> Clear React cache: "rm -rf node_modules/.cache" and restart
   
   Model flat-line predictions
   -> This is fixed - detrending is applied to tree models. If still flat, 
      check data quality

7. DEMO DATASETS
   The app works with any ticker and date range via Yahoo Finance.
   Recommended demo tickers:
   - GOOGL (stable growth)
   - TSLA (high volatility, good for testing uncertainty)
   - BTC-USD (crypto, extreme moves, tests edge cases)
   
   Use a 1-2 year training window for best results.

================================================================================
KEY FEATURES WALKTHROUGH
================================================================================

MULTI-HORIZON RATINGS
Each ticker gets three independent investment ratings:
- Short (30d): Heavily weights technical momentum
- Medium (90d): Balanced blend of momentum + forecast
- Long (365d): Primarily forecast-driven

Each rating includes confidence % - below 50% = high uncertainty.

MODEL COMPARISON TABLE
Click "Compare All Models" to see a ranked table of all four models tested on 
your holdout window:
- MAPE (Mean Absolute Percentage Error): Primary accuracy metric, lower better
- Directional Accuracy: % of days the model correctly predicted up/down
- Expected vs Actual Return: How close the forecast was to reality

Rank badges show which model performed best (gold = best MAPE).

INVESTMENT SIMULATOR
Enter a dollar amount and simulate investing from your cutoff date forward:
- Blue line: Model's predicted portfolio value with confidence band
- Orange line: Actual portfolio value (if cutoff is in past)
- Gray line: Initial investment baseline

Use this to validate model quality before deploying real capital.

BACKTESTING (PRO PLAN)
MAPE score shows average prediction error on last N days of training window:
- < 5%: Excellent accuracy, high trust
- 5-15%: Acceptable, normal caution
- > 15%: Model is struggling, reduce position size

================================================================================
ARCHITECTURE DIAGRAM
================================================================================

    +-----------------------------------------------------+
    |            React Frontend (port 3000)              |
    |  +-------------------------------------------+     |
    |  | Auth -> Dashboard -> Watchlist -> Plans  |     |
    |  | * Model selector                        |     |
    |  | * Interactive chart (Chart.js)          |     |
    |  | * Investment ratings + simulator        |     |
    |  | * Model comparison table                |     |
    |  +-------------------------------------------+     |
    +------------------+---------------------------------+
                       | (Axios + Bearer JWT)
                       v
    +-----------------------------------------------------+
    |           Flask Backend (port 5000)                |
    |  +-------------------------------------------+     |
    |  | Auth Routes                             |     |
    |  | * /auth/register, /auth/login           |     |
    |  | * /auth/me, /auth/upgrade               |     |
    |  +-------------------------------------------+     |
    |  +-------------------------------------------+     |
    |  | Forecast Routes                         |     |
    |  | * /forecast (single model)              |     |
    |  | * /compare (all 4 models on holdout)    |     |
    |  | * /simulate (backtest returns)          |     |
    |  +-------------------------------------------+     |
    |  +-------------------------------------------+     |
    |  | ML Models                               |     |
    |  | * Chronos (pretrained)                  |     |
    |  | * Weighted Linear Regression            |     |
    |  | * LightGBM (detrended lag features)     |     |
    |  | * CatBoost (detrended lag features)     |     |
    |  +-------------------------------------------+     |
    |  +-------------------------------------------+     |
    |  | Data & Auth                             |     |
    |  | * SQLite (users table)                  |     |
    |  | * Yahoo Finance (live OHLCV data)       |     |
    |  | * JWT token validation                  |     |
    |  +-------------------------------------------+     |
    +-----------------------------------------------------+

================================================================================
FUTURE ENHANCEMENTS
================================================================================

- Email alerts: Notify users when stock hits target price or rating changes
- Correlation matrix: Show cross-asset relationships for portfolio construction
- Real news sentiment: Integrate FinBERT for social/news sentiment scoring
- Custom tickers: Allow users to add any ticker, not just curated 8
- Export reports: Generate PDF reports with forecasts and ratings
- PostgreSQL migration: Scale beyond single-file SQLite

================================================================================
LICENSE & DISCLAIMER
================================================================================

This project is for educational and research purposes. Use at your own risk. 
No investment advice is implied. Stock market forecasting is inherently 
uncertain and no model is 100% accurate.
