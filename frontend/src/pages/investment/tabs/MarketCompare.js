import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./investmentTheme.css";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

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

function pct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

function inr(x) {
  return Number(x || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

// Build a simple portfolio value series from transactions (invested cumulative).
// Later you can switch to "portfolio NAV series" if you add prices.
function buildPortfolioSeries(txns) {
  if (!txns?.length) return [];

  const sorted = [...txns].sort((a, b) => {
    if (a.txn_date === b.txn_date) return (a.id || 0) - (b.id || 0);
    return String(a.txn_date).localeCompare(String(b.txn_date));
  });

  let cumulative = 0;
  const map = new Map(); // date -> cumulative

  for (const t of sorted) {
    const qty = Number(t.quantity) || 0;
    const price = Number(t.price) || 0;
    const fees = Number(t.fees) || 0;

    const gross = qty * price;
    const type = String(t.txn_type || "").toUpperCase();

    if (type === "BUY" || type === "SIP") cumulative += gross + fees;
    else if (type === "SELL") cumulative -= gross - fees;

    map.set(t.txn_date, cumulative);
  }

  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

// Normalize series to start at 100 for "growth comparison"
function normalizeTo100(series) {
  if (!series?.length) return [];
  const base = Number(series[0].value);
  if (!Number.isFinite(base) || base === 0) return [];
  return series.map((p) => ({ date: p.date, value: (Number(p.value) / base) * 100 }));
}

export default function MarketCompare() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Manual benchmark inputs (works immediately)
  const [niftyStart, setNiftyStart] = useState(22000);
  const [niftyEnd, setNiftyEnd] = useState(24000);
  const [sensexStart, setSensexStart] = useState(72000);
  const [sensexEnd, setSensexEnd] = useState(78000);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5001";

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
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

  const fetchTxns = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setMsg("You are not logged in. Please login first.");
      setTxns([]);
      return;
    }

    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/api/investment/transactions");
      setTxns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("MARKET COMPARE TXNS ERROR:", err?.response?.data || err?.message);
      setMsg(err?.response?.data?.message || "Failed to load transactions.");
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTxns();
  }, [fetchTxns]);

  const portfolioSeries = useMemo(() => buildPortfolioSeries(txns), [txns]);
  const growthPortfolio = useMemo(() => normalizeTo100(portfolioSeries), [portfolioSeries]);

  // Benchmarks as 2-point series using same first & last date as portfolio
  const benchmarkSeries = useMemo(() => {
    if (!growthPortfolio.length) return null;

    const startDate = growthPortfolio[0].date;
    const endDate = growthPortfolio[growthPortfolio.length - 1].date;

    const nifty = [
      { date: startDate, value: 100 },
      { date: endDate, value: (Number(niftyEnd) / Number(niftyStart)) * 100 },
    ];

    const sensex = [
      { date: startDate, value: 100 },
      { date: endDate, value: (Number(sensexEnd) / Number(sensexStart)) * 100 },
    ];

    return { nifty, sensex, startDate, endDate };
  }, [growthPortfolio, niftyStart, niftyEnd, sensexStart, sensexEnd]);

  // Build chart labels from portfolio dates
  const chartData = useMemo(() => {
    if (!growthPortfolio.length) return null;

    const labels = growthPortfolio.map((p) => p.date);

    // For benchmarks, linearly interpolate values across labels (simple and smooth)
    const interpolate = (startVal, endVal) => {
      const n = labels.length;
      if (n <= 1) return labels.map(() => startVal);
      return labels.map((_, i) => startVal + ((endVal - startVal) * i) / (n - 1));
    };

    const niftyEndNorm = benchmarkSeries?.nifty?.[1]?.value ?? 100;
    const sensexEndNorm = benchmarkSeries?.sensex?.[1]?.value ?? 100;

    return {
      labels,
      datasets: [
        {
          label: "Your Portfolio (Invested Growth)",
          data: growthPortfolio.map((p) => p.value),
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: "NIFTY 50 (Manual)",
          data: interpolate(100, niftyEndNorm),
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: "SENSEX (Manual)",
          data: interpolate(100, sensexEndNorm),
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    };
  }, [growthPortfolio, benchmarkSeries]);

  const options = useMemo(
    () => ({
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: {
          ticks: {
            callback: (v) => `${Number(v).toFixed(0)}`,
          },
          title: { display: true, text: "Growth Index (Start = 100)" },
        },
        x: { ticks: { maxTicksLimit: 8 } },
      },
    }),
    []
  );

  const stats = useMemo(() => {
    if (!portfolioSeries.length || !benchmarkSeries) return null;

    const p0 = portfolioSeries[0].value;
    const p1 = portfolioSeries[portfolioSeries.length - 1].value;

    const portPct = pct(p0, p1);

    const niftyPct = pct(Number(niftyStart), Number(niftyEnd));
    const sensexPct = pct(Number(sensexStart), Number(sensexEnd));

    return {
      investedStart: p0,
      investedEnd: p1,
      portPct,
      niftyPct,
      sensexPct,
      outNifty: portPct == null || niftyPct == null ? null : portPct - niftyPct,
      outSensex: portPct == null || sensexPct == null ? null : portPct - sensexPct,
    };
  }, [portfolioSeries, benchmarkSeries, niftyStart, niftyEnd, sensexStart, sensexEnd]);

  return (
    <div className="fin-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Market Comparison</h3>
          <div className="fin-muted">
            Compare your portfolio growth vs benchmarks (NIFTY 50 / SENSEX). Benchmarks are manual for now.
          </div>
        </div>

        <button className="btn btn-primary" onClick={fetchTxns} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {msg && <div style={{ marginTop: 10 }} className="fin-panel">{msg}</div>}

      {!portfolioSeries.length ? (
        <div style={{ marginTop: 12 }} className="fin-muted">
          No transactions yet. Add transactions to see portfolio vs market comparison.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="fin-grid-4" style={{ marginTop: 12 }}>
            <div className="fin-card">
              <div className="fin-k">Invested (Start)</div>
              <div className="fin-v">{inr(stats?.investedStart)}</div>
            </div>
            <div className="fin-card">
              <div className="fin-k">Invested (Latest)</div>
              <div className="fin-v">{inr(stats?.investedEnd)}</div>
            </div>
            <div className="fin-card">
              <div className="fin-k">Portfolio Return</div>
              <div className="fin-v">{stats?.portPct == null ? "-" : `${stats.portPct.toFixed(2)}%`}</div>
            </div>
            <div className="fin-card">
              <div className="fin-k">Outperformance vs NIFTY</div>
              <div className="fin-v">{stats?.outNifty == null ? "-" : `${stats.outNifty.toFixed(2)}%`}</div>
            </div>
          </div>

          {/* Benchmark input panel */}
          <div className="fin-grid-2" style={{ marginTop: 12 }}>
            <div className="fin-panel">
              <h4 style={{ marginTop: 0 }}>Benchmarks (Manual Input)</h4>
              <div className="fin-muted">Enter start & end index values for the same period as your transactions.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div className="fin-k">NIFTY 50 Start</div>
                  <input value={niftyStart} onChange={(e) => setNiftyStart(e.target.value)} />
                </div>
                <div>
                  <div className="fin-k">NIFTY 50 End</div>
                  <input value={niftyEnd} onChange={(e) => setNiftyEnd(e.target.value)} />
                </div>

                <div>
                  <div className="fin-k">SENSEX Start</div>
                  <input value={sensexStart} onChange={(e) => setSensexStart(e.target.value)} />
                </div>
                <div>
                  <div className="fin-k">SENSEX End</div>
                  <input value={sensexEnd} onChange={(e) => setSensexEnd(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 10 }} className="fin-muted">
                NIFTY Return: {stats?.niftyPct == null ? "-" : `${stats.niftyPct.toFixed(2)}%`} | SENSEX Return:{" "}
                {stats?.sensexPct == null ? "-" : `${stats.sensexPct.toFixed(2)}%`}
              </div>
            </div>

            <div className="fin-panel">
              <h4 style={{ marginTop: 0 }}>Chart</h4>
              <div className="fin-muted">Growth index normalized to 100 at start date.</div>

              <div style={{ height: 320, marginTop: 10 }}>
                {chartData ? <Line data={chartData} options={options} /> : <div>No chart data</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}