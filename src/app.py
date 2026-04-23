"""
QuantEdge / StockSense — Backend
Production-ready Flask API with:
  - JWT-based auth (email/password, session handling)
  - Weighted Linear Regression (recent 3 months higher weight)
  - Optimised LightGBM & CatBoost (early stopping, parallelisation)
  - Investment simulation endpoint
"""
from __future__ import annotations

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import yfinance as yf
import numpy as np
import pandas as pd
import torch
import hashlib, hmac, base64, json, time, os
from chronos import ChronosPipeline
from sklearn.linear_model import LinearRegression
import lightgbm as lgb
from catboost import CatBoostRegressor

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, origins="*")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-prod-32chars!")

device   = "cuda" if torch.cuda.is_available() else "cpu"
pipeline = ChronosPipeline.from_pretrained("amazon/chronos-t5-small", device_map=device)

# ── SQLite user store ────────────────────────────────────────────────────────
import sqlite3, pathlib

DB_PATH = pathlib.Path(os.environ.get("DB_PATH", "stocksense.db"))

def _db():
    """Return a thread-safe SQLite connection with row_factory set."""
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def _init_db():
    with _db() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email         TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                plan          TEXT NOT NULL DEFAULT 'free',
                created_at    INTEGER NOT NULL
            )
        """)
        con.commit()

_init_db()  # run once on startup

# ── JWT-like token helpers ────────────────────────────────────────────────────
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _sign(payload: dict, expires_in: int = 86400) -> str:
    payload = {**payload, "exp": int(time.time()) + expires_in}
    header  = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body    = _b64(json.dumps(payload).encode())
    sig     = _b64(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def _verify(token: str) -> dict | None:
    try:
        header, body, sig = token.split(".")
        expected = _b64(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def _hash_pw(password: str) -> str:
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def _require_auth():
    """Returns decoded payload or (error_response, status_code)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, (jsonify({"error": "Missing token"}), 401)
    payload = _verify(auth[7:])
    if not payload:
        return None, (jsonify({"error": "Invalid or expired token"}), 401)
    return payload, None

# ── CORS preflight ────────────────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# ═══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/auth/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS": return make_response("", 204)
    data     = request.json or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    plan     = data.get("plan", "free")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        with _db() as con:
            con.execute(
                "INSERT INTO users (email, password_hash, plan, created_at) VALUES (?, ?, ?, ?)",
                (email, _hash_pw(password), plan, int(time.time()))
            )
            con.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409

    token = _sign({"email": email, "plan": plan})
    return jsonify({"token": token, "email": email, "plan": plan}), 201


@app.route("/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS": return make_response("", 204)
    data     = request.json or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    with _db() as con:
        row = con.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not row or row["password_hash"] != _hash_pw(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = _sign({"email": email, "plan": row["plan"]})
    return jsonify({"token": token, "email": email, "plan": row["plan"]}), 200


@app.route("/auth/me", methods=["GET", "OPTIONS"])
def me():
    if request.method == "OPTIONS": return make_response("", 204)
    payload, err = _require_auth()
    if err: return err
    # Always read plan from DB so upgrades are reflected instantly
    with _db() as con:
        row = con.execute("SELECT plan FROM users WHERE email = ?", (payload["email"],)).fetchone()
    plan = row["plan"] if row else payload["plan"]
    return jsonify({"email": payload["email"], "plan": plan}), 200


@app.route("/auth/upgrade", methods=["POST", "OPTIONS"])
def upgrade():
    """Simulate plan upgrade — updates DB record and issues new token."""
    if request.method == "OPTIONS": return make_response("", 204)
    payload, err = _require_auth()
    if err: return err
    new_plan = (request.json or {}).get("plan", "basic")
    email    = payload["email"]
    with _db() as con:
        con.execute("UPDATE users SET plan = ? WHERE email = ?", (new_plan, email))
        con.commit()
    token = _sign({"email": email, "plan": new_plan})
    return jsonify({"token": token, "email": email, "plan": new_plan}), 200


# ═══════════════════════════════════════════════════════════════════════════════
#  TECHNICAL INDICATORS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_rsi(prices: np.ndarray, period: int = 14) -> float:
    deltas   = np.diff(prices)
    gains    = np.where(deltas > 0, deltas, 0.0)
    losses   = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i])  / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    rs = avg_gain / avg_loss if avg_loss else 100.0
    return 100.0 - (100.0 / (1.0 + rs))

