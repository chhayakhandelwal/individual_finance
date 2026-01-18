import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FaPlus, FaBullseye, FaWallet, FaChartLine } from "react-icons/fa";
import "./Savings.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];

// ✅ FIX: trailing slash
const API_PATH = "/api/saving/";

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

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function Savings() {
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [authError, setAuthError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    saved_amount: "",
    target_date: "",
  });

  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
    });

    instance.interceptors.request.use((config) => {
      const latestToken = readToken();
      if (latestToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${latestToken}`;
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
    });
  };

  const ensureLoggedIn = () => {
    const t = readToken();
    if (!t) {
      setAuthError("You are not logged in. Please login first.");
      return null;
    }
    return t;
  };

  const fetchGoals = useCallback(async () => {
    const t = ensureLoggedIn();
    if (!t) {
      setSavingsGoals([]);
      return;
    }

    setAuthError("");

    try {
      // ✅ GET /api/saving/
      const res = await api.get(API_PATH);
      setSavingsGoals(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      logAxiosError("FETCH ERROR", err);
      const status = err?.response?.status;
      if (status === 401) setAuthError("401 Unauthorized: Please login again.");
      else if (status === 403) setAuthError("403 Forbidden: Access denied by backend.");
      else if (status === 404) setAuthError(`404 Not Found: Expected GET ${API_PATH}`);
      else setAuthError("Could not load savings goals. Check console for details.");
    }
  }, [api]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // ===== Summary KPIs =====
  const summary = useMemo(() => {
    const totals = savingsGoals.reduce(
      (acc, g) => {
        const t = Number(g.target_amount) || 0;
        const s = Number(g.saved_amount) || 0;
        acc.target += t;
        acc.saved += s;
        return acc;
      },
      { target: 0, saved: 0 }
    );
    const remaining = Math.max(totals.target - totals.saved, 0);
    const avgProgress =
      totals.target > 0 ? Math.round((totals.saved / totals.target) * 100) : 0;

    return { ...totals, remaining, avgProgress };
  }, [savingsGoals]);

  const openAdd = () => {
    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");
    setEditingGoalId(null);
    setFormData({ name: "", target_amount: "", saved_amount: "", target_date: "" });
    setModalOpen(true);
  };

  const openEdit = (goal) => {
    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");
    setEditingGoalId(goal.id);
    setFormData({
      name: goal?.name || "",
      target_amount: goal?.target_amount ?? "",
      saved_amount: goal?.saved_amount ?? "",
      target_date: goal?.target_date || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");

    const payload = {
      name: formData.name.trim(),
      target_amount: Number(formData.target_amount),
      saved_amount: Number(formData.saved_amount),
      target_date: formData.target_date,
    };

    try {
      if (editingGoalId) {
        // ✅ PUT /api/saving/<id>/
        const res = await api.put(`${API_PATH}${editingGoalId}/`, payload);
        setSavingsGoals((prev) =>
          prev.map((g) => (g.id === editingGoalId ? res.data : g))
        );
      } else {
        // ✅ POST /api/saving/
        const res = await api.post(API_PATH, payload);
        setSavingsGoals((prev) => [...prev, res.data]);
      }

      setModalOpen(false);
      setEditingGoalId(null);
      setFormData({ name: "", target_amount: "", saved_amount: "", target_date: "" });
    } catch (err) {
      logAxiosError("SAVE ERROR", err);
      const status = err?.response?.status;
      if (status === 401) setAuthError("401 Unauthorized: Please login again.");
      else if (status === 403) setAuthError("403 Forbidden: Access denied by backend.");
      else if (status === 404) setAuthError(`404 Not Found: Expected POST/PUT ${API_PATH}`);
      else setAuthError("Something went wrong while saving. Check console for details.");
    }
  };

  const handleDelete = async (goalId) => {
    const t = ensureLoggedIn();
    if (!t) return;

    setAuthError("");
    try {
      // ✅ DELETE /api/saving/<id>/
      await api.delete(`${API_PATH}${goalId}/`);
      setSavingsGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      logAxiosError("DELETE ERROR", err);
      const status = err?.response?.status;
      if (status === 401) setAuthError("401 Unauthorized: Please login again.");
      else if (status === 403) setAuthError("403 Forbidden: Access denied by backend.");
      else if (status === 404) setAuthError(`404 Not Found: Expected DELETE ${API_PATH}<id>/`);
      else setAuthError("Could not delete goal. Check console for details.");
    }
  };

  return (
    <div className="sv">
      {/* Header */}
      <div className="sv__header">
        <div>
          <h2 className="sv__title">Savings Goals</h2>
          <p className="sv__subtitle">Track goals, progress, and deadlines in one place.</p>
        </div>

        <div className="sv__actions">
          <button className="sv__btn sv__btn--primary" onClick={openAdd} type="button">
            <FaPlus /> Add Goal
          </button>
        </div>
      </div>

      {authError && <div className="sv__alert">{authError}</div>}

      {/* Summary Cards */}
      <div className="sv__kpis">
        <div className="sv__kpi">
          <div className="sv__kpiIcon"><FaBullseye /></div>
          <div>
            <div className="sv__kpiLabel">Total Target</div>
            <div className="sv__kpiValue">₹{formatINR(summary.target)}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon"><FaWallet /></div>
          <div>
            <div className="sv__kpiLabel">Total Saved</div>
            <div className="sv__kpiValue">₹{formatINR(summary.saved)}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon"><FaChartLine /></div>
          <div>
            <div className="sv__kpiLabel">Remaining</div>
            <div className="sv__kpiValue">₹{formatINR(summary.remaining)}</div>
          </div>
        </div>

        <div className="sv__kpi sv__kpi--accent">
          <div>
            <div className="sv__kpiLabel">Avg Progress</div>
            <div className="sv__kpiValue">{summary.avgProgress}%</div>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="sv__grid">
        {savingsGoals.map((goal) => {
          const target = Number(goal.target_amount) || 0;
          const saved = Number(goal.saved_amount) || 0;
          const remaining = Math.max(target - saved, 0);
          const progress = target > 0 ? Math.round((saved / target) * 100) : 0;

          const dLeft = daysLeft(goal.target_date);
          const chipText =
            dLeft == null
              ? "No deadline"
              : dLeft < 0
              ? `${Math.abs(dLeft)} days overdue`
              : `${dLeft} days left`;

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
            <div className="sv__card" key={goal.id}>
              <div className="sv__cardTop">
                <div className="sv__cardTitleWrap">
                  <h3 className="sv__cardTitle">{goal.name}</h3>
                  <span className={`sv__chip ${dLeft != null && dLeft < 0 ? "is-danger" : ""}`}>
                    {chipText}
                  </span>
                </div>

                <div className="sv__cardBtns">
                  <button className="sv__miniBtn" onClick={() => openEdit(goal)} type="button">
                    Edit
                  </button>
                  <button
                    className="sv__miniBtn sv__miniBtn--danger"
                    onClick={() => handleDelete(goal.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="sv__cardBody">
                <div className="sv__stats">
                  <div className="sv__stat">
                    <div className="sv__statLabel">Goal</div>
                    <div className="sv__statValue">₹{formatINR(target)}</div>
                  </div>
                  <div className="sv__stat">
                    <div className="sv__statLabel">Saved</div>
                    <div className="sv__statValue">₹{formatINR(saved)}</div>
                  </div>
                  <div className="sv__stat">
                    <div className="sv__statLabel">Remaining</div>
                    <div className="sv__statValue">₹{formatINR(remaining)}</div>
                  </div>

                  <div className="sv__progressWrap">
                    <div className="sv__progressMeta">
                      <span className="sv__progressLabel">Progress</span>
                      <span className="sv__progressPct">{Math.min(progress, 100)}%</span>
                    </div>
                    <div className="sv__bar">
                      <div className="sv__barFill" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="sv__chart">
                  <div className="sv__chartRing">
                    <Pie
                      data={data}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                      }}
                    />
                    <div className="sv__chartCenter">
                      <div className="sv__chartPct">{Math.min(progress, 100)}%</div>
                      <div className="sv__chartTxt">Achieved</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sv__cardFooter">
                <span>
                  Target Date: <strong>{goal.target_date || "-"}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="sv__overlay" onClick={() => setModalOpen(false)}>
          <div className="sv__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv__modalHeader">
              <h3>{editingGoalId ? "Edit Goal" : "Add Goal"}</h3>
              <button
                className="sv__close"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="sv__form">
              <label>Goal Name</label>
              <input
                type="text"
                placeholder="e.g., New Laptop"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="sv__row">
                <div>
                  <label>Target Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 60000"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Saved Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 10000"
                    value={formData.saved_amount}
                    onChange={(e) => setFormData({ ...formData, saved_amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <label>Target Date</label>
              <input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                required
              />

              <div className="sv__modalActions">
                <button
                  type="button"
                  className="sv__btn sv__btn--ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sv__btn sv__btn--primary">
                  {editingGoalId ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}