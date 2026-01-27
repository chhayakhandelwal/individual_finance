import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FaPlus, FaShieldAlt, FaWallet, FaChartLine } from "react-icons/fa";
import "./emergency.css";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ---------- TOKEN UTILS (JWT) ---------- */
/**
 * ✅ Your backend is using SimpleJWT:
 * REST_FRAMEWORK -> JWTAuthentication
 * SIMPLE_JWT -> AUTH_HEADER_TYPES = ("Bearer",)
 *
 * So frontend must send:  Authorization: Bearer <access_token>
 *
 * This function tries common keys.
 * (Keep whichever key you actually store after login: usually "access")
 */
const TOKEN_KEYS = ["access", "accessToken", "jwt", "token", "authToken"];

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

const formatINR = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function EmergencyFunds() {
  const [funds, setFunds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    saved_amount: "",
    interval: "monthly",
    note: "",
  });

  const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(
    /\/$/,
    ""
  );

  // ✅ Django style: trailing slash
  const API_PATH = "/api/emergency/";

  /* ---------- AXIOS INSTANCE (WITH JWT AUTH) ---------- */
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });

    instance.interceptors.request.use((config) => {
      const token = readToken();

      // If no token, don't attach Authorization; backend will return 401 and we show message.
      if (token) {
        config.headers = config.headers || {};
        // ✅ FIX: Must be Bearer for SimpleJWT
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    return instance;
  }, [API_BASE_URL]);

  const logAxiosError = (label, err) => {
    console.error(label, {
      status: err?.response?.status,
      url: err?.config?.url,
      data: err?.response?.data,
      message: err?.message,
      headersSent: err?.config?.headers,
    });
  };

  const handleAuthFailure = () => {
    setError("Unauthorized (401). Please login again. Your JWT token is missing/expired.");
  };

  /* ---------------- FETCH ---------------- */
  const fetchFunds = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get(API_PATH);
      setFunds(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      logAxiosError("FETCH EMERGENCY ERROR", err);
      const status = err?.response?.status;

      if (status === 401) handleAuthFailure();
      else if (status === 403) setError("403 Forbidden: You don’t have access.");
      else if (status === 404) setError(`404 Not Found: Expected GET ${API_PATH}`);
      else if (status === 500) setError("500 Server Error: Check Django terminal traceback.");
      else setError("Could not load emergency funds. Check console + Django terminal.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  /* ---------------- SUMMARY ---------------- */
  const summary = useMemo(() => {
    const totals = funds.reduce(
      (acc, f) => {
        const t = Number(f.target_amount) || 0;
        const s = Number(f.saved_amount) || 0;
        acc.target += t;
        acc.saved += s;
        return acc;
      },
      { target: 0, saved: 0 }
    );

    const remaining = Math.max(totals.target - totals.saved, 0);
    const avgProgress = totals.target > 0 ? Math.round((totals.saved / totals.target) * 100) : 0;

    return { ...totals, remaining, avgProgress };
  }, [funds]);

  const intervalLabel = (v) => {
    const s = String(v || "").toLowerCase();
    if (s === "weekly") return "Weekly";
    if (s === "monthly") return "Monthly";
    if (s === "quarterly") return "Quarterly";
    if (s === "halfyearly") return "Half-Yearly";
    if (s === "yearly") return "Yearly";
    return v || "—";
  };

  /* ---------------- MODAL ---------------- */
  const openAdd = () => {
    setError("");
    setEditingId(null);
    setFormData({
      name: "",
      target_amount: "",
      saved_amount: "",
      interval: "monthly",
      note: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setError("");
    setEditingId(row.id);
    setFormData({
      name: row?.name || "",
      target_amount: row?.target_amount ?? "",
      saved_amount: row?.saved_amount ?? "",
      interval: row?.interval || "monthly",
      note: row?.note || row?.description || "",
    });
    setModalOpen(true);
  };

  /* ---------------- SAVE ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
      name: String(formData.name || "").trim(),
      target_amount: Number(formData.target_amount),
      saved_amount: Number(formData.saved_amount),
      interval: String(formData.interval || "monthly").toLowerCase(),
      note: String(formData.note || "").trim(),
    };

    // ✅ FIX: include halfyearly too (your UI offers it)
    const allowedIntervals = ["weekly", "monthly", "quarterly", "halfyearly", "yearly"];

    if (!payload.name) return setError("Name is required.");
    if (!Number.isFinite(payload.target_amount) || payload.target_amount <= 0)
      return setError("Target amount must be > 0.");
    if (!Number.isFinite(payload.saved_amount) || payload.saved_amount < 0)
      return setError("Saved amount cannot be negative.");
    if (payload.saved_amount > payload.target_amount)
      return setError("Saved amount cannot exceed target amount.");
    if (!allowedIntervals.includes(payload.interval))
      return setError("Please select a valid interval.");

    try {
      if (editingId) {
        const res = await api.put(`${API_PATH}${editingId}/`, payload);
        setFunds((prev) => prev.map((x) => (x.id === editingId ? res.data : x)));
      } else {
        const res = await api.post(API_PATH, payload);
        setFunds((prev) => [...prev, res.data]);
      }

      setModalOpen(false);
      setEditingId(null);
      setFormData({
        name: "",
        target_amount: "",
        saved_amount: "",
        interval: "monthly",
        note: "",
      });
    } catch (err) {
      logAxiosError("SAVE EMERGENCY ERROR", err);
      const status = err?.response?.status;

      if (status === 401) handleAuthFailure();
      else if (status === 400)
        setError(
          "400 Bad Request: Backend validation failed. Check serializer fields + payload in console."
        );
      else if (status === 404) setError(`404 Not Found: Check backend URL for ${API_PATH}`);
      else if (status === 500) setError("500 Server Error: Check Django terminal traceback.");
      else setError("Could not save emergency fund. Check console + Django terminal.");
    }
  };

  /* ---------------- DELETE ---------------- */
  const handleDelete = async (id) => {
    setError("");
    try {
      await api.delete(`${API_PATH}${id}/`);
      setFunds((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      logAxiosError("DELETE EMERGENCY ERROR", err);
      const status = err?.response?.status;

      if (status === 401) handleAuthFailure();
      else if (status === 404) setError(`404 Not Found: Expected DELETE ${API_PATH}${id}/`);
      else if (status === 500) setError("500 Server Error: Check Django terminal traceback.");
      else setError("Could not delete emergency fund. Check console + Django terminal.");
    }
  };

  return (
    <div className="ef">
      <div className="ef__header">
        <div>
          <h2 className="ef__title">Emergency Funds</h2>
          <p className="ef__subtitle">Build a safety buffer for unexpected expenses.</p>
        </div>

        <div className="ef__actions">
          <button className="ef__btn ef__btn--primary" onClick={openAdd} type="button">
            <FaPlus /> Add Fund
          </button>
        </div>
      </div>

      {error && <div className="ef__alert">{error}</div>}
      {loading && <div className="ef__alert">Loading...</div>}

      <div className="ef__kpis">
        <div className="ef__kpi">
          <div className="ef__kpiIcon">
            <FaShieldAlt />
          </div>
          <div>
            <div className="ef__kpiLabel">Total Target</div>
            <div className="ef__kpiValue">₹{formatINR(summary.target)}</div>
          </div>
        </div>

        <div className="ef__kpi">
          <div className="ef__kpiIcon">
            <FaWallet />
          </div>
          <div>
            <div className="ef__kpiLabel">Total Saved</div>
            <div className="ef__kpiValue">₹{formatINR(summary.saved)}</div>
          </div>
        </div>

        <div className="ef__kpi">
          <div className="ef__kpiIcon">
            <FaChartLine />
          </div>
          <div>
            <div className="ef__kpiLabel">Remaining</div>
            <div className="ef__kpiValue">₹{formatINR(summary.remaining)}</div>
          </div>
        </div>

        <div className="ef__kpi ef__kpi--accent">
          <div>
            <div className="ef__kpiLabel">Avg Progress</div>
            <div className="ef__kpiValue">{summary.avgProgress}%</div>
          </div>
        </div>
      </div>

      <div className="ef__grid">
        {funds.map((f) => {
          const target = Number(f.target_amount) || 0;
          const saved = Number(f.saved_amount) || 0;
          const remaining = Math.max(target - saved, 0);
          const progress = target > 0 ? Math.round((saved / target) * 100) : 0;

          const data = {
            labels: ["Saved", "Remaining"],
            datasets: [
              {
                data: [saved, remaining],
                backgroundColor: ["#00aaff", "#d0eaff"],
                borderWidth: 0,
              },
            ],
          };

          return (
            <div className="ef__card" key={f.id}>
              <div className="ef__cardTop">
                <div className="ef__cardTitleWrap">
                  <h3 className="ef__cardTitle">{f.name}</h3>
                  <span className="ef__chip">{Math.min(progress, 100)}% funded</span>
                  <span className="ef__chip" style={{ marginLeft: 8 }}>
                    {intervalLabel(f.interval)}
                  </span>
                </div>

                <div className="ef__cardBtns">
                  <button className="ef__miniBtn" onClick={() => openEdit(f)} type="button">
                    Edit
                  </button>
                  <button
                    className="ef__miniBtn ef__miniBtn--danger"
                    onClick={() => handleDelete(f.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="ef__cardBody">
                <div className="ef__stats">
                  <div className="ef__stat">
                    <div className="ef__statLabel">Target</div>
                    <div className="ef__statValue">₹{formatINR(target)}</div>
                  </div>
                  <div className="ef__stat">
                    <div className="ef__statLabel">Saved</div>
                    <div className="ef__statValue">₹{formatINR(saved)}</div>
                  </div>
                  <div className="ef__stat">
                    <div className="ef__statLabel">Remaining</div>
                    <div className="ef__statValue">₹{formatINR(remaining)}</div>
                  </div>

                  <div className="ef__progressWrap">
                    <div className="ef__progressMeta">
                      <span className="ef__progressLabel">Progress</span>
                      <span className="ef__progressPct">{Math.min(progress, 100)}%</span>
                    </div>
                    <div className="ef__bar">
                      <div className="ef__barFill" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="ef__chart">
                  <div className="ef__chartRing">
                    <Pie
                      data={data}
                      options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                    />
                    <div className="ef__chartCenter">
                      <div className="ef__chartPct">{Math.min(progress, 100)}%</div>
                      <div className="ef__chartTxt">Saved</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ef__cardFooter">
                <span className="ef__note">{f.note || f.description || "—"}</span>
              </div>
            </div>
          );
        })}

        {!loading && funds.length === 0 && <div className="ef__empty">No emergency funds added yet.</div>}
      </div>

      {modalOpen && (
        <div className="ef__overlay" onClick={() => setModalOpen(false)}>
          <div className="ef__modal" onClick={(e) => e.stopPropagation()}>
            <div className="ef__modalHeader">
              <h3>{editingId ? "Edit Fund" : "Add Fund"}</h3>
              <button
                className="ef__close"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="ef__form">
              <label>Fund Name</label>
              <input
                type="text"
                placeholder="e.g., Medical Emergency"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="ef__row">
                <div>
                  <label>Target Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 100000"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label>Saved Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 25000"
                    value={formData.saved_amount}
                    onChange={(e) => setFormData({ ...formData, saved_amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <label>Interval</label>
              <select
                value={formData.interval}
                onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                required
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="halfyearly">Half-Yearly</option>
                <option value="yearly">Yearly</option>
              </select>

              <label>Note (optional)</label>
              <textarea
                placeholder="e.g., For unexpected hospital bills"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />

              <div className="ef__modalActions">
                <button
                  type="button"
                  className="ef__btn ef__btn--ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ef__btn ef__btn--primary">
                  {editingId ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}