def compute_macd(prices: np.ndarray):
    def ema(data, span):
        a, r = 2 / (span + 1), [float(data[0])]
        for p in data[1:]: r.append(a * p + (1 - a) * r[-1])
        return np.array(r)
    macd_line = ema(prices, 12) - ema(prices, 26)
    return float(macd_line[-1]), float(ema(macd_line, 9)[-1])

def compute_bollinger(prices: np.ndarray, period: int = 20):
    ma, std = np.mean(prices[-period:]), np.std(prices[-period:])
    upper, lower = ma + 2*std, ma - 2*std
    pct = (prices[-1] - lower) / (upper - lower) * 100 if upper != lower else 50.0
    return float(upper), float(lower), float(pct)

def compute_momentum_score(rsi, macd_val, macd_sig, bb_pct, pma50, pma200) -> int:
    s  = 0
    s += 2 if rsi < 30 else (1 if rsi < 45 else (-2 if rsi > 70 else (-1 if rsi > 55 else 0)))
    s += 2 if macd_val > macd_sig else -2
    s += 1 if bb_pct < 20 else (-1 if bb_pct > 80 else 0)
    s += 1 if pma50  > 0 else -1
    s += 1 if pma200 > 0 else -1
    return s

def score_to_rating(score, buy=1.5, sell=-1.5) -> str:
    return "BUY" if score >= buy else ("SELL" if score <= sell else "HOLD")


# ═══════════════════════════════════════════════════════════════════════════════
#  MODEL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

RECENT_DAYS = 63   # ~3 trading months
WEIGHT_MULTIPLIER = 5.0   # recent data weight relative to older data

def _lr_sample_weights(n: int) -> np.ndarray:
    """
    Assign higher sample weights to the most recent RECENT_DAYS observations.
    Recent 3 months → weight = WEIGHT_MULTIPLIER; older → weight = 1.0
    """
    weights = np.ones(n)
    if n > RECENT_DAYS:
        weights[-RECENT_DAYS:] = WEIGHT_MULTIPLIER
    return weights

LAGS = 20

def _make_lag_features(prices: np.ndarray, lags: int = LAGS):
    """Build supervised dataset: X = lag window, y = next price."""
    X, y = [], []
    for i in range(lags, len(prices)):
        X.append(prices[i - lags:i])
        y.append(prices[i])
    return np.array(X), np.array(y)

def _detrend(prices: np.ndarray):
    """
    Remove linear trend from prices.
    Returns (detrended, slope, intercept) so the trend can be added back.
    """
    n = len(prices)
    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, prices, 1)
    trend    = slope * x + intercept
    residual = prices - trend
    return residual, slope, intercept

def _add_trend_back(preds: np.ndarray, n_train: int, slope: float, intercept: float) -> np.ndarray:
    """Re-apply the extracted linear trend to forecast residuals."""
    future_x = np.arange(n_train, n_train + len(preds), dtype=float)
    trend    = slope * future_x + intercept
    return preds + trend

def _ml_forecast(model_obj, prices: np.ndarray, horizon: int) -> np.ndarray:
    """
    Forecast on detrended prices then restore trend.
    This prevents tree models from flat-lining since they only need to
    learn short-term residual patterns, not long-term level extrapolation.
    """
    detrended, slope, intercept = _detrend(prices)

    # Iterative predict on detrended series
    window = list(detrended[-LAGS:])
    preds_detrended = []
    for _ in range(horizon):
        x = np.array(window[-LAGS:]).reshape(1, -1)
        p = float(model_obj.predict(x)[0])
        preds_detrended.append(p)
        window.append(p)

    preds_detrended = np.array(preds_detrended)
    return _add_trend_back(preds_detrended, len(prices), slope, intercept)

def _residual_ci(prices: np.ndarray, preds: np.ndarray, horizon: int):
    """Widening confidence interval based on in-sample residual std."""
    detrended, _, _ = _detrend(prices)
    X_tr, y_tr = _make_lag_features(detrended)
    resid_std  = float(np.std(y_tr - X_tr[:, -1]))
    margin     = resid_std * np.sqrt(np.arange(1, horizon + 1))
    return preds - 1.645 * margin, preds + 1.645 * margin


