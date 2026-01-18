import React, { useMemo, useState } from "react";
import axios from "axios";
import "./investmentRecommendation.css";

import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

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

// ---- helpers ----
function parseReturnRange(str) {
  // Accepts: "10% – 12%" or "10% - 12%" or "10%-12%" or "12%"
  if (!str || typeof str !== "string") return null;
  const s = str.replace(/\s/g, "");
  const matches = s.match(/(\d+(\.\d+)?)/g);
  if (!matches || matches.length === 0) return null;

  const nums = matches.map(Number).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;

  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
}

function fv(principal, ratePct, years) {
  // FV = P * (1 + r)^n
  const P = Number(principal) || 0;
  const r = (Number(ratePct) || 0) / 100;
  const n = Number(years) || 0;
  if (P <= 0 || n <= 0) return 0;
  return P * Math.pow(1 + r, n);
}

function inr(x) {
  return Number(x || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function InvestmentRecommendation() {
  const [form, setForm] = useState({
    risk: "MEDIUM",
    horizon: 5,
    amount: "",
    type: "BOTH",
    goal: "WEALTH",
  });

  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5001";

  const ensureLoggedIn = () => {
    const token = readToken();
    if (!token) {
      setMsg("You are not logged in. Please login first.");
      return null;
    }
    return token;
  };

  const validate = () => {
    const amountNum = Number(form.amount);
    const horizonNum = Number(form.horizon);

    if (!Number.isFinite(horizonNum) || horizonNum <= 0) return "Horizon must be > 0 (years).";
    if (!Number.isFinite(amountNum) || amountNum <= 0) return "Amount must be > 0.";
    if (!["LOW", "MEDIUM", "HIGH"].includes(form.risk)) return "Invalid risk value.";
    if (!["STOCK", "MF", "BOTH"].includes(form.type)) return "Invalid type value.";
    return null;
  };

  const submit = async () => {
    const token = ensureLoggedIn();
    if (!token) return;

    const err = validate();
    if (err) {
      setMsg(err);
      setResult(null);
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const payload = {
        risk: form.risk,
        horizon: Number(form.horizon),
        amount: Number(form.amount),
        type: form.type,
        goal: form.goal,
      };

      const res = await axios.post(
        `${API_BASE_URL}/api/investment/recommend`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(res.data);
    } catch (e) {
      const backendMsg = e?.response?.data?.message;
      setMsg(backendMsg || "Failed to get recommendation");
      setResult(null);
      console.error("RECOMMEND ERROR:", e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Allocation Pie ----
  const allocation = result?.allocation || null;

  const pieData = useMemo(() => {
    if (!allocation) return null;
    return {
      labels: ["Equity", "Debt", "Gold"],
      datasets: [
        {
          label: "Allocation %",
          data: [allocation.equity || 0, allocation.debt || 0, allocation.gold || 0],
        },
      ],
    };
  }, [allocation]);

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
          },
        },
      },
    }),
    []
  );

  // ---- Corpus calculator ----
  const range = useMemo(() => parseReturnRange(result?.expectedReturn), [result?.expectedReturn]);

  const corpus = useMemo(() => {
    if (!result || !range) return null;

    const P = Number(form.amount);
    const years = Number(form.horizon);

    const lowFV = fv(P, range.low, years);
    const highFV = fv(P, range.high, years);
    const midRate = (range.low + range.high) / 2;
    const midFV = fv(P, midRate, years);

    return {
      lowRate: range.low,
      highRate: range.high,
      midRate,
      lowFV,
      midFV,
      highFV,
    };
  }, [result, range, form.amount, form.horizon]);

  const badges = useMemo(() => {
    if (!result) return [];
    return [
      `Risk: ${form.risk}`,
      `Horizon: ${form.horizon}y`,
      `Type: ${form.type}`,
      `Expected: ${result.expectedReturn || "-"}`,
    ];
  }, [result, form]);

  return (
    <div className="invR-wrap">
      <h3>Investment Recommendation</h3>

      <div className="invR-form">
        <select
          value={form.risk}
          onChange={(e) => setForm((p) => ({ ...p, risk: e.target.value }))}
        >
          <option value="LOW">Low Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="HIGH">High Risk</option>
        </select>

        <input
          type="number"
          min="1"
          placeholder="Years"
          value={form.horizon}
          onChange={(e) => setForm((p) => ({ ...p, horizon: e.target.value }))}
        />

        <input
          type="number"
          min="1"
          placeholder="Amount (₹)"
          value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
        />

        <select
          value={form.type}
          onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
        >
          <option value="STOCK">Stocks</option>
          <option value="MF">Mutual Funds</option>
          <option value="BOTH">Both</option>
        </select>

        <button type="button" onClick={submit} disabled={loading}>
          {loading ? "Calculating..." : "Get Recommendation"}
        </button>
      </div>

      {msg && <div className="invR-msg">{msg}</div>}

      {result && (
        <div className="invR-result">
          <div className="invR-badges">
            {badges.map((b) => (
              <span key={b} className="invR-pill muted">
                {b}
              </span>
            ))}
          </div>

          {/* ===== Allocation + Pie ===== */}
          {allocation && (
            <>
              <h4>Suggested Allocation</h4>
              <div className="invR-alloc">
                <div className="invR-allocCard">
                  <div className="k">Equity</div>
                  <div className="v">{allocation.equity}%</div>
                </div>
                <div className="invR-allocCard">
                  <div className="k">Debt</div>
                  <div className="v">{allocation.debt}%</div>
                </div>
                <div className="invR-allocCard">
                  <div className="k">Gold</div>
                  <div className="v">{allocation.gold}%</div>
                </div>
              </div>

              <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>Allocation Pie</h4>
                <div style={{ height: 260 }}>
                  <Pie data={pieData} options={pieOptions} />
                </div>
              </div>
            </>
          )}

          {/* ===== Corpus Calculator ===== */}
          <h4>Approx Corpus (Lumpsum)</h4>
          {!corpus ? (
            <p className="muted">Corpus estimate will appear after recommendation.</p>
          ) : (
            <>
              <div className="invR-alloc" style={{ marginTop: 8 }}>
                <div className="invR-allocCard">
                  <div className="k">Low ({corpus.lowRate}%)</div>
                  <div className="v">{inr(corpus.lowFV)}</div>
                </div>
                <div className="invR-allocCard">
                  <div className="k">Mid ({corpus.midRate.toFixed(1)}%)</div>
                  <div className="v">{inr(corpus.midFV)}</div>
                </div>
                <div className="invR-allocCard">
                  <div className="k">High ({corpus.highRate}%)</div>
                  <div className="v">{inr(corpus.highFV)}</div>
                </div>
              </div>

              <p style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
                Formula: FV = P × (1 + r)^n (lumpsum estimate)
              </p>
            </>
          )}

          {/* ===== Suggestions ===== */}
          <h4>Suggested Stocks (India)</h4>
          {result.stocks?.length ? (
            <ul className="invR-list">
              {result.stocks.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No stock suggestions for selected type.</p>
          )}

          <h4>Suggested Mutual Funds (India)</h4>
          {result.mutualFunds?.length ? (
            <ul className="invR-list">
              {result.mutualFunds.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No mutual fund suggestions for selected type.</p>
          )}

          <h4>Note</h4>
          <p>{result.note || "Returns are indicative and not guaranteed."}</p>
        </div>
      )}
    </div>
  );
}