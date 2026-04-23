# StockSense — AI-Powered Financial Forecasting Engine

A multi-model investment decision support platform combining deep learning, statistical, and gradient boosting approaches to deliver institutional-grade stock price forecasts and risk analysis for retail investors.


## Problem Addressed

Retail investors face significant information gaps when making investment decisions:
- **Model fragmentation**: No unified platform combining multiple forecasting methodologies
- **Lack of transparency**: Black-box AI models without interpretability or accuracy benchmarking
- **Inaccessible tools**: Institutional-grade analysis unavailable to non-expert investors due to cost and complexity
- **No comparative framework**: Investors cannot evaluate which model performs best on their specific stock before acting

StockSense solves these gaps by integrating four complementary forecasting models, quantitative performance metrics, investment ratings, and a portfolio simulator under one transparent, accessible interface.


## Proposed Solution

**StockSense** is a full-stack web application that combines:

### Forecasting Models
- **Chronos AI** — Amazon's pretrained foundation model for probabilistic time-series forecasting
- **Weighted Linear Regression** — OLS with 3-month recency weighting + confidence intervals
- **LightGBM** — Gradient boosting on detrended lag features with early stopping
- **CatBoost** — Ordered boosting with automatic trend restoration

### Decision Support Features
- **Multi-horizon investment ratings** (30/90/365 days) blending technical momentum + forecast returns
- **Market signals** — Moving averages (MA-50, MA-200) and annualized volatility
- **Investment simulator** — Backtest your capital allocation against historical performance
- **Model comparison framework** — Holdout evaluation showing MAPE, directional accuracy, and return prediction across all four models
- **Backtesting engine** — In-sample model accuracy scoring on historical data

### User Experience
- **Secure authentication** — Email/password registration with JWT tokens and SQLite persistence
- **Subscription tiers** — Free (1 ticker, LR only) / Basic (all features) / Pro (backtesting + alerts)
- **Live watchlist** — Track 8 major tickers (GOOGL, AAPL, TSLA, MSFT, AMZN, NVDA, BTC-USD, ETH-USD)
- **Real-time data** — Integrates Yahoo Finance for historical and actual price overlays
- **Interactive charts** — Chart.js visualisation of forecasts, confidence bands, and actual performance