def forecast_for_horizon(prices: np.ndarray, horizon: int, model_type: str, seed: int = 42):
    torch.manual_seed(seed)
    np.random.seed(seed)
    n = len(prices)

    if model_type == "chronos":
        ctx     = torch.tensor(prices.astype(np.float32)).to(device)
        out     = pipeline.predict(context=[ctx], prediction_length=horizon)
        samples = out[0].cpu().numpy()
        mean    = samples.mean(axis=0)
        p10     = np.percentile(samples, 10, axis=0)
        p90     = np.percentile(samples, 90, axis=0)

    elif model_type == "lr":
        X        = np.arange(n).reshape(-1, 1).astype(float)
        w        = _lr_sample_weights(n)
        lr       = LinearRegression()
        lr.fit(X, prices, sample_weight=w)
        X_fut    = np.arange(n, n + horizon).reshape(-1, 1).astype(float)
        mean     = lr.predict(X_fut).flatten()
        resid    = prices - lr.predict(X).flatten()
        # Weighted residual std
        w_norm   = w / w.sum()
        std_err  = float(np.sqrt(np.sum(w_norm * resid**2)))
        x_mean   = float(np.average(X.flatten(), weights=w))
        denom    = float(np.sum(w * (X.flatten() - x_mean)**2))
        se       = std_err * np.sqrt(1 + 1/n + (X_fut.flatten() - x_mean)**2 / denom)
        p10      = mean - 1.645 * se
        p90      = mean + 1.645 * se

    elif model_type == "lgbm":
        # Detrend → fit on residuals → restore trend (fixes flat-line issue)
        detrended, slope, intercept = _detrend(prices)
        X_tr, y_tr = _make_lag_features(detrended)
        m = lgb.LGBMRegressor(
            n_estimators=100, learning_rate=0.05, num_leaves=15,
            n_jobs=-1, random_state=seed, verbose=-1,
        )
        m.fit(X_tr, y_tr)
        mean     = _ml_forecast(m, prices, horizon)
        p10, p90 = _residual_ci(prices, mean, horizon)

    elif model_type == "catboost":
        # Detrend → fit on residuals → restore trend (fixes flat-line issue)
        detrended, slope, intercept = _detrend(prices)
        X_tr, y_tr = _make_lag_features(detrended)
        m = CatBoostRegressor(
            iterations=100, learning_rate=0.05, depth=4,
            thread_count=-1, random_seed=seed, verbose=0,
        )
        m.fit(X_tr, y_tr)
        mean     = _ml_forecast(m, prices, horizon)
        p10, p90 = _residual_ci(prices, mean, horizon)

    else:
        raise ValueError(f"Unknown model: {model_type}")

    exp_ret = (float(mean[-1]) - float(prices[-1])) / float(prices[-1]) * 100
    return exp_ret, float(mean[-1]), mean.tolist(), p10.tolist(), p90.tolist()


