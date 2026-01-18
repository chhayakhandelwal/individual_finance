import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FaPlus, FaWallet, FaBullseye, FaChartLine } from "react-icons/fa";
import "./loan.css";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ---------- TOKEN UTILS ---------- */
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const readToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

/* ---------- API ---------- */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);
// IMPORTANT: Django expects trailing slash because APPEND_SLASH=True
const API_PATH = "/api/loan/";

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

export default function Lending() {
  const [loans, setLoans] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const [formData, setFormData] = useState({
    type: "TAKEN",
    person: "",
    name: "",
    amount: "",
    paid_amount: "",
    start_date: "",
    due_date: "",
    note: "",
  });

  const [docFile, setDocFile] = useState(null); // UI only (native input shows file name)
  const fileRef = useRef(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------- Lock body scroll when modal is open ---------- */
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  /* ---------- Axios instance with JWT ---------- */
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
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
    const t = readToken();
    if (!t) {
      setError("Please login again.");
      return false;
    }
    return true;
  };

  /* ---------- Backend -> UI ---------- */
  const mapFromBackend = (row) => ({
    id: row.id,
    type: row.loan_type, // GIVEN / TAKEN
    person: row.person_name || "",
    name:
      (row.title && String(row.title).trim()) ||
      (row.name && String(row.name).trim()) ||
      "", // keep empty if backend saved empty; we will show fallback at render time
    amount: Number(row.amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    start_date: row.start_date || "",
    due_date: row.due_date || "",
    note: row.note || "",
    document_name: row.document_name || "",
  });

  /* ---------- UI -> Backend ---------- */
  const mapToBackendPayload = () => ({
    loan_type: formData.type,
    person_name: String(formData.person || "").trim(),
    title: String(formData.name || "").trim(),
    amount: Number(formData.amount) || 0,
    paid_amount: Number(formData.paid_amount) || 0,
    start_date: formData.start_date || null,
    due_date: formData.due_date || null,
    note: formData.note || "",
  });

  /* ---------- Fetch Loans ---------- */
  const fetchLoans = useCallback(async () => {
    if (!ensureLoggedIn()) {
      setLoans([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await api.get(API_PATH); // /api/loan/
      const list = Array.isArray(res.data) ? res.data : [];
      setLoans(list.map(mapFromBackend));
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not load loans."
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  /* ---------- Filters ---------- */
  const filteredLoans = useMemo(() => {
    if (filter === "ALL") return loans;
    return loans.filter((l) => l.type === filter);
  }, [loans, filter]);

  /* ---------- KPIs ---------- */
  const summary = useMemo(() => {
    const totals = filteredLoans.reduce(
      (acc, l) => {
        const amt = Number(l.amount) || 0;
        const paid = Number(l.paid_amount) || 0;
        acc.total += amt;
        acc.paid += paid;
        return acc;
      },
      { total: 0, paid: 0 }
    );

    const due = Math.max(totals.total - totals.paid, 0);

    const activeCount = filteredLoans.filter((l) => {
      const amt = Number(l.amount) || 0;
      const paid = Number(l.paid_amount) || 0;
      return amt - paid > 0;
    }).length;

    return { ...totals, due, activeCount };
  }, [filteredLoans]);

  /* ---------- Modal helpers ---------- */
  const resetForm = () => {
    setEditingLoanId(null);
    setFormData({
      type: "TAKEN",
      person: "",
      name: "",
      amount: "",
      paid_amount: "",
      start_date: "",
      due_date: "",
      note: "",
    });
    setDocFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openAdd = () => {
    if (!ensureLoggedIn()) return;
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (loan) => {
    if (!ensureLoggedIn()) return;
    setEditingLoanId(loan.id);
    setFormData({
      type: loan?.type || "TAKEN",
      person: loan?.person || "",
      name: loan?.name || "", // allow editing if blank
      amount: loan?.amount ?? "",
      paid_amount: loan?.paid_amount ?? "",
      start_date: loan?.start_date || "",
      due_date: loan?.due_date || "",
      note: loan?.note || "",
    });
    setDocFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setError("");
  };

  /* ---------- Save (POST/PUT) ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ensureLoggedIn()) return;

    setError("");

    if (!String(formData.person || "").trim()) {
      setError("Person name is required.");
      return;
    }
    if (!String(formData.name || "").trim()) {
      setError("Title is required.");
      return;
    }
    if (Number(formData.amount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (Number(formData.paid_amount) < 0) {
      setError("Paid/Received amount cannot be negative.");
      return;
    }

    const payload = mapToBackendPayload();

    try {
      if (editingLoanId) {
        await api.put(`${API_PATH}${editingLoanId}/`, payload); // /api/loan/:id/
      } else {
        await api.post(API_PATH, payload); // /api/loan/
      }

      closeModal();
      await fetchLoans();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          (err?.response?.data && JSON.stringify(err.response.data)) ||
          "Could not save loan."
      );
    }
  };

  /* ---------- Delete ---------- */
 const handleDelete = async (loanId) => {
  console.log("DELETE CLICKED ->", loanId);

  if (!ensureLoggedIn()) return;

  setError("");
  try {
    const res = await api.delete(`${API_PATH}${loanId}/`);
    console.log("DELETE RESPONSE", res.status);

    // Optimistic UI remove (so user sees it instantly)
    setLoans((prev) => prev.filter((x) => x.id !== loanId));

    // Then re-fetch to confirm DB state
    await fetchLoans();
  } catch (err) {
    console.log("DELETE ERROR", err?.response?.status, err?.response?.data);
    setError(
      err?.response?.data?.detail ||
      (err?.response?.data && JSON.stringify(err.response.data)) ||
      "Could not delete loan."
    );
  }
};
 
  return (
    <div className="sv">
      {/* Header */}
      <div className="sv__header">
        <div>
          <h2 className="sv__title">Lending</h2>
          <p className="sv__subtitle">
            Track loans taken and loans given (who owes whom), progress, and due dates.
          </p>
        </div>

        <div className="sv__actions">
          <div className="ln__tabs">
            <button
              type="button"
              className={`ln__tab ${filter === "ALL" ? "is-active" : ""}`}
              onClick={() => setFilter("ALL")}
            >
              All
            </button>
            <button
              type="button"
              className={`ln__tab ${filter === "TAKEN" ? "is-active" : ""}`}
              onClick={() => setFilter("TAKEN")}
            >
              Taken
            </button>
            <button
              type="button"
              className={`ln__tab ${filter === "GIVEN" ? "is-active" : ""}`}
              onClick={() => setFilter("GIVEN")}
            >
              Given
            </button>
          </div>

          <button className="sv__btn sv__btn--primary" onClick={openAdd} type="button">
            <FaPlus /> Add Loan
          </button>
        </div>
      </div>

      {error && <div className="sv__alert">{error}</div>}

      {/* Summary Cards */}
      <div className="sv__kpis">
        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaBullseye />
          </div>
          <div>
            <div className="sv__kpiLabel">Total Amount</div>
            <div className="sv__kpiValue">₹{formatINR(summary.total)}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaWallet />
          </div>
          <div>
            <div className="sv__kpiLabel">
              {filter === "GIVEN" ? "Total Received" : "Total Paid"}
            </div>
            <div className="sv__kpiValue">₹{formatINR(summary.paid)}</div>
          </div>
        </div>

        <div className="sv__kpi">
          <div className="sv__kpiIcon">
            <FaChartLine />
          </div>
          <div>
            <div className="sv__kpiLabel">{filter === "GIVEN" ? "To Receive" : "To Pay"}</div>
            <div className="sv__kpiValue">₹{formatINR(summary.due)}</div>
          </div>
        </div>

        <div className="sv__kpi sv__kpi--accent">
          <div>
            <div className="sv__kpiLabel">Active Loans</div>
            <div className="sv__kpiValue">{summary.activeCount}</div>
          </div>
        </div>
      </div>

      {loading && <div className="sv__alert">Loading loans...</div>}
      {!loading && filteredLoans.length === 0 && (
        <div className="sv__alert">No loans found. Click “Add Loan”.</div>
      )}

      {/* Loans Grid */}
      <div className="sv__grid">
        {filteredLoans.map((loan) => {
          const amount = Number(loan.amount) || 0;
          const paid = Number(loan.paid_amount) || 0;
          const remaining = Math.max(amount - paid, 0);
          const progress = amount > 0 ? Math.round((paid / amount) * 100) : 0;

          const dLeft = daysLeft(loan.due_date);
          const chipText =
            dLeft == null
              ? "No due date"
              : dLeft < 0
              ? `${Math.abs(dLeft)} days overdue`
              : `${dLeft} days left`;

          const isGiven = loan.type === "GIVEN";
          const whoLabel = isGiven ? "Borrower" : "Lender";

          const displayTitle =
            String(loan.name || "").trim() ||
            (isGiven ? "Loan Given" : "Loan Taken");

          const chartData = {
            labels: [isGiven ? "Received" : "Paid", isGiven ? "To Receive" : "To Pay"],
            datasets: [
              {
                data: [Math.max(paid, 0), Math.max(remaining, 0)],
                backgroundColor: ["#00aaff", "#d0eaff"],
                borderWidth: 0,
              },
            ],
          };

          return (
            <div className="sv__card" key={loan.id}>
              <div className="sv__cardTop">
                <div className="sv__cardTitleWrap">
                  <div className="ln__titleRow">
                    <h3 className="sv__cardTitle">{displayTitle}</h3>
                    <span className={`ln__badge ${isGiven ? "is-given" : "is-taken"}`}>
                      {isGiven ? "GIVEN" : "TAKEN"}
                    </span>
                  </div>
                  <span className={`sv__chip ${dLeft != null && dLeft < 0 ? "is-danger" : ""}`}>
                    {chipText}
                  </span>
                </div>

                <div className="sv__cardBtns">
                  <button className="sv__miniBtn" onClick={() => openEdit(loan)} type="button">
                    Edit
                  </button>
                  <button
                    className="sv__miniBtn sv__miniBtn--danger"
                    onClick={() => handleDelete(loan.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="sv__cardBody">
                <div className="sv__stats">
                  <div className="sv__stat">
                    <div className="sv__statLabel">Amount</div>
                    <div className="sv__statValue">₹{formatINR(amount)}</div>
                  </div>
                  <div className="sv__stat">
                    <div className="sv__statLabel">{isGiven ? "Received" : "Paid"}</div>
                    <div className="sv__statValue">₹{formatINR(paid)}</div>
                  </div>
                  <div className="sv__stat">
                    <div className="sv__statLabel">{isGiven ? "To Receive" : "To Pay"}</div>
                    <div className="sv__statValue">₹{formatINR(remaining)}</div>
                  </div>
                  <div className="sv__stat">
                    <div className="sv__statLabel">{whoLabel}</div>
                    <div className="sv__statValue">{loan.person || "-"}</div>
                  </div>

                  <div className="sv__progressWrap">
                    <div className="sv__progressMeta">
                      <span className="sv__progressLabel">
                        {isGiven ? "Recovery Progress" : "Repayment Progress"}
                      </span>
                      <span className="sv__progressPct">{Math.min(progress, 100)}%</span>
                    </div>
                    <div className="sv__bar">
                      <div
                        className="sv__barFill"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="sv__chart">
                  <div className="sv__chartRing">
                    <Pie
                      data={chartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                      }}
                    />
                    <div className="sv__chartCenter">
                      <div className="sv__chartPct">{Math.min(progress, 100)}%</div>
                      <div className="sv__chartTxt">{isGiven ? "Received" : "Paid"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sv__cardFooter ln__footer">
                <span>
                  From: <strong>{loan.start_date || "-"}</strong>
                </span>
                <span>
                  Due: <strong>{loan.due_date || "-"}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Modal (screenshot-like) ===== */}
      {modalOpen && (
        <div className="sv__overlay" onClick={closeModal}>
          <div className="sv__modal ln__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv__modalHeader">
              <h3>{editingLoanId ? "Edit Loan" : "Add Loan"}</h3>
              <button
                className="sv__close"
                onClick={closeModal}
                type="button"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Scrollable form area */}
            <form onSubmit={handleSubmit} className="sv__form ln__form">
              <label>Type</label>
              <select
                className="ln__select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="TAKEN">Loan Taken (I owe)</option>
                <option value="GIVEN">Loan Given (They owe me)</option>
              </select>

              <label>{formData.type === "GIVEN" ? "Borrower Name" : "Lender Name"}</label>
              <input
                type="text"
                placeholder={formData.type === "GIVEN" ? "e.g., Rahul" : "e.g., Bank / Person"}
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                required
              />

              <label>Title</label>
              <input
                type="text"
                placeholder="e.g., Bike Loan / Money Given"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="sv__row">
                <div>
                  <label>Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 50000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label>{formData.type === "GIVEN" ? "Received Amount" : "Paid Amount"}</label>
                  <input
                    type="number"
                    placeholder="e.g., 10000"
                    value={formData.paid_amount}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="sv__row">
                <div>
                  <label>From Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <label>Note (optional)</label>
              <input
                type="text"
                placeholder="e.g., interest rate, EMI date, reason"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />

              <label>Loan Document (optional)</label>
              {/* Native input like screenshot (upload not wired to backend here) */}
              <input
                ref={fileRef}
                type="file"
                className="ln__nativeFile"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              />

              {/* Sticky footer actions */}
              <div className="sv__modalActions ln__actionsSticky">
                <button type="button" className="sv__btn sv__btn--ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="sv__btn sv__btn--primary">
                  {editingLoanId ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}