## Tech Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: SQLite (lightweight, file-based)
- **Auth**: Custom JWT (HMAC-SHA256) with secure password hashing
- **Forecasting**: 
  - `chronos` (Amazon's pretrained model)
  - `scikit-learn` (Linear Regression with sample weighting)
  - `lightgbm` (LGBMRegressor with early stopping)
  - `catboost` (CatBoostRegressor)
- **Data**: `yfinance`, `pandas`, `numpy`
- **ML Utils**: `torch` (for Chronos), `scipy`

### Frontend
- **Framework**: React 19 (functional components, hooks)
- **State**: React hooks (useState, useEffect, useCallback)
- **API**: Axios with Bearer token auth
- **Charts**: Chart.js + react-chartjs-2
- **Styling**: CSS-in-JS (embedded in React)
- **Fonts**: Cabinet Grotesk (headings), DM Mono (data)

### Deployment & Development
- **Backend Server**: Flask development server (port 5000)
- **Frontend Dev Server**: Create React App (port 3000)
- **CORS**: Enabled via `flask-cors`
- **Proxy**: React dev server proxies `/forecast`, `/simulate`, `/compare` to Flask


## Steps to Launch the Demo

### 1. Prerequisites
Ensure you have:
- Python 3.9+
- Node.js 16+ and npm
- ~2GB disk space for ML models (Chronos)

### 2. Backend Setup
```bash
# Navigate to project root
cd /path/to/stocksense

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Set environment variables (optional, for production)
export SECRET_KEY="your-secret-key-32-chars-minimum"
export DB_PATH="stocksense.db"
```

### 3. Start Flask Server
```bash
# From project root with venv activated
python3 app.py
```
You should see: `* Running on http://127.0.0.1:5000`

### 4. Frontend Setup (in a new terminal)
```bash
# Navigate to React project directory
cd /path/to/stocksense/frontend  # or wherever your App.js is

# Install Node dependencies
npm install

# Ensure package.json has proxy configured:
# "proxy": "http://127.0.0.1:5000"

# Start React dev server
npm start
```
Your browser will auto-open to `http://localhost:3000`

### 5. First-Time Usage
1. **Sign up** with email and password (stored securely in SQLite)
2. **Choose a plan** — Free / Basic / Pro
3. **Run a forecast**:
   - Select a ticker (GOOGL, AAPL, TSLA, etc.)
   - Set training window (e.g., 2023-01-01 to 2025-01-01)
   - Choose forecast horizon (30–365 days)
   - Pick a model or run all four
   - Click **▶ Run Analysis**

4. **Interpret results**:
   - **Investment Ratings** — BUY/HOLD/SELL with confidence %
   - **Market Signals** — Price vs moving averages + volatility
   - **Model Comparison** — Click "Compare All Models" to benchmark MAPE and directional accuracy
   - **Investment Simulator** — Enter capital amount to see projected returns vs actual

### 6. Troubleshooting

| Issue | Solution |
|-------|----------|
| "CORS error" when running forecast | Ensure Flask is running on port 5000 and React proxy is configured |
| "Module not found" (chronos, lightgbm, etc.) | Run `pip install -r requirements.txt` again |
| "Database is locked" | Close other instances; SQLite is single-writer. For production, migrate to PostgreSQL |
| "Chart not rendering" | Clear React cache: `rm -rf node_modules/.cache` and restart |
| "Model flat-line predictions" | This is fixed — detrending is applied to tree models. If still flat, check data quality |

### 7. Demo Datasets
The app works with any ticker and date range via Yahoo Finance. Recommended demo tickers:
- **GOOGL** (stable growth)
- **TSLA** (high volatility, good for testing uncertainty)
- **BTC-USD** (crypto, extreme moves, tests edge cases)

Use a 1–2 year training window for best results. If your cutoff is in the past, the simulator will show actual vs predicted performance — ideal for validating model quality.


## Key Features Walkthrough

### 1. Multi-Horizon Ratings
Each ticker gets three independent investment ratings:
- **Short (30d)**: Heavily weights technical momentum
- **Medium (90d)**: Balanced blend of momentum + forecast
- **Long (365d)**: Primarily forecast-driven

Each rating includes confidence % — below 50% = high uncertainty, treat cautiously.

### 2. Model Comparison Table
Click **⚡ Compare All Models** to see a ranked table of all four models tested on your holdout window:
- **MAPE** (Mean Absolute Percentage Error) — primary accuracy metric, lower is better
- **Directional Accuracy** — % of days the model correctly predicted up/down movement
- **Expected vs Actual Return** — how close the forecast was to reality

Rank badges show which model performed best (gold 🥇 = best MAPE).

### 3. Investment Simulator
Enter a dollar amount (e.g., $5,000) and simulate investing from your cutoff date forward:
- **Blue line** — Model's predicted portfolio value over time with confidence band
- **Orange line** — Actual portfolio value (if cutoff is in past)
- **Gray line** — Initial investment baseline

Use this to validate model quality before deploying real capital.

### 4. Backtesting (Pro Plan)
MAPE score shows average prediction error on the last N days of your training window:
- **< 5%** — Excellent accuracy, high trust
- **5–15%** — Acceptable, normal caution
- **> 15%** — Model is struggling, reduce position size


## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (port 3000)           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Auth Page → Dashboard → Watchlist → Plans       │   │
│  │ • Model selector                                │   │
│  │ • Interactive chart (Chart.js)                  │   │
│  │ • Investment ratings + simulator                │   │
│  │ • Model comparison table                        │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────┘
                   │ (Axios + Bearer JWT)
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Flask Backend (port 5000)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Auth Routes                                      │   │
│  │ • /auth/register, /auth/login, /auth/me         │   │
│  │ • /auth/upgrade (plan change)                   │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Forecast Routes                                  │   │
│  │ • /forecast (single model)                      │   │
│  │ • /compare (all 4 models on holdout)            │   │
│  │ • /simulate (backtest returns)                  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ML Models                                        │   │
│  │ • Chronos (pretrained)                          │   │
│  │ • Weighted Linear Regression (3-month recency)  │   │
│  │ • LightGBM (detrended lag features)             │   │
│  │ • CatBoost (detrended lag features)             │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Data & Auth                                      │   │
│  │ • SQLite (users table: email, password_hash)    │   │
│  │ • Yahoo Finance (live OHLCV data)               │   │
│  │ • JWT token validation (HMAC-SHA256)            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```


## Future Enhancements

- **Email alerts** — Notify users when a stock hits a target price or rating changes
- **Correlation matrix** — Show cross-asset relationships for portfolio construction
- **Real news sentiment** — Integrate FinBERT for social/news sentiment scoring
- **Custom tickers** — Allow users to add any ticker, not just the curated 8
- **Export reports** — Generate PDF reports with forecasts, ratings, and simulator results
- **PostgreSQL migration** — Scale beyond single-file SQLite for production


## License

This project is for educational and research purposes. Use at your own risk. No investment advice is implied.