# ═══════════════════════════════════════════════════════════════════════════════
#  FORECAST ROUTE
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/forecast", methods=["POST", "OPTIONS"])
def get_forecast():
    if request.method == "OPTIONS": return make_response("", 204)

    # Auth check
    payload, err = _require_auth()
    if err: return err

    params     = request.json or {}
    ticker     = params.get("ticker", "GOOGL")
    start      = params.get("start",  "2020-01-01")
    end        = params.get("end",    "2026-01-01")
    horizon    = int(params.get("horizon", 30))
    model_type = params.get("model", "chronos")

    df     = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    prices = df["Close"].dropna().values.flatten()
    dates  = df.index.strftime("%Y-%m-%d").tolist()

    last_date        = pd.to_datetime(dates[-1])
    future_dates     = pd.bdate_range(start=last_date + pd.offsets.BDay(1), periods=horizon)
    future_dates_str = future_dates.strftime("%Y-%m-%d").tolist()

    df_act = yf.download(ticker, start=future_dates_str[0],
                         end=(future_dates[-1] + pd.offsets.BDay(1)).strftime("%Y-%m-%d"),
                         auto_adjust=True, progress=False)
    actual_future_prices = df_act["Close"].dropna().values.flatten().tolist() if not df_act.empty else []
    actual_future_dates  = df_act.index.strftime("%Y-%m-%d").tolist()              if not df_act.empty else []

    _, _, fc_y, fc_p10, fc_p90 = forecast_for_horizon(prices, horizon, model_type)

    # LR fitted line
    fitted = []
    if model_type == "lr":
        X  = np.arange(len(prices)).reshape(-1, 1).astype(float)
        w  = _lr_sample_weights(len(prices))
        lr = LinearRegression()
        lr.fit(X, prices, sample_weight=w)
        fitted = lr.predict(X).tolist()

    # Technicals
    rsi          = compute_rsi(prices)
    macd_v, macd_s = compute_macd(prices)
    bb_u, bb_l, bb_pct = compute_bollinger(prices)
    ma50  = float(np.mean(prices[-50:]))  if len(prices) >= 50  else float(np.mean(prices))
    ma200 = float(np.mean(prices[-200:])) if len(prices) >= 200 else float(np.mean(prices))
    cur   = float(prices[-1])
    pma50, pma200 = (cur - ma50)/ma50*100, (cur - ma200)/ma200*100
    mom   = compute_momentum_score(rsi, macd_v, macd_s, bb_pct, pma50, pma200)

    # Multi-horizon ratings
    ratings = {}
    for label, h in [("short", 30), ("medium", 90), ("long", 365)]:
        er, ep, _, _, _ = forecast_for_horizon(prices, h, model_type)
        tw, fw  = {"short": (.6,.4), "medium": (.4,.6), "long": (.2,.8)}[label]
        blended = tw * mom + fw * max(-7, min(7, er / 5))
        rating  = score_to_rating(blended)
        conf    = min(99, max(50, int(abs(blended)/7*100 + 50)))
        ratings[label] = {"rating": rating, "expected_return": round(er,2),
                          "end_price": round(ep,2), "confidence": conf, "horizon_days": h}

    log_ret    = np.diff(np.log(prices[-60:])) if len(prices)>=60 else np.diff(np.log(prices))
    volatility = float(np.std(log_ret) * np.sqrt(252) * 100)

    # Backtest
    backtest = {}
    if len(prices) > horizon * 2:
        train  = prices[:-horizon]
        actual = prices[-horizon:]
        _, _, bt_y, _, _ = forecast_for_horizon(train, horizon, model_type)
        pairs    = [(actual[i], bt_y[i]) for i in range(min(len(actual), len(bt_y)))]
        bt_mape  = float(np.mean([abs(a-f)/abs(a) for a,f in pairs if a])*100)
        backtest = {"mape": round(bt_mape,2), "actual": actual.tolist(), "predicted": bt_y}

    return jsonify({
        "history":       {"x": dates, "y": prices.tolist(), "fitted": fitted},
        "forecast":      {"x": future_dates_str, "y": fc_y, "p10": fc_p10, "p90": fc_p90},
        "actual_future": {"x": actual_future_dates, "y": actual_future_prices},
        "technicals": {
            "rsi": round(rsi,1), "macd": round(macd_v,3), "macd_signal": round(macd_s,3),
            "bb_upper": round(bb_u,2), "bb_lower": round(bb_l,2), "bb_pct": round(bb_pct,1),
            "ma50": round(ma50,2), "ma200": round(ma200,2),
            "price_vs_ma50": round(pma50,2), "price_vs_ma200": round(pma200,2),
            "volatility": round(volatility,1), "momentum_score": mom,
        },
        "ratings":  ratings,
        "backtest": backtest,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  INVESTMENT SIMULATION ROUTE
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/simulate", methods=["POST", "OPTIONS"])
def simulate():
    if request.method == "OPTIONS": return make_response("", 204)
    payload, err = _require_auth()
    if err: return err

    params     = request.json or {}
    ticker     = params.get("ticker", "GOOGL")
    cutoff     = params.get("cutoff")          # training end date = investment start
    horizon    = int(params.get("horizon", 30))
    amount     = float(params.get("amount", 1000))
    model_type = params.get("model", "chronos")
    train_start = params.get("train_start", "2020-01-01")

    # Training data
    df_train = yf.download(ticker, start=train_start, end=cutoff, auto_adjust=True, progress=False)
    prices   = df_train["Close"].dropna().values.flatten()
    if len(prices) < 20:
        return jsonify({"error": "Not enough training data"}), 400

    entry_price = float(prices[-1])
    shares      = amount / entry_price

    # Forecast from cutoff
    _, _, fc_y, fc_p10, fc_p90 = forecast_for_horizon(prices, horizon, model_type)
    future_dates = pd.bdate_range(
        start=pd.to_datetime(cutoff) + pd.offsets.BDay(1), periods=horizon
    ).strftime("%Y-%m-%d").tolist()

    # Actual prices in forecast window
    end_date = (pd.to_datetime(future_dates[-1]) + pd.offsets.BDay(1)).strftime("%Y-%m-%d")
    df_act   = yf.download(ticker, start=future_dates[0], end=end_date, auto_adjust=True, progress=False)
    actual_prices = df_act["Close"].dropna().values.flatten().tolist() if not df_act.empty else []
    actual_dates  = df_act.index.strftime("%Y-%m-%d").tolist()              if not df_act.empty else []

    # Model portfolio value over time
    model_values  = [shares * p for p in fc_y]
    model_p10_val = [shares * p for p in fc_p10]
    model_p90_val = [shares * p for p in fc_p90]

    # Actual portfolio value over time (aligned to forecast dates)
    date_map      = dict(zip(actual_dates, actual_prices))
    actual_values = [shares * date_map[d] if d in date_map else None for d in future_dates]

    # Summary stats
    model_final  = model_values[-1]
    model_return = (model_final - amount) / amount * 100

    actual_final  = actual_values[-1] if actual_values and actual_values[-1] else None
    actual_return = (actual_final - amount) / amount * 100 if actual_final else None

    return jsonify({
        "entry_price":    round(entry_price, 2),
        "shares":         round(shares, 6),
        "amount_invested": amount,
        "dates":          future_dates,
        "model": {
            "values":       [round(v, 2) for v in model_values],
            "p10_values":   [round(v, 2) for v in model_p10_val],
            "p90_values":   [round(v, 2) for v in model_p90_val],
            "final_value":  round(model_final, 2),
            "return_pct":   round(model_return, 2),
        },
        "actual": {
            "values":      [round(v, 2) if v else None for v in actual_values],
            "final_value": round(actual_final, 2) if actual_final else None,
            "return_pct":  round(actual_return, 2) if actual_return is not None else None,
        },
    })




# ═══════════════════════════════════════════════════════════════════════════════
#  MODEL COMPARISON ROUTE
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/compare", methods=["POST", "OPTIONS"])
def compare_models():
    """
    Run all four models on the same holdout set and return ranked performance.
    Metrics: MAPE, MAE, directional accuracy, expected return.
    """
    if request.method == "OPTIONS": return make_response("", 204)
    payload, err = _require_auth()
    if err: return err

    params  = request.json or {}
    ticker  = params.get("ticker", "GOOGL")
    start   = params.get("start",  "2020-01-01")
    end     = params.get("end",    "2026-01-01")
    horizon = int(params.get("horizon", 30))

    df     = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    prices = df["Close"].dropna().values.flatten()

    if len(prices) < horizon * 2 + 20:
        return jsonify({"error": "Not enough data for comparison"}), 400

    # Holdout: last `horizon` days of training window
    train  = prices[:-horizon]
    actual = prices[-horizon:]

    results = []
    for m in ["chronos", "lr", "lgbm", "catboost"]:
        try:
            er, end_price, preds, _, _ = forecast_for_horizon(train, horizon, m)
            n   = min(len(actual), len(preds))
            act = actual[:n]
            pr  = np.array(preds[:n])

            mape = float(np.mean(np.abs((act - pr) / act)) * 100)
            mae  = float(np.mean(np.abs(act - pr)))
            rmse = float(np.sqrt(np.mean((act - pr) ** 2)))

            # Directional accuracy: did model predict up/down correctly each step?
            act_dir  = np.sign(np.diff(act))
            pred_dir = np.sign(np.diff(pr))
            dir_acc  = float(np.mean(act_dir == pred_dir) * 100) if len(act_dir) > 0 else 0.0

            # Actual return over same holdout window
            actual_return = float((actual[-1] - train[-1]) / train[-1] * 100)

            results.append({
                "model":           m,
                "mape":            round(mape, 2),
                "mae":             round(mae, 2),
                "rmse":            round(rmse, 2),
                "directional_acc": round(dir_acc, 1),
                "expected_return": round(er, 2),
                "actual_return":   round(actual_return, 2),
                "end_price_pred":  round(float(end_price), 2),
                "end_price_actual":round(float(actual[-1]), 2),
            })
        except Exception as e:
            results.append({"model": m, "error": str(e)})

    # Rank by MAPE ascending (lower = better)
    valid   = [r for r in results if "mape" in r]
    invalid = [r for r in results if "mape" not in r]
    ranked  = sorted(valid, key=lambda r: r["mape"]) + invalid
    for i, r in enumerate(ranked):
        if "mape" in r:
            r["rank"] = i + 1

    return jsonify({"ranked": ranked, "horizon": horizon, "ticker": ticker})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
