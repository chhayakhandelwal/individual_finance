import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaPlus, FaShieldAlt, FaCalendarAlt, FaRupeeSign } from "react-icons/fa";
import "./insurance.css"; // use same css as savings (sv__ classes)

/* ---------- TOKEN UTILS ---------- */
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

/* ---------- API ---------- */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);
const API_PATH = "/api/insurance/";

/* ---------- HELPERS ---------- */
const formatINR = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const intervalToYearMultiplier = (interval) => {
  switch (interval) {
    case "Monthly":
      return 12;
    case "Quarterly":
      return 4;
    case "Half-Yearly":
      return 2;
    case "Yearly":
      return 1;
    default:
      return 0;
  }
};

const getStatusChip = (end_date) => {
  const d = daysLeft(end_date);
  if (d == null) return { text: "No end date", cls: "sv__chip" };
  if (d < 0) return { text: `${Math.abs(d)} days overdue`, cls: "sv__chip is-danger" };
  if (d <= 30) return { text: `${d} days left`, cls: "sv__chip" };
  return { text: `${d} days left`, cls: "sv__chip" };
};

export default function Insurance() {
  const [policies, setPolicies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [authError, setAuthError] = useState("");

  const emptyForm = {
    name: "",
    policyNumber: "",
    startDate: "",
    endDate: "",
    amount: "",
    interval: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  /* ---------- Axios instance with JWT ---------- */
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
    });

    instance.interceptors.request.use((config) => {
      const t = readToken();
      if (t) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${t}`;
      }
      return config;
    });

    return instance;
  }, []);

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

  /* ---------- Map Backend <-> UI ---------- */
  const mapFromBackend = (row) => ({
  id: row.id,
  name: row.name || "",
  policyNumber: row.policyNumber || row.policy_number || "",
  startDate: row.startDate || row.start_date || "",
  endDate: row.endDate || row.end_date || "",
  amount: row.amount ?? "",
  interval: row.interval || row.payment_interval || "",
});
const mapToBackend = () => ({
  name: formData.name.trim(),
  policyNumber: formData.policyNumber.trim(),
  startDate: formData.startDate,
  endDate: formData.endDate,
  amount: Number(formData.amount) || 0,
  interval: formData.interval,
});


  /* ---------- Fetch ---------- */
  const fetchPolicies = useCallback(async () => {
    const t = ensureLoggedIn();
    if (!t) {
      setPolicies([]);
      return;
    }

    setAuthError("");
    try {
      const res = await api.get(API_PATH);
      const list = Array.isArray(res.data) ? res.data : [];
      setPolicies(list.map(mapFromBackend));
    } catch (err) {
      logAxiosError("FETCH POLICIES ERROR", err);
      const status = err?.response?.status;
      if (status === 401) setAuthError("401 Unauthorized: Please login again.");
      else if (status === 403) setAuthError("403 Forbidden: Access denied by backend.");
      else if (status === 404) setAuthError(`404 Not Found: Expected GET ${API_PATH}`);
      else setAuthError("Could not load insurance policies. Check console for details.");
    }
  }, [api]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  /* ---------- KPI Summary ---------- */
  const summary = useMemo(() => {
    const totalPolicies = policies.length;

    const yearlyCost = policies.reduce((sum, p) => {
      const amt = Number(p.amount) || 0;
      const mult = intervalToYearMultiplier(p.interval);
      return sum + amt * mult;
    }, 0);

    const expiringSoon = policies.filter((p) => {
      const d = daysLeft(p.endDate);
      return d != null && d >= 0 && d <= 30;
    }).length;

    const nextExpiry = [...policies]
      .filter((p) => p.endDate)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];

    return {
      totalPolicies,
      yearlyCost,
      expiringSoon,
      nextExpiry: nextExpiry?.endDate || null,
    };
  }, [policies]);

  /* ---------- Modal handlers ---------- */
  const openAdd = () => {
    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");
    setEditingId(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");
    setEditingId(p.id);
    setFormData({
      name: p.name,
      policyNumber: p.policyNumber,
      startDate: p.startDate,
      endDate: p.endDate,
      amount: p.amount ?? "",
      interval: p.interval || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  /* ---------- Save ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const t = ensureLoggedIn();
    if (!t) return;
    setAuthError("");

    if (!formData.name.trim()) return setAuthError("Insurance name is required.");
    if (!formData.policyNumber.trim()) return setAuthError("Policy number is required.");
    if (!formData.startDate) return setAuthError("Start date is required.");
    if (!formData.endDate) return setAuthError("End date is required.");
    if (!formData.interval) return setAuthError("Payment interval is required.");

    const payload = mapToBackend();

    try {
      if (editingId) {
        await api.put(`${API_PATH}${editingId}/`, payload);
      } else {
        await api.post(API_PATH, payload);
      }
      closeModal();
      await fetchPolicies();
    } catch (err) {
      logAxiosError("SAVE POLICY ERROR", err);
      const status = err?.response?.status;
      if (status === 401) setAuthError("401 Unauthorized: Please login again.");
      else if (status === 403) setAuthError("403 Forbidden: Access denied by backend.");
      else setAuthError("Could not save policy. Check console for details.");
    }
  };

  /* ---------- Delete ---------- */
  const handleDelete = async (id) => {
    const t = ensureLoggedIn();
    if (!t) return;

    if (!window.confirm("Delete this policy?")) return;

    setAuthError("");
    try {
      await api.delete(`${API_PATH}${id}/`);
      setPolicies((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      logAxiosError("DELETE POLICY ERROR", err);
      setAuthError("Could not delete policy. Check console for details.");
    }
  };

  return (
    <div className="sv">
      {/* Header */}
      <div className="sv__header">
        <div>
          <h2 className="sv__title">Insurance</h2>
          <p className="sv__subtitle">Track policies, premiums, and expiry dates.</p>
        </div>

        <div className="sv__actions">
          <button className="sv__btn sv__btn--primary" onClick={openAdd} type="button">
            <FaPlus /> Add Policy
          </button>
        </div>
      </div>

      {authError && <div className="sv__alert">{authError}</div>}

      {/* KPI cards */}
      <div className="sv__kpis">
        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaShieldAlt />
          </div>
          <div>
            <div className="sv__kpiLabel">Total Policies</div>
            <div className="sv__kpiValue">{summary.totalPolicies}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaRupeeSign />
          </div>
          <div>
            <div className="sv__kpiLabel">Yearly Cost (approx)</div>
            <div className="sv__kpiValue">₹{formatINR(summary.yearlyCost)}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaCalendarAlt />
          </div>
          <div>
            <div className="sv__kpiLabel">Expiring Soon (30d)</div>
            <div className="sv__kpiValue">{summary.expiringSoon}</div>
          </div>
        </div>

        <div className="sv__kpi sv__kpi--accent">
          <div>
            <div className="sv__kpiLabel">Next Expiry</div>
            <div className="sv__kpiValue">
              {summary.nextExpiry ? new Date(summary.nextExpiry).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="sv__grid">
        {policies.length === 0 && (
          <div className="sv__card">
            <div style={{ fontWeight: 800, opacity: 0.7 }}>No insurance policies added.</div>
          </div>
        )}

        {policies.map((p) => {
          const chip = getStatusChip(p.endDate);
          const yearly = (Number(p.amount) || 0) * intervalToYearMultiplier(p.interval);

          return (
            <div className="sv__card" key={p.id}>
              <div className="sv__cardTop">
                <div className="sv__cardTitleWrap">
                  <h3 className="sv__cardTitle">{p.name}</h3>
                  <span className={chip.cls}>{chip.text}</span>
                </div>

                <div className="sv__cardBtns">
                  <button className="sv__miniBtn" onClick={() => openEdit(p)} type="button">
                    Edit
                  </button>
                  <button
                    className="sv__miniBtn sv__miniBtn--danger"
                    onClick={() => handleDelete(p.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="sv__cardBody" style={{ gridTemplateColumns: "1fr" }}>
                <div className="sv__stats">
                  <div className="sv__stat">
                    <div className="sv__statLabel">Policy Number</div>
                    <div className="sv__statValue">{p.policyNumber || "-"}</div>
                  </div>

                  <div className="sv__stat">
                    <div className="sv__statLabel">Premium</div>
                    <div className="sv__statValue">₹{formatINR(p.amount)}</div>
                  </div>

                  <div className="sv__stat">
                    <div className="sv__statLabel">Interval</div>
                    <div className="sv__statValue">{p.interval || "-"}</div>
                  </div>

                  <div className="sv__stat">
                    <div className="sv__statLabel">Yearly Cost</div>
                    <div className="sv__statValue">₹{formatINR(yearly)}</div>
                  </div>

                  <div className="sv__progressWrap">
                    <div className="sv__progressMeta">
                      <span className="sv__progressLabel">Ends In</span>
                      <span className="sv__progressPct">
                        {(() => {
                          const d = daysLeft(p.endDate);
                          if (d == null) return "—";
                          if (d < 0) return "Expired";
                          return `${d} days`;
                        })()}
                      </span>
                    </div>

                    <div className="sv__bar">
                      <div
                        className="sv__barFill"
                        style={{
                          width: (() => {
                            const d = daysLeft(p.endDate);
                            if (d == null) return "0%";
                            if (d < 0) return "100%";
                            // visual only (assume 365-day horizon)
                            return `${Math.max(6, Math.min(100, (1 - d / 365) * 100))}%`;
                          })(),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sv__cardFooter" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                  Start: <strong>{p.startDate || "-"}</strong>
                </span>
                <span>
                  End: <strong>{p.endDate || "-"}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="sv__overlay" onClick={closeModal}>
          <div className="sv__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv__modalHeader">
              <h3>{editingId ? "Edit Policy" : "Add Policy"}</h3>
              <button className="sv__close" onClick={closeModal} aria-label="Close" type="button">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="sv__form">
              <label>Insurance Name</label>
              <input
                type="text"
                placeholder="e.g., Health Insurance"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />

              <label>Policy Number</label>
              <input
                type="text"
                placeholder="e.g., ABC12345"
                value={formData.policyNumber}
                onChange={(e) => setFormData((p) => ({ ...p, policyNumber: e.target.value }))}
                required
              />

              <div className="sv__row">
                <div>
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="sv__row">
                <div>
                  <label>Premium Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 1500"
                    value={formData.amount}
                    onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>

                <div>
                  <label>Payment Interval</label>
                  <select
                    value={formData.interval}
                    onChange={(e) => setFormData((p) => ({ ...p, interval: e.target.value }))}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      margin: "8px 0 12px 0",
                      borderRadius: 12,
                      border: "1px solid #e7edf6",
                      outline: "none",
                    }}
                  >
                    <option value="">Select Interval</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="sv__modalActions">
                <button type="button" className="sv__btn sv__btn--ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="sv__btn sv__btn--primary">
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