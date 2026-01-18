import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaPlus, FaWallet, FaCalendarAlt } from "react-icons/fa";
import "./Income.css";

/* ---------- TOKEN UTILS ---------- */
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const readToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

// ✅ IMPORTANT: Django expects trailing slash
const API_PATH = "/api/income/";

export default function Income() {
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    source: "",
    category: "SALARY",
    amount: "",
    date: "",
    description: "",
  });

  const API_BASE_URL =
    (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  /* ---------- AXIOS INSTANCE ---------- */
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
    if (!readToken()) {
      setError("Please login to manage income.");
      return false;
    }
    return true;
  };

  /* ---------- FETCH ---------- */
  const fetchIncome = useCallback(async () => {
    if (!ensureLoggedIn()) {
      setItems([]);
      return;
    }
    setError("");
    try {
      const res = await api.get(API_PATH); // ✅ /api/income/
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("FETCH INCOME ERROR:", e?.response?.data || e);
      setError(e?.response?.data?.detail || "Failed to load income data.");
    }
  }, [api]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  /* ---------- SUMMARY ---------- */
  const summary = useMemo(() => {
    const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
    const byCategory = {};
    items.forEach((i) => {
      const c = i.category || "UNCATEGORIZED";
      byCategory[c] = (byCategory[c] || 0) + Number(i.amount || 0);
    });
    return { total, byCategory };
  }, [items]);

  /* ---------- MODAL HANDLERS ---------- */
  const openAdd = () => {
    if (!ensureLoggedIn()) return;
    setEditingId(null);
    setForm({
      source: "",
      category: "SALARY",
      amount: "",
      date: "",
      description: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      source: row.source || "",
      category: row.category || "SALARY",
      amount: row.amount ?? "",
      // ✅ support both serializer fields
      date: row.date || row.income_date || "",
      description: row.description || "",
    });
    setModalOpen(true);
  };

  /* ---------- SAVE ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ensureLoggedIn()) return;

    const payload = {
      source: (form.source || "").trim(),
      category: form.category,
      amount: Number(form.amount),
      date: form.date, // ✅ serializer expects `date`
      description: (form.description || "").trim(),
    };

    try {
      if (editingId) {
        // ✅ /api/income/<id>/
        await api.put(`${API_PATH}${editingId}/`, payload);
      } else {
        await api.post(API_PATH, payload);
      }
      setModalOpen(false);
      setEditingId(null);
      await fetchIncome();
    } catch (e2) {
      console.error("SAVE INCOME ERROR:", e2?.response?.data || e2);
      setError(e2?.response?.data?.detail || "Could not save income.");
    }
  };

  /* ---------- DELETE ---------- */
  const handleDelete = async (id) => {
    if (!ensureLoggedIn()) return;
    try {
      // ✅ /api/income/<id>/
      await api.delete(`${API_PATH}${id}/`);
      await fetchIncome();
    } catch (e) {
      console.error("DELETE INCOME ERROR:", e?.response?.data || e);
      setError(e?.response?.data?.detail || "Could not delete income.");
    }
  };

  return (
    <div className="inc">
      <div className="inc-head">
        <div>
          <h2>Income</h2>
          <p>Track income from all sources</p>
        </div>
        <div className="inc-actions">
          <button className="inc-btn primary" onClick={openAdd}>
            <FaPlus /> Add Income
          </button>
        </div>
      </div>

      {error && <div className="inc-alert">{error}</div>}

      <div className="inc-summary">
        <div className="inc-kpi">
          <FaWallet />
          <div>
            <div className="k">Total Income</div>
            <div className="v">{inr(summary.total)}</div>
          </div>
        </div>

        {Object.entries(summary.byCategory).map(([k, v]) => (
          <div className="inc-pill" key={k}>
            {k}: {inr(v)}
          </div>
        ))}
      </div>

      <div className="inc-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Category</th>
              <th className="right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <FaCalendarAlt /> {i.date || i.income_date}
                </td>
                <td>{i.source}</td>
                <td>{i.category}</td>
                <td className="right">{inr(i.amount)}</td>
                <td>
                  <button onClick={() => openEdit(i)}>Edit</button>
                  <button onClick={() => handleDelete(i.id)}>Delete</button>
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td colSpan="5" className="empty">
                  No income added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="inc-overlay" onClick={() => setModalOpen(false)}>
          <div className="inc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit Income" : "Add Income"}</h3>

            <form onSubmit={handleSubmit}>
              <input
                placeholder="Name"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                required
              />

              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>SALARY</option>
                <option>FREELANCE</option>
                <option>BUSINESS</option>
                <option>RENTAL</option>
                <option>INTEREST</option>
                <option>OTHER</option>
              </select>

              <input
                type="number"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />

              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />

              <textarea
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="inc-modal-actions">
                <button type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function inr(x) {
  return Number(x || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}