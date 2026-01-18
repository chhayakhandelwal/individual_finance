import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./investmentAssets.css";

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

export default function InvestmentAssets() {
  const [type, setType] = useState("STOCK");
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

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

    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/api/investment/assets", {
        params: {
          search: search.trim() || undefined,
          type: filterType || undefined,
        },
      });
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to load assets");
      console.error("ASSETS FETCH ERROR:", err?.response?.data || err?.message);
    } finally {
      setLoading(false);
    }
  }, [api, search, filterType]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const submit = async (e) => {
    e.preventDefault();
    if (!ensureLoggedIn()) return;

    setMsg("");
    try {
      await api.post("/api/investment/assets", { type, ...form });
      setMsg("Asset created successfully");
      setForm({});
      fetchAssets();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to create asset");
      console.error("ASSET CREATE ERROR:", err?.response?.data || err?.message);
    }
  };

  const deleteAsset = async (assetId) => {
    if (!ensureLoggedIn()) return;

    const ok = window.confirm(
      "Delete this asset? This is allowed only if no transactions exist for it."
    );
    if (!ok) return;

    setMsg("");
    try {
      await api.delete(`/api/investment/assets/${assetId}`);
      setMsg("Asset deleted");
      fetchAssets();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setMsg("Cannot delete: transactions exist for this asset. Delete transactions first.");
      } else {
        setMsg(err?.response?.data?.message || "Failed to delete asset");
      }
      console.error("ASSET DELETE ERROR:", err?.response?.data || err?.message);
    }
  };

  const identifierText = (a) => {
    if (a.symbol) return `${a.symbol} (${a.exchange || "-"})`;
    if (a.amfi_code) return `AMFI: ${a.amfi_code}`;
    if (a.isin) return `ISIN: ${a.isin}`;
    if (a.issuer) return `Issuer: ${a.issuer}`;
    return "-";
  };

  return (
    <div className="invA-wrap">
      <div className="invA-head">
        <h3>Assets</h3>
        <button className="invA-btn invA-btnSecondary" type="button" onClick={fetchAssets}>
          Refresh
        </button>
      </div>

      {msg && <div className="invA-msg">{msg}</div>}

      <div className="invA-grid">
        {/* ------- CREATE ASSET ------- */}
        <div className="invA-panel">
          <div className="invA-panelTitle">Add Asset</div>

          <form className="invA-form" onSubmit={submit}>
            <label className="invA-label">Asset Type</label>
            <select className="invA-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="STOCK">Stock</option>
              <option value="MF">Mutual Fund</option>
              <option value="BOND">Bond</option>
              <option value="ETF">ETF</option>
              <option value="GOLD">Gold</option>
              <option value="CASH">Cash</option>
              <option value="FD">FD</option>
            </select>

            <label className="invA-label">Name</label>
            <input
              className="invA-input"
              placeholder="Name"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            {(type === "STOCK" || type === "ETF") && (
              <>
                <label className="invA-label">Symbol</label>
                <input
                  className="invA-input"
                  placeholder="Symbol (e.g., TCS)"
                  value={form.symbol || ""}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  required
                />

                <label className="invA-label">Exchange</label>
                <input
                  className="invA-input"
                  placeholder="Exchange (NSE/BSE)"
                  value={form.exchange || ""}
                  onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                  required
                />

                <label className="invA-label">ISIN (optional)</label>
                <input
                  className="invA-input"
                  placeholder="ISIN"
                  value={form.isin || ""}
                  onChange={(e) => setForm({ ...form, isin: e.target.value })}
                />
              </>
            )}

            {type === "MF" && (
              <>
                <label className="invA-label">AMFI Code</label>
                <input
                  className="invA-input"
                  placeholder="AMFI Code"
                  value={form.amfi_code || ""}
                  onChange={(e) => setForm({ ...form, amfi_code: e.target.value })}
                  required
                />
              </>
            )}

            {type === "BOND" && (
              <>
                <label className="invA-label">Issuer (optional)</label>
                <input
                  className="invA-input"
                  placeholder="Issuer"
                  value={form.issuer || ""}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                />

                <label className="invA-label">Coupon Rate % (optional)</label>
                <input
                  className="invA-input"
                  placeholder="Coupon Rate"
                  value={form.coupon_rate || ""}
                  onChange={(e) => setForm({ ...form, coupon_rate: e.target.value })}
                />

                <label className="invA-label">Coupon Frequency/Year (optional)</label>
                <input
                  className="invA-input"
                  placeholder="e.g., 2"
                  value={form.coupon_frequency_per_year || ""}
                  onChange={(e) =>
                    setForm({ ...form, coupon_frequency_per_year: e.target.value })
                  }
                />

                <label className="invA-label">Maturity Date</label>
                <input
                  className="invA-input"
                  type="date"
                  value={form.maturity_date || ""}
                  onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                />
              </>
            )}

            <div className="invA-actions">
              <button className="invA-btn invA-btnPrimary" type="submit">
                Create Asset
              </button>
              <button
                className="invA-btn invA-btnSecondary"
                type="button"
                onClick={() => setForm({})}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* ------- SEARCH + LIST ------- */}
        <div className="invA-panel">
          <div className="invA-panelTitle">Search & Manage</div>

          <div className="invA-searchRow">
            <input
              className="invA-input"
              placeholder="Search by name/symbol/amfi/isin/issuer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="invA-input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="STOCK">Stock</option>
              <option value="MF">Mutual Fund</option>
              <option value="BOND">Bond</option>
              <option value="ETF">ETF</option>
              <option value="GOLD">Gold</option>
              <option value="CASH">Cash</option>
              <option value="FD">FD</option>
            </select>

            <button className="invA-btn invA-btnPrimary" type="button" onClick={fetchAssets}>
              Search
            </button>
          </div>

          <div className="invA-list">
            {loading ? (
              <div className="invA-empty">Loading assets…</div>
            ) : assets.length === 0 ? (
              <div className="invA-empty">No assets found.</div>
            ) : (
              <table className="invA-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Identifier</th>
                    <th className="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>
                        <span className="invA-pill">{a.type}</span>
                      </td>
                      <td className="muted">{identifierText(a)}</td>
                      <td className="right">
                        <button
                          className="invA-btn invA-btnDanger"
                          type="button"
                          onClick={() => deleteAsset(a.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}