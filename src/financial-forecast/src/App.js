import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ── Constants ────────────────────────────────────────────────────────────────
const API = axios.create({ baseURL: '/' });

const TICKER_META = {
    'GOOGL':   { name: 'Alphabet Inc.', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png' },
    'AAPL':    { name: 'Apple Inc.',    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' },
    'TSLA':    { name: 'Tesla Inc.',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Tesla_Motors.svg/120px-Tesla_Motors.svg.png' },
    'MSFT':    { name: 'Microsoft',     logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/120px-Microsoft_logo.svg.png' },
    'AMZN':    { name: 'Amazon',        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/200px-Amazon_logo.svg.png' },
    'NVDA':    { name: 'NVIDIA',        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Nvidia_logo.svg/200px-Nvidia_logo.svg.png' },
    'BTC-USD': { name: 'Bitcoin',       logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/120px-Bitcoin.svg.png' },
    'ETH-USD': { name: 'Ethereum',      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ethereum_logo_2014.svg/80px-Ethereum_logo_2014.svg.png' },
};

const PLAN_ACCESS = {
    free:  { tickers: ['GOOGL'], models: ['lr'], horizonMax: 30, technicals: false, ratings: false, backtest: false, watchlist: false, simulate: false },
    basic: { tickers: Object.keys(TICKER_META), models: ['chronos','lr','lgbm','catboost'], horizonMax: 365, technicals: true, ratings: true, backtest: false, watchlist: true, simulate: true },
    pro:   { tickers: Object.keys(TICKER_META), models: ['chronos','lr','lgbm','catboost'], horizonMax: 365, technicals: true, ratings: true, backtest: true,  watchlist: true, simulate: true },
};

const PLANS = [
    { id: 'free',  name: 'Free',  price: '$0',  period: '',    color: '#6b7280', features: ['View all stock tickers', 'Price history chart', 'GOOGL only', 'Linear Regression model', '30-day horizon max'] },
    { id: 'basic', name: 'Basic', price: '$12', period: '/mo', color: '#6366f1', popular: true, features: ['All 8 tickers', 'All 4 models (Chronos · LR · LightGBM · CatBoost)', 'All forecast horizons', 'Technical indicators', 'Multi-horizon BUY/HOLD/SELL ratings', 'Investment simulator', 'Watchlist'] },
    { id: 'pro',   name: 'Pro',   price: '$35', period: '/mo', color: '#059669', features: ['Everything in Basic', 'Backtesting engine + MAPE scoring', 'Email alerts (coming soon)', 'API access (coming soon)'] },
];

const MODEL_META = {
    chronos:  { label: 'Chronos AI',       desc: 'amazon/chronos-t5-small',        dot: '#6366f1', sel: 'sel-c' },
    lr:       { label: 'Linear Regression', desc: 'sklearn · weighted OLS',          dot: '#059669', sel: 'sel-l' },
    lgbm:     { label: 'LightGBM',          desc: 'gradient boosting · early stop',  dot: '#f59e0b', sel: 'sel-g' },
    catboost: { label: 'CatBoost',          desc: 'ordered boosting · early stop',   dot: '#ec4899', sel: 'sel-k' },
};

const MODEL_COLORS = { chronos: '#6366f1', lr: '#059669', lgbm: '#f59e0b', catboost: '#ec4899' };
const GAUGE_COLORS  = { BUY: '#059669', HOLD: '#d97706', SELL: '#dc2626' };
const RATING_BG     = { BUY: '#ecfdf5', HOLD: '#fffbeb', SELL: '#fef2f2' };
const RATING_BORDER = { BUY: '#6ee7b7', HOLD: '#fcd34d', SELL: '#fca5a5' };

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getToken()          { return localStorage.getItem('qe_token'); }
function setToken(t)         { localStorage.setItem('qe_token', t); }
function clearToken()        { localStorage.removeItem('qe_token'); }
function authHeader()        { return { Authorization: `Bearer ${getToken()}` }; }

// ── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#f0eeea;--surface:#fff;--border:#e5e3df;
  --text:#18181b;--muted:#71717a;--faint:#a1a1aa;
  --indigo:#6366f1;--green:#059669;--amber:#d97706;--red:#dc2626;
  --shadow:0 2px 12px rgba(0,0,0,.07);
}
body{background:var(--bg);font-family:'Cabinet Grotesk',sans-serif;color:var(--text);min-height:100vh;}
.wrap{min-height:100vh;padding:28px 20px;}

/* NAV */
.nav{max-width:1300px;margin:0 auto 28px;display:flex;align-items:center;justify-content:space-between;}
.nav-logo{font-size:20px;font-weight:900;letter-spacing:-1px;background:linear-gradient(135deg,#18181b,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.nav-right{display:flex;align-items:center;gap:10px;}
.nav-tabs{display:flex;gap:4px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:4px;}
.nav-tab{padding:7px 15px;border-radius:7px;border:none;background:transparent;font-family:'Cabinet Grotesk',sans-serif;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;transition:.2s;}
.nav-tab.active{background:var(--indigo);color:#fff;}
.plan-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:800;border:1.5px solid;cursor:pointer;transition:.2s;}
.plan-chip:hover{transform:translateY(-1px);}
.nav-email{font-family:'DM Mono',monospace;font-size:11px;color:var(--faint);}
.logout-btn{padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;font-family:'Cabinet Grotesk',sans-serif;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;transition:.2s;}
.logout-btn:hover{background:#f5f5f5;}

/* AUTH PAGE */
.auth-page{max-width:400px;margin:80px auto 0;}
.auth-logo{text-align:center;margin-bottom:32px;}
.auth-logo h1{font-size:32px;font-weight:900;letter-spacing:-1.5px;background:linear-gradient(135deg,#18181b,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.auth-logo p{font-size:13px;color:var(--faint);margin-top:6px;font-family:'DM Mono',monospace;}
.auth-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:32px;box-shadow:var(--shadow);}
.auth-tabs{display:flex;gap:0;background:#f5f5f5;border-radius:10px;padding:4px;margin-bottom:24px;}
.auth-tab{flex:1;padding:8px;border-radius:7px;border:none;background:transparent;font-family:'Cabinet Grotesk',sans-serif;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;transition:.2s;text-align:center;}
.auth-tab.active{background:#fff;color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.08);}
.auth-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
.auth-field label{font-size:12px;font-weight:700;color:var(--muted);}
.auth-field input{background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:.2s;width:100%;}
.auth-field input:focus{border-color:var(--indigo);background:#eef2ff;}
.auth-err{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;font-size:13px;color:var(--red);margin-bottom:14px;font-weight:600;}
.auth-note{font-size:11px;color:var(--faint);text-align:center;margin-top:14px;font-family:'DM Mono',monospace;}

/* LOADING SPINNER */
.spinner-overlay{position:fixed;inset:0;background:rgba(240,238,234,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:16px;backdrop-filter:blur(4px);}
.spinner{width:44px;height:44px;border:3px solid #e5e7eb;border-top-color:var(--indigo);border-radius:50%;animation:spin .75s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner-label{font-family:'DM Mono',monospace;font-size:13px;color:var(--muted);letter-spacing:1px;}
.spinner-steps{font-family:'DM Mono',monospace;font-size:11px;color:var(--faint);}

/* PLANS PAGE */
.landing{max-width:1100px;margin:0 auto;}
.landing-hero{text-align:center;padding:40px 0 44px;}
.landing-hero h1{font-size:clamp(28px,5vw,52px);font-weight:900;letter-spacing:-2.5px;background:linear-gradient(135deg,#18181b 0%,#6366f1 55%,#059669 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.05;margin-bottom:14px;}
.landing-hero p{font-size:15px;color:var(--muted);max-width:500px;margin:0 auto;line-height:1.6;}
.plans-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:48px;}
.plan-card{background:var(--surface);border:2px solid var(--border);border-radius:20px;padding:28px 22px;position:relative;transition:.25s;}
.plan-card:hover{transform:translateY(-4px);box-shadow:0 12px 36px rgba(0,0,0,.1);}
.plan-card.featured{box-shadow:0 0 0 4px rgba(99,102,241,.1);}
.pop-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--indigo);color:#fff;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 14px;border-radius:20px;white-space:nowrap;}
.plan-name{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;}
.plan-price{font-size:40px;font-weight:900;letter-spacing:-2px;line-height:1;}
.plan-period{font-size:14px;font-weight:500;margin-left:2px;}
.plan-div{height:1px;background:var(--border);margin:18px 0;}
.plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:24px;}
.plan-features li{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--muted);font-weight:600;line-height:1.4;}
.plan-features li::before{content:'✓';font-size:11px;font-weight:900;flex-shrink:0;margin-top:1px;}
.plan-btn{width:100%;padding:12px;border-radius:10px;border:2px solid;font-family:'Cabinet Grotesk',sans-serif;font-size:14px;font-weight:800;cursor:pointer;transition:.2s;text-transform:uppercase;letter-spacing:.5px;}
.plan-btn:hover{transform:translateY(-1px);}

/* PAYMENT MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.modal{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,.18);}
.modal h3{font-size:20px;font-weight:900;margin-bottom:4px;}
.modal-sub{font-size:13px;color:var(--muted);margin-bottom:22px;}
.modal-field{display:flex;flex-direction:column;gap:5px;margin-bottom:13px;}
.modal-field label{font-size:12px;font-weight:700;color:var(--muted);}
.modal-field input{background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:.2s;}
.modal-field input:focus{border-color:var(--indigo);background:#eef2ff;}
.modal-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-cancel{width:100%;margin-top:10px;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;font-family:'Cabinet Grotesk',sans-serif;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;transition:.2s;}
.modal-cancel:hover{background:#f5f5f5;}

/* DASHBOARD */
.hero{text-align:center;margin-bottom:30px;}
.hero-eye{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--indigo);margin-bottom:10px;}
.hero h1{font-size:clamp(26px,4vw,46px);font-weight:900;letter-spacing:-2px;background:linear-gradient(135deg,#18181b 0%,#6366f1 55%,#059669 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.05;}
.main-grid{max-width:1300px;margin:0 auto;display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start;}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;box-shadow:var(--shadow);}
.section-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--faint);margin-bottom:10px;}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;}
.field label{font-size:12px;font-weight:700;color:var(--muted);}
.field input,.field select{background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:9px 11px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;width:100%;outline:none;-webkit-appearance:none;transition:.2s;}
.field input:focus,.field select:focus{border-color:var(--indigo);background:#eef2ff;}
.divider{height:1px;background:var(--border);margin:14px 0;}
.model-cards{display:flex;flex-direction:column;gap:7px;}
.model-card{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:10px;border:1.5px solid var(--border);cursor:pointer;transition:.2s;background:#fafafa;}
.model-card.disabled{opacity:.38;cursor:not-allowed;pointer-events:none;}
.model-card:not(.disabled):hover{border-color:rgba(99,102,241,.4);background:#eef2ff;}
.model-card.sel-c{border-color:rgba(99,102,241,.6);background:#eef2ff;}
.model-card.sel-l{border-color:rgba(5,150,105,.5);background:#ecfdf5;}
.model-card.sel-g{border-color:rgba(245,158,11,.5);background:#fffbeb;}
.model-card.sel-k{border-color:rgba(236,72,153,.5);background:#fdf2f8;}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.mc-name{font-size:13px;font-weight:800;}
.mc-desc{font-size:10px;color:var(--faint);font-family:'DM Mono',monospace;margin-top:1px;}
.mc-lock{font-size:10px;margin-left:auto;color:var(--faint);}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;}
.toggle-row span{font-size:12px;font-weight:700;color:var(--muted);}
.tog{position:relative;width:40px;height:22px;cursor:pointer;}
.tog input{opacity:0;width:0;height:0;}
.tog-sl{position:absolute;inset:0;background:#e5e7eb;border-radius:22px;transition:.3s;border:1px solid #d1d5db;}
.tog-sl:before{content:'';position:absolute;width:16px;height:16px;left:2px;top:2px;background:#9ca3af;border-radius:50%;transition:.3s;}
.tog input:checked+.tog-sl{background:rgba(234,179,8,.2);border-color:rgba(234,179,8,.6);}
.tog input:checked+.tog-sl:before{transform:translateX(18px);background:#d97706;}
.run-btn{width:100%;padding:13px;border:none;border-radius:10px;font-family:'Cabinet Grotesk',sans-serif;font-size:14px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:.2s;margin-top:4px;}
.run-btn:not(:disabled){background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 4px 16px rgba(99,102,241,.3);}
.run-btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(99,102,241,.45);}
.run-btn:disabled{background:#f3f4f6;color:#9ca3af;cursor:not-allowed;}
.chart-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.chart-title{font-size:15px;font-weight:800;}
.ticker-pill{display:flex;align-items:center;gap:9px;padding:5px 13px 5px 7px;border-radius:40px;background:#fafafa;border:1px solid var(--border);}
.ticker-pill img{width:26px;height:26px;border-radius:50%;object-fit:contain;background:#fff;border:1px solid var(--border);padding:2px;}
.tp-sym{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;line-height:1.2;}
.tp-name{font-family:'DM Mono',monospace;font-size:9px;color:var(--faint);}
.chart-area{height:380px;position:relative;}
.chart-empty{height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;}
.chart-empty-txt{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:1px;text-align:center;line-height:1.8;color:var(--faint);}
.stat-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px;}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 15px;box-shadow:var(--shadow);transition:.2s;}
.stat-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.09);}
.stat-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--faint);margin-bottom:5px;}
.stat-val{font-size:19px;font-weight:800;}
.stat-val.pos{color:var(--green);}.stat-val.neg{color:var(--red);}.stat-val.neu{color:var(--indigo);}
.stat-sub{font-family:'DM Mono',monospace;font-size:10px;color:#d1d5db;margin-top:2px;}
.section-header{display:flex;align-items:center;gap:10px;margin-top:26px;margin-bottom:6px;}
.section-header h3{font-size:15px;font-weight:800;}
.section-tag{font-family:'DM Mono',monospace;font-size:9px;padding:3px 8px;border-radius:6px;background:#eef2ff;color:var(--indigo);letter-spacing:1px;}
.ratings-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.rating-card{border-radius:14px;padding:18px;border:1.5px solid;transition:.2s;}
.rating-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.08);}
.rc-horizon{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;}
.rc-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:14px;font-weight:900;letter-spacing:.5px;margin-bottom:12px;}
.rc-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;}
.rc-key{font-size:12px;color:var(--muted);font-weight:600;}
.rc-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;}
.conf-bar{height:4px;background:#e5e7eb;border-radius:4px;margin-top:10px;overflow:hidden;}
.conf-fill{height:100%;border-radius:4px;transition:width .6s ease;}
.tech-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.tech-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow);}
.tech-name{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:6px;}
.tech-val{font-size:22px;font-weight:800;}
.tech-sub{font-size:11px;color:var(--muted);margin-top:3px;font-weight:600;}
.tech-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800;margin-top:5px;}
.bull{background:#ecfdf5;color:#059669;}.bear{background:#fef2f2;color:#dc2626;}.neut{background:#f3f4f6;color:#6b7280;}
.sentiment-row{display:flex;gap:8px;}
.sent-card{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow);text-align:center;}
.sent-emoji{font-size:24px;margin-bottom:6px;}
.sent-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;}
.sent-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:500;margin-top:3px;}
.sent-pos{color:var(--green);}.sent-neg{color:var(--red);}.sent-neu{color:var(--amber);}
.backtest-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;box-shadow:var(--shadow);}
.bt-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.bt-mape{font-family:'DM Mono',monospace;font-size:22px;font-weight:500;}
.bt-mape.good{color:var(--green);}.bt-mape.ok{color:var(--amber);}.bt-mape.bad{color:var(--red);}

/* LOCKED */
.locked-section{position:relative;}
.locked-overlay{position:absolute;inset:0;background:rgba(240,238,234,.86);backdrop-filter:blur(3px);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;z-index:10;}
.locked-overlay span{font-size:13px;font-weight:800;color:var(--muted);}
.locked-overlay button{padding:8px 20px;border-radius:8px;border:none;background:var(--indigo);color:#fff;font-family:'Cabinet Grotesk',sans-serif;font-size:12px;font-weight:800;cursor:pointer;}

/* SIMULATE */
.sim-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;box-shadow:var(--shadow);margin-top:0;}
.sim-inputs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.sim-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
.sim-stat{background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
.sim-stat-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--faint);margin-bottom:4px;}
.sim-stat-val{font-size:18px;font-weight:800;}
.sim-chart{height:280px;}

/* WATCHLIST */
.watchlist-page{max-width:1100px;margin:0 auto;}
.watchlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px;margin-top:18px;}
.watch-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);cursor:pointer;transition:.2s;}
.watch-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.1);}
.wc-logo{width:34px;height:34px;border-radius:50%;object-fit:contain;border:1px solid var(--border);padding:3px;background:#fff;margin-bottom:10px;}
.wc-sym{font-size:16px;font-weight:900;letter-spacing:-.5px;}
.wc-name{font-size:11px;color:var(--faint);margin-bottom:12px;font-family:'DM Mono',monospace;}
.wc-price{font-size:20px;font-weight:800;margin-bottom:3px;}
.wc-change{font-size:12px;font-weight:700;font-family:'DM Mono',monospace;}
.wc-change.pos{color:var(--green);}.wc-change.neg{color:var(--red);}

/* SIMPLIFIED TECHNICALS - 3 cards */
.tech-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}

/* MODEL COMPARISON TABLE */
.compare-wrap{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;box-shadow:var(--shadow);margin-top:0;}
.compare-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}
.compare-table th{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--faint);padding:8px 12px;text-align:left;border-bottom:2px solid var(--border);white-space:nowrap;}
.compare-table td{padding:11px 12px;border-bottom:1px solid var(--border);font-weight:600;vertical-align:middle;}
.compare-table tr:last-child td{border-bottom:none;}
.compare-table tr:hover td{background:#fafaf9;}
.rank-badge{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:11px;font-weight:900;font-family:'DM Mono',monospace;}
.rank-1{background:#fef9c3;color:#854d0e;}
.rank-2{background:#f1f5f9;color:#475569;}
.rank-3{background:#fdf4ff;color:#7e22ce;}
.rank-4{background:#f9fafb;color:#9ca3af;}
.model-dot-cell{display:flex;align-items:center;gap:8px;}
.mape-bar-wrap{display:flex;align-items:center;gap:8px;}
.mape-bar-bg{flex:1;height:6px;background:#f0f0f0;border-radius:6px;overflow:hidden;min-width:60px;}
.mape-bar-fill{height:100%;border-radius:6px;}
.compare-run-btn{padding:8px 18px;border-radius:8px;border:none;background:var(--indigo);color:#fff;font-family:'Cabinet Grotesk',sans-serif;font-size:13px;font-weight:800;cursor:pointer;transition:.2s;}
.compare-run-btn:hover{background:#4f46e5;transform:translateY(-1px);}
.compare-run-btn:disabled{background:#e5e7eb;color:#9ca3af;cursor:not-allowed;}
.dir-acc-bar{display:flex;align-items:center;gap:6px;}
.dir-bar-bg{flex:1;height:6px;background:#f0f0f0;border-radius:6px;overflow:hidden;min-width:50px;}
.dir-bar-fill{height:100%;border-radius:6px;background:var(--indigo);}
`;

// ── Utilities ────────────────────────────────────────────────────────────────
const computeSentiment = prices => {
    if (!prices?.length) return { positive: 33, neutral: 34, negative: 33 };
    const rm = prices.slice(-20).reduce((a,b)=>a+b,0)/20;
    const om = prices.slice(-40,-20).reduce((a,b)=>a+b,0)/20 || rm;
    const ch = (rm-om)/om*100;
    if (ch > 3)  return { positive:65, neutral:25, negative:10 };
    if (ch > 0)  return { positive:45, neutral:40, negative:15 };
    if (ch > -3) return { positive:20, neutral:40, negative:40 };
    return { positive:10, neutral:25, negative:65 };
};

const computeMAPE = (actual, forecastY, forecastX) => {
    const map = {}; actual.x.forEach((d,i)=>{ map[d]=actual.y[i]; });
    const pairs = forecastX.map((d,i)=>({a:map[d],f:forecastY[i]})).filter(p=>p.a!=null&&p.f!=null);
    if (!pairs.length) return null;
    return (pairs.reduce((s,p)=>s+Math.abs((p.a-p.f)/p.a),0)/pairs.length*100).toFixed(2);
};

const buildChart = (data, overlayActual, model) => {
    const { history, forecast, actual_future } = data;
    const allLabels = [...history.x, ...forecast.x];
    const fc   = MODEL_COLORS[model] || '#6366f1';
    const band = { chronos:'rgba(99,102,241,0.1)', lr:'rgba(5,150,105,0.1)', lgbm:'rgba(245,158,11,0.1)', catboost:'rgba(236,72,153,0.1)' }[model];
    return {
        labels: allLabels,
        datasets: [
            { label:'Historical Price', data:[...history.y,...Array(forecast.y.length).fill(null)], borderColor:'#1e293b', borderWidth:2.5, pointRadius:0, tension:0.3, backgroundColor:'transparent' },
            { label:`${MODEL_META[model]?.label} Forecast`, data:[...Array(history.y.length).fill(null),...forecast.y], borderColor:fc, borderDash:[7,3], borderWidth:3, pointRadius:0, tension:0.3 },
            { label:'Upper Bound', data:[...Array(history.y.length).fill(null),...forecast.p90], borderColor:'transparent', backgroundColor:band, pointRadius:0, fill:false, tension:0.3 },
            { label:'Prediction Interval', data:[...Array(history.y.length).fill(null),...forecast.p10], borderColor:'transparent', backgroundColor:band, pointRadius:0, fill:'-1', tension:0.3 },
            ...(model==='lr'&&history.fitted?.length?[{ label:'Fitted Line', data:[...history.fitted,...Array(forecast.y.length).fill(null)], borderColor:'#10b981', borderDash:[4,3], borderWidth:2, pointRadius:0, tension:0.3 }]:[]),
            ...(overlayActual&&actual_future?.y?.length?[{
                label:'Actual (Forecast Period)',
                data:(()=>{ const m={}; actual_future.x.forEach((d,i)=>{m[d]=actual_future.y[i];}); return allLabels.map(d=>m[d]??null); })(),
                borderColor:'#f59e0b', borderWidth:2.5, borderDash:[5,3], pointRadius:0, tension:0.3, backgroundColor:'transparent'
            }]:[])
        ]
    };
};

const chartOpts = (cb=null) => ({
    responsive:true, maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{
        legend:{ position:'top', labels:{ color:'#9ca3af', font:{family:'DM Mono',size:10}, boxWidth:12, padding:12 } },
        tooltip:{ backgroundColor:'#fff', borderColor:'#e5e7eb', borderWidth:1, titleColor:'#6b7280', bodyColor:'#18181b', titleFont:{family:'DM Mono',size:10}, bodyFont:{family:'DM Mono',size:11}, padding:12,
            callbacks: cb || { label: ctx => ctx.parsed.y!=null ? ` $${ctx.parsed.y.toFixed(2)}` : null }
        }
    },
    scales:{
        x:{ grid:{display:false}, ticks:{color:'#9ca3af',font:{family:'DM Mono',size:10},maxTicksLimit:8}, border:{color:'#f0f0f0'} },
        y:{ grid:{color:'#f5f5f5'}, ticks:{color:'#9ca3af',font:{family:'DM Mono',size:10},callback:v=>`$${Number(v).toFixed(0)}`}, border:{color:'#f0f0f0'} }
    }
});

// ── Loading Spinner ───────────────────────────────────────────────────────────
const STEPS = ['Fetching price data…','Running model…','Computing technicals…','Building ratings…','Almost done…'];
function Spinner() {
    const [step, setStep] = useState(0);
    useEffect(()=>{ const t=setInterval(()=>setStep(s=>Math.min(s+1,STEPS.length-1)),2200); return ()=>clearInterval(t); },[]);
    return (
        <div className="spinner-overlay">
            <div className="spinner"/>
            <div className="spinner-label">Running Analysis</div>
            <div className="spinner-steps">{STEPS[step]}</div>
        </div>
    );
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
    const [tab, setTab]         = useState('login');
    const [email, setEmail]     = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]     = useState('');
    const [busy, setBusy]       = useState(false);

    const submit = async () => {
        setError(''); setBusy(true);
        try {
            const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
            const res = await API.post(endpoint, { email, password, plan: 'free' });
            setToken(res.data.token);
            onAuth({ email: res.data.email, plan: res.data.plan });
        } catch(e) {
            setError(e.response?.data?.error || 'Something went wrong');
        }
        setBusy(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-logo">
                <h1>StockSense ◈</h1>
                <p>AI-powered investment intelligence</p>
            </div>
            <div className="auth-card">
                <div className="auth-tabs">
                    {['login','register'].map(t=>(
                        <button key={t} className={`auth-tab${tab===t?' active':''}`} onClick={()=>{ setTab(t); setError(''); }}>
                            {t==='login'?'Sign In':'Create Account'}
                        </button>
                    ))}
                </div>
                {error && <div className="auth-err">{error}</div>}
                <div className="auth-field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
                <div className="auth-field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
                <button className="run-btn" onClick={submit} disabled={busy || !email || !password}>
                    {busy ? 'Please wait…' : tab==='login' ? 'Sign In' : 'Create Account'}
                </button>
                <p className="auth-note">{tab==='login'?'No account? Switch to Create Account above.':'Already registered? Sign in above.'}</p>
            </div>
        </div>
    );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ plan, onSuccess, onCancel }) {
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);
    const pay = async () => {
        setBusy(true);
        try {
            const res = await API.post('/auth/upgrade', { plan: plan.id }, { headers: authHeader() });
            setToken(res.data.token);
            setDone(true);
        } catch(e) { alert('Upgrade failed'); }
        setBusy(false);
    };
    if (done) return (
        <div className="modal-overlay">
            <div className="modal" style={{textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:14}}>🎉</div>
                <h3>You're on {plan.name}!</h3>
                <p className="modal-sub" style={{marginTop:8}}>Your plan is now active. Enjoy full access.</p>
                <button className="run-btn" style={{marginTop:18}} onClick={()=>onSuccess(plan.id)}>Go to Dashboard →</button>
            </div>
        </div>
    );
    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3>Subscribe to {plan.name}</h3>
                <p className="modal-sub">{plan.price}{plan.period} · Prototype — no real charge</p>
                <div className="modal-field"><label>Cardholder Name</label><input placeholder="John Smith"/></div>
                <div className="modal-field"><label>Card Number</label><input placeholder="4242 4242 4242 4242"/></div>
                <div className="modal-row">
                    <div className="modal-field"><label>Expiry</label><input placeholder="MM / YY"/></div>
                    <div className="modal-field"><label>CVC</label><input placeholder="•••"/></div>
                </div>
                <button className="run-btn" onClick={pay} disabled={busy}>{busy?'Processing…':`Pay ${plan.price}${plan.period}`}</button>
                <button className="modal-cancel" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

// ── Plans Page ────────────────────────────────────────────────────────────────
function PlansPage({ currentPlan, onSelectPlan }) {
    const [paying, setPaying] = useState(null);
    return (
        <div className="landing">
            {paying && <PaymentModal plan={paying} onSuccess={pid=>{ onSelectPlan(pid); setPaying(null); }} onCancel={()=>setPaying(null)}/>}
            <div className="landing-hero">
                <h1>Invest Smarter,<br/>Not Harder.</h1>
                <p>AI-powered forecasts, technical ratings, and multi-model analysis for serious investors.</p>
            </div>
            <div className="plans-grid">
                {PLANS.map(plan=>{
                    const active = currentPlan===plan.id;
                    return (
                        <div key={plan.id} className={`plan-card${plan.popular?' featured':''}`} style={active?{borderColor:plan.color,boxShadow:`0 0 0 4px ${plan.color}18`}:{}}>
                            {plan.popular && <div className="pop-badge">Most Popular</div>}
                            <div className="plan-name" style={{color:plan.color}}>{plan.name}</div>
                            <div><span className="plan-price" style={{color:plan.color}}>{plan.price}</span><span className="plan-period" style={{color:plan.color}}>{plan.period}</span></div>
                            <div className="plan-div"/>
                            <ul className="plan-features">{plan.features.map((f,i)=><li key={i}>{f}</li>)}</ul>
                            <button className="plan-btn"
                                style={active?{background:plan.color,borderColor:plan.color,color:'#fff'}:{background:'transparent',borderColor:plan.color,color:plan.color}}
                                onClick={()=>plan.id==='free'?onSelectPlan('free'):setPaying(plan)}>
                                {active?'✓ Current Plan':plan.id==='free'?'Get Started Free':'Subscribe'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Watchlist ─────────────────────────────────────────────────────────────────
function WatchlistPage({ onSelect }) {
    const items = Object.entries(TICKER_META).map(([sym,meta])=>{
        const s = sym.charCodeAt(0)+sym.charCodeAt(1);
        return { sym, ...meta, price:(100+(s*7.3)%3000).toFixed(2), change:(((s*3.7)%10)-5).toFixed(2) };
    });
    return (
        <div className="watchlist-page">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-1}}>My Watchlist</h2>
                <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'#9ca3af'}}>{items.length} assets</span>
            </div>
            <p style={{color:'#9ca3af',fontSize:13}}>Click any card to open in the forecast engine.</p>
            <div className="watchlist-grid">
                {items.map(w=>(
                    <div className="watch-card" key={w.sym} onClick={()=>onSelect(w.sym)}>
                        <img className="wc-logo" src={w.logo} alt={w.sym} onError={e=>e.target.style.display='none'}/>
                        <div className="wc-sym">{w.sym}</div>
                        <div className="wc-name">{w.name}</div>
                        <div className="wc-price">${w.price}</div>
                        <div className={`wc-change ${parseFloat(w.change)>=0?'pos':'neg'}`}>{parseFloat(w.change)>=0?'▲':'▼'} {Math.abs(w.change)}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Locked wrapper ────────────────────────────────────────────────────────────
function Locked({ onUpgrade, children, height=180 }) {
    return (
        <div className="locked-section" style={{minHeight:height}}>
            <div style={{opacity:.12,pointerEvents:'none'}}>{children}</div>
            <div className="locked-overlay">
                <span>🔒 Upgrade to unlock</span>
                <button onClick={onUpgrade}>View Plans</button>
            </div>
        </div>
    );
}

// ── Investment Simulator ──────────────────────────────────────────────────────
function InvestmentSimulator({ ticker, cutoff, horizon, model, trainStart, access, onUpgrade }) {
    const [amount, setAmount]   = useState(1000);
    const [result, setResult]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const run = async () => {
        setLoading(true); setError('');
        try {
            const res = await API.post('/simulate', { ticker, cutoff, horizon, amount, model, train_start: trainStart }, { headers: authHeader() });
            setResult(res.data);
        } catch(e) { setError(e.response?.data?.error || 'Simulation failed'); }
        setLoading(false);
    };

    const simChartData = result ? {
        labels: result.dates,
        datasets: [
            { label:'Initial Investment', data: result.dates.map(()=>result.amount_invested), borderColor:'#94a3b8', borderDash:[4,4], borderWidth:1.5, pointRadius:0 },
            { label:'Model Predicted', data: result.model.values, borderColor: MODEL_COLORS[model]||'#6366f1', borderWidth:3, pointRadius:0, tension:0.3 },
            { label:'Model P90', data: result.model.p90_values, borderColor:'transparent', backgroundColor:({ chronos:'rgba(99,102,241,0.08)', lr:'rgba(5,150,105,0.08)', lgbm:'rgba(245,158,11,0.08)', catboost:'rgba(236,72,153,0.08)' })[model], pointRadius:0, fill:false, tension:0.3 },
            { label:'Model P10', data: result.model.p10_values, borderColor:'transparent', backgroundColor:({ chronos:'rgba(99,102,241,0.08)', lr:'rgba(5,150,105,0.08)', lgbm:'rgba(245,158,11,0.08)', catboost:'rgba(236,72,153,0.08)' })[model], pointRadius:0, fill:'-1', tension:0.3 },
            ...(result.actual.values?.some(v=>v!=null)?[{ label:'Actual Performance', data: result.actual.values, borderColor:'#f59e0b', borderWidth:2.5, borderDash:[5,3], pointRadius:0, tension:0.3, backgroundColor:'transparent' }]:[]),
        ]
    } : null;

    if (!access) return (
        <div className="sim-card">
            <div className="section-header"><h3>Investment Simulator</h3><span className="section-tag">BASIC+</span></div>
            <Locked onUpgrade={onUpgrade} height={160}><div style={{height:120,background:'#f5f5f5',borderRadius:10}}/></Locked>
        </div>
    );

    return (
        <div className="sim-card">
            <div className="section-header" style={{marginTop:0}}><h3>Investment Simulator</h3><span className="section-tag">LIVE</span></div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16,fontWeight:600}}>Simulate investing from your cutoff date and compare model vs actual performance.</p>
            <div className="sim-inputs">
                <div className="field">
                    <label>Investment Amount (USD)</label>
                    <input type="number" value={amount} onChange={e=>setAmount(parseFloat(e.target.value)||0)} min="1" step="100"/>
                </div>
                <div style={{display:'flex',alignItems:'flex-end'}}>
                    <button className="run-btn" onClick={run} disabled={loading} style={{marginTop:0}}>
                        {loading?'Simulating…':'▶ Run Simulation'}
                    </button>
                </div>
            </div>
            {error && <div style={{color:'var(--red)',fontSize:13,fontWeight:600,marginBottom:12}}>{error}</div>}
            {result && (<>
                <div className="sim-stats">
                    <div className="sim-stat">
                        <div className="sim-stat-lbl">Amount Invested</div>
                        <div className="sim-stat-val">${result.amount_invested.toLocaleString()}</div>
                    </div>
                    <div className="sim-stat">
                        <div className="sim-stat-lbl">Model Final Value</div>
                        <div className="sim-stat-val" style={{color:result.model.return_pct>=0?'var(--green)':'var(--red)'}}>${result.model.final_value.toLocaleString()}</div>
                    </div>
                    <div className="sim-stat">
                        <div className="sim-stat-lbl">Model Return</div>
                        <div className="sim-stat-val" style={{color:result.model.return_pct>=0?'var(--green)':'var(--red)'}}>{result.model.return_pct>0?'+':''}{result.model.return_pct}%</div>
                    </div>
                    {result.actual.final_value!=null && (<>
                        <div className="sim-stat">
                            <div className="sim-stat-lbl">Actual Final Value</div>
                            <div className="sim-stat-val" style={{color:result.actual.return_pct>=0?'var(--green)':'var(--red)'}}>${result.actual.final_value.toLocaleString()}</div>
                        </div>
                        <div className="sim-stat">
                            <div className="sim-stat-lbl">Actual Return</div>
                            <div className="sim-stat-val" style={{color:result.actual.return_pct>=0?'var(--green)':'var(--red)'}}>{result.actual.return_pct>0?'+':''}{result.actual.return_pct}%</div>
                        </div>
                        <div className="sim-stat">
                            <div className="sim-stat-lbl">Shares Held</div>
                            <div className="sim-stat-val" style={{fontSize:15}}>{result.shares}</div>
                        </div>
                    </>)}
                </div>
                <div className="sim-chart">
                    <Line data={simChartData} options={chartOpts({ label: ctx => ctx.parsed.y!=null ? ` $${ctx.parsed.y.toFixed(2)}` : null })}/>
                </div>
            </>)}
        </div>
    );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
    const [user, setUser]           = useState(null);   // { email, plan }
    const [authChecked, setAuthChecked] = useState(false);
    const [page, setPage]           = useState('plans');
    const [ticker, setTicker]       = useState('GOOGL');
    const [startDate, setStartDate] = useState('2023-01-01');
    const [endDate, setEndDate]     = useState('2024-06-01');
    const [horizon, setHorizon]     = useState(30);
    const [model, setModel]         = useState('lr');
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [showActual, setShowActual] = useState(false);
    const [responseData, setResponseData] = useState(null);
    const [stats, setStats]         = useState(null);
    const [technicals, setTechnicals] = useState(null);
    const [ratings, setRatings]     = useState(null);
    const [backtest, setBacktest]   = useState(null);
    const [sentiment, setSentiment] = useState(null);
    const [compareData, setCompareData] = useState(null);
    const [compareLoading, setCompareLoading] = useState(false);

    // Restore session on mount
    useEffect(()=>{
        const t = getToken();
        if (t) {
            API.get('/auth/me', { headers: { Authorization: `Bearer ${t}` } })
               .then(r=>{ setUser({ email: r.data.email, plan: r.data.plan }); setPage('dashboard'); })
               .catch(()=>{ clearToken(); })
               .finally(()=>setAuthChecked(true));
        } else { setAuthChecked(true); }
    }, []);

    const access = user ? PLAN_ACCESS[user.plan] : null;
    const meta   = TICKER_META[ticker] || TICKER_META['GOOGL'];
    const planInfo = user ? PLANS.find(p=>p.id===user.plan) : null;

    const handleAuth = useCallback(u=>{ setUser(u); setPage(u.plan==='free'?'plans':'dashboard'); }, []);

    const handleSelectPlan = useCallback(pid=>{
        setUser(u=>({ ...u, plan: pid }));
        setPage('dashboard');
    }, []);

    const logout = () => { clearToken(); setUser(null); setPage('plans'); setChartData(null); setStats(null); };

    const goPlans = () => setPage('plans');

    const fetchForecast = async () => {
        setLoading(true);
        try {
            const res  = await API.post('/forecast', { ticker, start: startDate, end: endDate, horizon: parseInt(horizon), model }, { headers: authHeader() });
            const data = res.data;
            setResponseData(data);
            setChartData(buildChart(data, showActual, model));
            const prices = data.history.y;
            const lp     = prices[prices.length-1];
            const fe     = data.forecast.y[data.forecast.y.length-1];
            setStats({ lastPrice: lp.toFixed(2), forecastEnd: fe.toFixed(2), change: ((fe-lp)/lp*100).toFixed(2), mape: computeMAPE(data.actual_future, data.forecast.y, data.forecast.x) });
            setTechnicals(data.technicals);
            setRatings(data.ratings);
            setBacktest(data.backtest);
            setSentiment(computeSentiment(prices));
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleToggle = () => {
        const nv = !showActual;
        setShowActual(nv);
        if (responseData) setChartData(buildChart(responseData, nv, model));
    };

    const techSig = (key, val) => val > 0 ? 'bull' : 'bear';

    const fetchCompare = async () => {
        setCompareLoading(true);
        try {
            const res = await API.post('/compare',
                { ticker, start: startDate, end: endDate, horizon: parseInt(horizon) },
                { headers: authHeader() }
            );
            setCompareData(res.data);
        } catch(e) { console.error(e); }
        setCompareLoading(false);
    };

    if (!authChecked) return <><style>{css}</style><div className="wrap"><div style={{textAlign:'center',paddingTop:120,color:'#9ca3af',fontFamily:'DM Mono,monospace',fontSize:13}}>Loading…</div></div></>;
    if (!user)        return <><style>{css}</style><div className="wrap"><AuthPage onAuth={handleAuth}/></div></>;

    return (
        <>
            <style>{css}</style>
            {loading && <Spinner/>}
            <div className="wrap">
                {/* NAV */}
                <nav className="nav">
                    <div className="nav-logo">StockSense ◈</div>
                    <div className="nav-right">

                        <div className="nav-tabs">
                            {[['dashboard','📊 Dashboard'],
                              ...(access?.watchlist?[['watchlist','⭐ Watchlist']]:[]),
                              ['plans','💳 Plans']
                            ].map(([id,label])=>(
                                <button key={id} className={`nav-tab${page===id?' active':''}`} onClick={()=>setPage(id)}>{label}</button>
                            ))}
                        </div>
                        {planInfo && (
                            <div className="plan-chip" style={{borderColor:planInfo.color,color:planInfo.color,background:planInfo.color+'12'}} onClick={goPlans}>
                                {planInfo.name}
                            </div>
                        )}
                        <button className="logout-btn" onClick={logout}>Sign Out</button>
                    </div>
                </nav>

                {/* PLANS */}
                {page==='plans' && <PlansPage currentPlan={user.plan} onSelectPlan={handleSelectPlan}/>}

                {/* WATCHLIST */}
                {page==='watchlist' && access?.watchlist && <WatchlistPage onSelect={sym=>{ setTicker(sym); setPage('dashboard'); }}/>}

                {/* DASHBOARD */}
                {page==='dashboard' && (<>
                    <div className="hero">
                        <div className="hero-eye">AI-Powered Investment Intelligence</div>
                        <h1>Financial Forecast Engine</h1>
                    </div>

                    <div className="main-grid">
                        {/* LEFT PANEL */}
                        <div className="panel">
                            <div className="section-label">Asset</div>
                            <div className="field">
                                <label>Ticker Symbol</label>
                                <select value={ticker} onChange={e=>setTicker(e.target.value)}>
                                    {Object.entries(TICKER_META).map(([sym,m])=>(
                                        <option key={sym} value={sym} disabled={!access?.tickers.includes(sym)}>
                                            {sym} — {m.name}{!access?.tickers.includes(sym)?' 🔒':''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="divider"/>
                            <div className="section-label">Training Window</div>
                            <div className="field"><label>Start Date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
                            <div className="field"><label>Cutoff Date</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
                            <div className="field">
                                <label>Forecast Horizon (Days)</label>
                                <input type="number" value={horizon} onChange={e=>setHorizon(Math.min(access?.horizonMax||30, parseInt(e.target.value)||1))} min="1" max={access?.horizonMax||30}/>
                                {user.plan==='free' && <span style={{fontSize:11,color:'#9ca3af',fontFamily:'DM Mono,monospace'}}>Max 30 days on Free</span>}
                            </div>

                            <div className="divider"/>
                            <div className="section-label">Model</div>
                            <div className="model-cards">
                                {Object.entries(MODEL_META).map(([key,mm])=>{
                                    const locked = !access?.models.includes(key);
                                    return (
                                        <div key={key} className={`model-card${model===key?' '+mm.sel:''}${locked?' disabled':''}`} onClick={()=>!locked&&setModel(key)}>
                                            <div className="dot" style={{background:mm.dot}}/>
                                            <div><div className="mc-name">{mm.label}</div><div className="mc-desc">{mm.desc}</div></div>
                                            {locked && <span className="mc-lock">🔒 Basic+</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="divider"/>
                            <div className="section-label">Overlay</div>
                            <div className="toggle-row">
                                <span>Show Actual Prices</span>
                                <label className="tog"><input type="checkbox" checked={showActual} onChange={handleToggle}/><span className="tog-sl"/></label>
                            </div>

                            <button className="run-btn" onClick={fetchForecast} disabled={loading}>▶ Run Analysis</button>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div>
                            {/* CHART */}
                            <div className="panel">
                                <div className="chart-hdr">
                                    <span className="chart-title">Price Forecast</span>
                                    <div className="ticker-pill">
                                        <img src={meta.logo} alt={ticker} onError={e=>e.target.style.display='none'}/>
                                        <div><div className="tp-sym">{ticker}</div><div className="tp-name">{meta.name}</div></div>
                                    </div>
                                </div>
                                <div className="chart-area">
                                    {chartData
                                        ? <Line data={chartData} options={chartOpts()}/>
                                        : <div className="chart-empty"><img src={meta.logo} alt={ticker} style={{width:50,height:50,borderRadius:'50%',objectFit:'contain',opacity:.18,border:'1px solid #e5e7eb',padding:4}} onError={e=>e.target.style.display='none'}/><div className="chart-empty-txt">Configure parameters<br/>and run analysis to<br/>generate forecast</div></div>
                                    }
                                </div>
                            </div>

                            {/* STAT CARDS */}
                            {stats && (
                                <div className="stat-bar">
                                    <div className="stat-card"><div className="stat-lbl">Last Close</div><div className="stat-val">${stats.lastPrice}</div><div className="stat-sub">at cutoff date</div></div>
                                    <div className="stat-card"><div className="stat-lbl">Forecast End</div><div className="stat-val">${stats.forecastEnd}</div><div className="stat-sub">at horizon end</div></div>
                                    <div className="stat-card"><div className="stat-lbl">Expected Move</div><div className={`stat-val ${parseFloat(stats.change)>=0?'pos':'neg'}`}>{parseFloat(stats.change)>0?'+':''}{stats.change}%</div><div className="stat-sub">vs last close</div></div>
                                    <div className="stat-card"><div className="stat-lbl">MAPE</div><div className={`stat-val ${stats.mape===null?'':parseFloat(stats.mape)<5?'pos':parseFloat(stats.mape)<15?'neu':'neg'}`}>{stats.mape!==null?`${stats.mape}%`:'—'}</div><div className="stat-sub">{stats.mape!==null?'forecast accuracy':'no actuals yet'}</div></div>
                                </div>
                            )}

                            {/* INVESTMENT SIMULATOR */}
                            {stats && (
                                <div style={{marginTop:20}}>
                                    <InvestmentSimulator
                                        ticker={ticker} cutoff={endDate} horizon={parseInt(horizon)}
                                        model={model} trainStart={startDate}
                                        access={access?.simulate}
                                        onUpgrade={goPlans}
                                    />
                                </div>
                            )}

                            {/* RATINGS */}
                            {ratings && (<>
                                <div className="section-header"><h3>Investment Ratings</h3><span className="section-tag">AI-POWERED</span></div>
                                {access?.ratings ? (
                                    <div className="ratings-grid">
                                        {[['short','Short Term','~30 days'],['medium','Medium Term','~90 days'],['long','Long Term','~365 days']].map(([key,label,sub])=>{
                                            const r=ratings[key];
                                            return (
                                                <div key={key} className="rating-card" style={{background:RATING_BG[r.rating],borderColor:RATING_BORDER[r.rating]}}>
                                                    <div className="rc-horizon">{label} · {sub}</div>
                                                    <div className="rc-badge" style={{background:GAUGE_COLORS[r.rating]+'22',color:GAUGE_COLORS[r.rating]}}>{r.rating==='BUY'?'▲':r.rating==='SELL'?'▼':'—'} {r.rating}</div>
                                                    <div className="rc-row"><span className="rc-key">Expected Return</span><span className="rc-val" style={{color:r.expected_return>=0?'#059669':'#dc2626'}}>{r.expected_return>0?'+':''}{r.expected_return}%</span></div>
                                                    <div className="rc-row"><span className="rc-key">Target Price</span><span className="rc-val">${r.end_price}</span></div>
                                                    <div className="rc-row"><span className="rc-key">Confidence</span><span className="rc-val">{r.confidence}%</span></div>
                                                    <div className="conf-bar"><div className="conf-fill" style={{width:`${r.confidence}%`,background:GAUGE_COLORS[r.rating]}}/></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <Locked onUpgrade={goPlans} height={160}>
                                        <div className="ratings-grid">{['Short','Medium','Long'].map(l=><div key={l} className="rating-card" style={{background:'#f5f5f5',borderColor:'#e5e7eb',minHeight:110}}/>)}</div>
                                    </Locked>
                                )}
                            </>)}

                            {/* SENTIMENT */}
                            {sentiment && access?.ratings && (<>
                                <div className="section-header"><h3>Market Sentiment</h3><span className="section-tag">PRICE-BASED</span></div>
                                <div className="sentiment-row">
                                    <div className="sent-card"><div className="sent-emoji">📈</div><div className="sent-label sent-pos">Bullish</div><div className="sent-val sent-pos">{sentiment.positive}%</div></div>
                                    <div className="sent-card"><div className="sent-emoji">😐</div><div className="sent-label sent-neu">Neutral</div><div className="sent-val sent-neu">{sentiment.neutral}%</div></div>
                                    <div className="sent-card"><div className="sent-emoji">📉</div><div className="sent-label sent-neg">Bearish</div><div className="sent-val sent-neg">{sentiment.negative}%</div></div>
                                </div>
                            </>)}

                            {/* SIMPLIFIED TECHNICALS — MA50, MA200, Volatility only */}
                            {technicals && (<>
                                <div className="section-header"><h3>Market Signals</h3><span className="section-tag">LIVE</span></div>
                                {access?.technicals ? (
                                    <div className="tech-grid-3">
                                        {[
                                            ['vs MA-50', `${technicals.price_vs_ma50>0?'+':''}${technicals.price_vs_ma50}%`, `50-day avg: $${technicals.ma50}`, technicals.price_vs_ma50>=0?'bull':'bear', technicals.price_vs_ma50>=0?'ABOVE MA':'BELOW MA'],
                                            ['vs MA-200', `${technicals.price_vs_ma200>0?'+':''}${technicals.price_vs_ma200}%`, `200-day avg: $${technicals.ma200}`, technicals.price_vs_ma200>=0?'bull':'bear', technicals.price_vs_ma200>=0?'ABOVE MA':'BELOW MA'],
                                            ['Volatility', `${technicals.volatility}%`, 'Annualised (60d)', technicals.volatility>40?'bear':technicals.volatility>20?'neut':'bull', technicals.volatility>40?'HIGH':'MED VOL'<20?'LOW':'MED'],
                                        ].map(([name,val,sub,sig,badge])=>(
                                            <div className="tech-card" key={name}>
                                                <div className="tech-name">{name}</div>
                                                <div className="tech-val" style={{color:sig==='bull'?'#059669':sig==='bear'?'#dc2626':'#d97706'}}>{val}</div>
                                                <div className="tech-sub">{sub}</div>
                                                <div className={`tech-badge ${sig}`}>{badge}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <Locked onUpgrade={goPlans} height={120}>
                                        <div className="tech-grid-3">{[1,2,3].map(i=><div key={i} className="tech-card" style={{minHeight:90,background:'#f5f5f5'}}/>)}</div>
                                    </Locked>
                                )}
                            </>)}

                            {/* BACKTEST */}
                            {backtest?.mape!==undefined && (<>
                                <div className="section-header"><h3>Backtest Results</h3><span className="section-tag">IN-SAMPLE</span></div>
                                {access?.backtest ? (
                                    <div className="backtest-card">
                                        <div className="bt-header">
                                            <div>
                                                <div className="stat-lbl">Model Accuracy on Historical Data</div>
                                                <div style={{fontSize:13,color:'#6b7280',marginTop:4}}>Tested on last {horizon} days of training window</div>
                                            </div>
                                            <div>
                                                <div className="stat-lbl">MAPE Score</div>
                                                <div className={`bt-mape ${backtest.mape<5?'good':backtest.mape<15?'ok':'bad'}`}>{backtest.mape}%</div>
                                            </div>
                                        </div>
                                        <span style={{fontSize:13,fontWeight:800,color:backtest.mape<5?'#059669':backtest.mape<15?'#d97706':'#dc2626'}}>
                                            {backtest.mape<5?'✓ Excellent accuracy':backtest.mape<15?'△ Acceptable accuracy':'✗ Poor accuracy — consider more data'}
                                        </span>
                                    </div>
                                ) : (
                                    <Locked onUpgrade={goPlans} height={110}>
                                        <div className="backtest-card" style={{minHeight:90,background:'#f5f5f5'}}/>
                                    </Locked>
                                )}
                            </>)}

                            {/* MODEL COMPARISON TABLE */}
                            {stats && (<>
                                <div className="section-header">
                                    <h3>Model Comparison</h3>
                                    <span className="section-tag">HOLDOUT RANKED</span>
                                    <button className="compare-run-btn" onClick={fetchCompare} disabled={compareLoading} style={{marginLeft:'auto'}}>
                                        {compareLoading ? 'Running…' : '⚡ Compare All Models'}
                                    </button>
                                </div>
                                {compareData ? (
                                    <div className="compare-wrap">
                                        <p style={{fontSize:12,color:'var(--muted)',marginBottom:16,fontFamily:'DM Mono,monospace'}}>
                                            All 4 models tested on the last {compareData.horizon} days of your training window · ranked by MAPE ↑ lower is better
                                        </p>
                                        <table className="compare-table">
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Model</th>
                                                    <th>MAPE ↑</th>
                                                    <th>MAE</th>
                                                    <th>RMSE</th>
                                                    <th>Dir. Accuracy</th>
                                                    <th>Pred. Return</th>
                                                    <th>Actual Return</th>
                                                    <th>Verdict</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {compareData.ranked.map((r, i) => {
                                                    if (r.error) return (
                                                        <tr key={r.model}>
                                                            <td>—</td>
                                                            <td><div className="model-dot-cell"><div className="dot" style={{background:MODEL_COLORS[r.model]}}/>{MODEL_META[r.model]?.label}</div></td>
                                                            <td colSpan={7} style={{color:'var(--red)',fontFamily:'DM Mono,monospace',fontSize:11}}>{r.error}</td>
                                                        </tr>
                                                    );
                                                    const maxMape = Math.max(...compareData.ranked.filter(x=>x.mape).map(x=>x.mape));
                                                    const rankClass = ['rank-1','rank-2','rank-3','rank-4'][i] || 'rank-4';
                                                    const verdict = r.mape < 5 ? {label:'Excellent',color:'#059669'} : r.mape < 10 ? {label:'Good',color:'#0891b2'} : r.mape < 20 ? {label:'Acceptable',color:'#d97706'} : {label:'Poor',color:'#dc2626'};
                                                    return (
                                                        <tr key={r.model}>
                                                            <td><span className={`rank-badge ${rankClass}`}>{r.rank}</span></td>
                                                            <td>
                                                                <div className="model-dot-cell">
                                                                    <div className="dot" style={{background:MODEL_COLORS[r.model]}}/>
                                                                    <span>{MODEL_META[r.model]?.label || r.model}</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="mape-bar-wrap">
                                                                    <span style={{fontFamily:'DM Mono,monospace',minWidth:42}}>{r.mape}%</span>
                                                                    <div className="mape-bar-bg">
                                                                        <div className="mape-bar-fill" style={{width:`${Math.min(100,(r.mape/maxMape)*100)}%`,background:r.mape<5?'#059669':r.mape<15?'#d97706':'#dc2626'}}/>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{fontFamily:'DM Mono,monospace'}}>${r.mae}</td>
                                                            <td style={{fontFamily:'DM Mono,monospace'}}>${r.rmse}</td>
                                                            <td>
                                                                <div className="dir-acc-bar">
                                                                    <span style={{fontFamily:'DM Mono,monospace',minWidth:38}}>{r.directional_acc}%</span>
                                                                    <div className="dir-bar-bg"><div className="dir-bar-fill" style={{width:`${r.directional_acc}%`}}/></div>
                                                                </div>
                                                            </td>
                                                            <td style={{color:r.expected_return>=0?'#059669':'#dc2626',fontFamily:'DM Mono,monospace'}}>
                                                                {r.expected_return>0?'+':''}{r.expected_return}%
                                                            </td>
                                                            <td style={{color:r.actual_return>=0?'#059669':'#dc2626',fontFamily:'DM Mono,monospace'}}>
                                                                {r.actual_return>0?'+':''}{r.actual_return}%
                                                            </td>
                                                            <td><span style={{color:verdict.color,fontWeight:800,fontSize:12}}>{verdict.label}</span></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div style={{marginTop:14,padding:'10px 14px',background:'#fafaf9',borderRadius:10,border:'1px solid var(--border)'}}>
                                            <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--faint)'}}>
                                                💡 MAPE = mean absolute % error · MAE = mean absolute error in $ · Dir. Accuracy = % of days model correctly predicted up/down movement
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="compare-wrap" style={{textAlign:'center',padding:'32px 22px',color:'var(--faint)'}}>
                                        <div style={{fontSize:28,marginBottom:10}}>⚡</div>
                                        <div style={{fontFamily:'DM Mono,monospace',fontSize:12,letterSpacing:1}}>Click "Compare All Models" to run all 4 models<br/>on your holdout window and see ranked performance</div>
                                    </div>
                                )}
                            </>)}
                        </div>
                    </div>
                </>)}
            </div>
        </>
    );
}
