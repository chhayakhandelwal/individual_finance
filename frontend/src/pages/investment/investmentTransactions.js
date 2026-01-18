import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./investmentTransaction.css";

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

export default function InvestmentTransactions({ onAfterChange }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState([]);

  // For asset dropdown
  const [assets, setAssets] = useState([]);

  // Add form
  const [form, setForm] = useState({
    asset_id: "",
    txn_type: "BUY",
    txn_date: "",
    quantity: "",
    price: "",
    fees: "",
    notes: "",
  });

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

  const ensureLoggedIn = () => {
    const t = readToken();
    if (!t) {
      setMsg("You are not logged in. Please login first.");
      return false;
    }
    return true;
  };

  const fetchAssets = useCallback(async () => {
    if (!ensureLoggedIn()) return;
    try {
      const res = await api.get("/api/investment/assets", { params: { limit: 200 } });
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("TXNS assets list error:", err?.response?.data || err?.message);
      setAssets([]);
    }
  }, [api]);

  const fetchTxns = useCallback(async () => {
    if (!ensureLoggedIn()) return;

    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/api/investment/transactions");
      setTxns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to load transactions");
      console.error("TXNS fetch error:", err?.response?.data || err?.message);
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAssets();
    fetchTxns();
  }, [fetchAssets, fetchTxns]);

  const submit = async (e) => {
    e.preventDefault();
    if (!ensureLoggedIn()) return;

    setMsg("");

    // Minimal validation
    if (!form.asset_id) return setMsg("Please select an asset.");
    if (!form.txn_date) return setMsg("Please select a transaction date.");
    if (!form.quantity || Number(form.quantity) <= 0) return setMsg("Quantity must be > 0.");
    if (!form.price || Number(form.price) <= 0) return setMsg("Price must be > 0.");

    const payload = {
      asset_id: Number(form.asset_id),
      txn_type: form.txn_type,
      txn_date: form.txn_date,
      quantity: Number(form.quantity),
      price: Number(form.price),
      fees: form.fees ? Number(form.fees) : 0,
      notes: form.notes?.trim() || null,
    };

    try {
      await api.post("/api/investment/transactions", payload);
      setMsg("Transaction added.");
      setForm({
        asset_id: "",
        txn_type: "BUY",
        txn_date: "",
        quantity: "",
        price: "",
        fees: "",
        notes: "",
      });
      await fetchTxns();
      onAfterChange?.();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to add transaction");
      console.error("TXNS create error:", err?.response?.data || err?.message);
    }
  };

  return (
    <div className="invT-wrap">
      <div className="invT-head">
        <h3>Transactions</h3>
        <button className="invT-btn invT-btnSecondary" type="button" onClick={fetchTxns}>
          Refresh
        </button>
      </div>

      {msg && <div className="invT-msg">{msg}</div>}

      <div className="invT-grid">
        {/* Add transaction */}
        <div className="invT-panel">
          <div className="invT-panelTitle">Add Transaction</div>

          <form className="invT-form" onSubmit={submit}>
            <label className="invT-label">Asset</label>
            <select
              className="invT-input"
              value={form.asset_id}
              onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
              required
            >
              <option value="">Select asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.symbol ? `(${a.symbol})` : ""} — {a.type}
                </option>
              ))}
            </select>

            <div className="invT-row">
              <div>
                <label className="invT-label">Type</label>
                <select
                  className="invT-input"
                  value={form.txn_type}
                  onChange={(e) => setForm({ ...form, txn_type: e.target.value })}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="SIP">SIP</option>
                  <option value="DIVIDEND">DIVIDEND</option>
                  <option value="COUPON">COUPON</option>
                  <option value="INTEREST">INTEREST</option>
                </select>
              </div>

              <div>
                <label className="invT-label">Date</label>
                <input
                  className="invT-input"
                  type="date"
                  value={form.txn_date}
                  onChange={(e) => setForm({ ...form, txn_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="invT-row">
              <div>
                <label className="invT-label">Quantity</label>
                <input
                  className="invT-input"
                  type="number"
                  step="0.0001"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="invT-label">Price</label>
                <input
                  className="invT-input"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="invT-row">
              <div>
                <label className="invT-label">Fees (optional)</label>
                <input
                  className="invT-input"
                  type="number"
                  step="0.01"
                  value={form.fees}
                  onChange={(e) => setForm({ ...form, fees: e.target.value })}
                />
              </div>

              <div>
                <label className="invT-label">Notes (optional)</label>
                <input
                  className="invT-input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Broker, SIP, etc."
                />
              </div>
            </div>

            <div className="invT-actions">
              <button className="invT-btn invT-btnPrimary" type="submit">
                Add Transaction
              </button>
              <button
                className="invT-btn invT-btnSecondary"
                type="button"
                onClick={() =>
                  setForm({
                    asset_id: "",
                    txn_type: "BUY",
                    txn_date: "",
                    quantity: "",
                    price: "",
                    fees: "",
                    notes: "",
                  })
                }
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* List transactions */}
        <div className="invT-panel">
          <div className="invT-panelTitle">Recent Transactions</div>

          {loading ? (
            <div className="invT-empty">Loading transactions…</div>
          ) : txns.length === 0 ? (
            <div className="invT-empty">No transactions yet.</div>
          ) : (
            <table className="invT-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th className="right">Qty</th>
                  <th className="right">Price</th>
                  <th className="right">Fees</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td className="muted">{t.txn_date}</td>
                    <td>{t.symbol ? `${t.symbol} (${t.exchange || "-"})` : t.asset_name}</td>
                    <td>
                      <span className="invT-pill">{t.txn_type}</span>
                    </td>
                    <td className="right">{Number(t.quantity || 0).toFixed(4)}</td>
                    <td className="right">{Number(t.price || 0).toFixed(2)}</td>
                    <td className="right">{Number(t.fees || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}