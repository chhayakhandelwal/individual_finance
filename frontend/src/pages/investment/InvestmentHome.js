import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./investmentHome.css";

import MarketCompare from "./tabs/MarketCompare";
import SipPlanner from "./tabs/SipPlanner";
import InvestmentGoals from "./tabs/InvestmentGoals";
import ActivePassiveFunds from "./tabs/ActivePassiveFunds";

import InvestmentAssets from "./investmentAssets";
import InvestmentTransactions from "./investmentTransactions";
import InvestmentRecommendation from "./InvestmentRecommendation";

import { Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

/* ---------- TOKEN UTILS (same as Savings) ---------- */
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const readToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  for (const k of TOKEN_KEYS) {
    const v = sessionStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

export default function InvestmentHome() {
  const [activeTab, setActiveTab] = useState("overview");

  const [summary, setSummary] = useState(null);
  const [txns, setTxns] = useState([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5001";

  /* ---------- LOCAL AXIOS INSTANCE ---------- */
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
    });

    instance.interceptors.request.use((config) => {
      const token = readToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, [API_BASE_URL]);

  const ensureLoggedIn = () => {
    const token = readToken();
    if (!token) {
      setErrorMsg("You are not logged in. Please login first.");
      return false;
    }
    return true;
  };

  const logAxios = (label, err) => {
    const status = err?.response?.status;
    const url = err?.config?.url;
    const data = err?.response?.data;
    console.error(`${label} | status=${status} | url=${url}`);
    if (data) console.error("Backend:", JSON.stringify(data, null, 2));
    else console.error("Message:", err?.message);
  };

  /* ---------- FETCH SUMMARY ---------- */
  const fetchSummary = useCallback(async () => {
    if (!ensureLoggedIn()) {
      setSummary(null);
      return;
    }

    try {
      const res = await api.get("/api/investment/portfolio/summary");
      setSummary(res.data);
    } catch (err) {
      logAxios("SUMMARY ERROR", err);
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
      setErrorMsg(backendMsg || "Failed to load investment summary.");
      setSummary(null);
    }
  }, [api]);

  /* ---------- FETCH TRANSACTIONS ---------- */
  const fetchTransactions = useCallback(async () => {
    if (!ensureLoggedIn()) {
      setTxns([]);
      return;
    }

    try {
      const res = await api.get("/api/investment/transactions");
      setTxns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      logAxios("TXNS ERROR", err);
      setTxns([]);
    }
  }, [api]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await Promise.all([fetchSummary(), fetchTransactions()]);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchTransactions]);

  useEffect(() => {
    refreshAll();

    const handler = () => refreshAll();
    window.addEventListener("auth-token-changed", handler);
    return () => window.removeEventListener("auth-token-changed", handler);
  }, [refreshAll]);

  /* ---------- CHART DATA (Overview only) ---------- */
  const allocationByType = useMemo(() => {
    const rows = summary?.holdings || [];
    const totals = {};

    for (const h of rows) {
      const type = h.asset_type || "OTHER";
      const currentVal = Number(h.current_value);
      const investedVal = Number(h.avg_cost) * Number(h.net_qty);

      const v =
        Number.isFinite(currentVal) && currentVal > 0
          ? currentVal
          : Number.isFinite(investedVal) && investedVal > 0
          ? investedVal
          : 0;

      totals[type] = (totals[type] || 0) + v;
    }

    const entries = Object.entries(totals).filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [summary]);

  const pieData = useMemo(
    () => ({
      labels: allocationByType.map(([t]) => t),
      datasets: [{ label: "Allocation", data: allocationByType.map(([, v]) => v) }],
    }),
    [allocationByType]
  );

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${inr(ctx.parsed)}` } },
      },
    }),
    []
  );

  const investedSeries = useMemo(() => {
    if (!txns?.length) return [];

    const sorted = [...txns].sort((a, b) => {
      if (a.txn_date === b.txn_date) return (a.id || 0) - (b.id || 0);
      return String(a.txn_date).localeCompare(String(b.txn_date));
    });

    let cumulative = 0;
    const pointsByDate = new Map();

    for (const t of sorted) {
      const qty = Number(t.quantity) || 0;
      const price = Number(t.price) || 0;
      const fees = Number(t.fees) || 0;
      const gross = qty * price;

      const type = String(t.txn_type || "").toUpperCase();
      if (type === "BUY" || type === "SIP") cumulative += gross + fees;
      else if (type === "SELL") cumulative -= gross - fees;

      pointsByDate.set(t.txn_date, cumulative);
    }

    return Array.from(pointsByDate.entries()).map(([date, value]) => ({ date, value }));
  }, [txns]);

  const lineData = useMemo(
    () => ({
      labels: investedSeries.map((p) => p.date),
      datasets: [
        {
          label: "Invested (Cumulative)",
          data: investedSeries.map((p) => p.value),
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    }),
    [investedSeries]
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${inr(ctx.parsed.y)}` } },
      },
    }),
    []
  );

  return (
    <div className="inv-wrap">
      <div className="inv-top">
        <div className="inv-title">
          <h2>Investment</h2>
          <div className="inv-subtitle">
            Portfolio, SIP planning, goals, market comparison, and recommendations
          </div>
        </div>

        <div className="inv-actions">
          <button className="inv-btn" onClick={refreshAll} disabled={loading} type="button">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ✅ TAB BAR */}
      <div className="inv-tabs">
        <button
          className={`inv-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          Overview
        </button>

        {/* ✅ NEW TAB: Active/Passive Funds */}
        <button
          className={`inv-tab ${activeTab === "funds" ? "active" : ""}`}
          onClick={() => setActiveTab("funds")}
          type="button"
        >
          Active/Passive Funds
        </button>

        <button
          className={`inv-tab ${activeTab === "sip" ? "active" : ""}`}
          onClick={() => setActiveTab("sip")}
          type="button"
        >
          SIP Planner
        </button>

        <button
          className={`inv-tab ${activeTab === "goals" ? "active" : ""}`}
          onClick={() => setActiveTab("goals")}
          type="button"
        >
          Goal-Based Investing 🎯
        </button>

        <button
          className={`inv-tab ${activeTab === "recommend" ? "active" : ""}`}
          onClick={() => setActiveTab("recommend")}
          type="button"
        >
          Recommendation
        </button>

        <button
          className={`inv-tab ${activeTab === "market" ? "active" : ""}`}
          onClick={() => setActiveTab("market")}
          type="button"
        >
          Market Comparison
        </button>

        <button
          className={`inv-tab ${activeTab === "assets" ? "active" : ""}`}
          onClick={() => setActiveTab("assets")}
          type="button"
        >
          Assets
        </button>

        <button
          className={`inv-tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
          type="button"
        >
          Transactions
        </button>
      </div>

      {errorMsg && <div className="inv-alert">{errorMsg}</div>}

      <div className="inv-tab-content">
        {/* ✅ OVERVIEW TAB (requires summary) */}
        {activeTab === "overview" && (
          <>
            {!summary ? (
              <div className="inv-empty">Loading Overview…</div>
            ) : (
              <>
                <div className="inv-grid-4">
                  <SummaryCard
                    title="Invested"
                    value={summary.invested == null ? "-" : inr(summary.invested)}
                  />
                  <SummaryCard
                    title="Current Value"
                    value={summary.value == null ? "-" : inr(summary.value)}
                  />
                  <SummaryCard title="P&L" value={summary.pnl == null ? "-" : inr(summary.pnl)} />
                  <SummaryCard
                    title="Return %"
                    value={summary.pnlPct == null ? "-" : `${Number(summary.pnlPct).toFixed(2)}%`}
                  />
                </div>

                <div className="inv-grid-charts">
                  <div className="inv-panel">
                    <h3>Allocation (by Type)</h3>
                    {allocationByType.length === 0 ? (
                      <div className="inv-empty">No allocation data yet.</div>
                    ) : (
                      <div className="panel-body">
                        <Pie data={pieData} options={pieOptions} />
                      </div>
                    )}
                  </div>

                  <div className="inv-panel">
                    <h3>Invested Over Time</h3>
                    {investedSeries.length < 2 ? (
                      <div className="inv-empty">
                        Add at least 2 transactions on different dates to plot.
                      </div>
                    ) : (
                      <div className="panel-body">
                        <Line data={lineData} options={lineOptions} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ✅ NEW FUNDS TAB */}
        {activeTab === "funds" && <ActivePassiveFunds />}

        {/* ✅ SIP PLANNER TAB */}
        {activeTab === "sip" && <SipPlanner />}

        {/* ✅ GOALS TAB */}
        {activeTab === "goals" && <InvestmentGoals />}

        {/* ✅ RECOMMENDATION TAB */}
        {activeTab === "recommend" && <InvestmentRecommendation />}

        {/* ✅ MARKET COMPARISON TAB */}
        {activeTab === "market" && <MarketCompare />}

        {/* ✅ ASSETS TAB */}
        {activeTab === "assets" && <InvestmentAssets />}

        {/* ✅ TRANSACTIONS TAB */}
        {activeTab === "transactions" && <InvestmentTransactions onAfterChange={refreshAll} />}
      </div>
    </div>
  );
}

/* ---------- UI HELPERS ---------- */
function SummaryCard({ title, value }) {
  return (
    <div className="inv-card">
      <div className="k">{title}</div>
      <div className="v">{value}</div>
    </div>
  );
}

function inr(x) {
  return Number(x || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}