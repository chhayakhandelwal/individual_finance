// src/pages/expenses/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./expenses.css";


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


/* ---------- CATEGORY MASTER (frontend labels) ---------- */
const CATEGORY_MASTER = [
 { key: "Shopping", name: "Shopping", icon: "🛍️", color: "#2563eb", monthlyLimit: 6000 },
 { key: "Food", name: "Food / Eating Out", icon: "🍽️", color: "#ef4444", monthlyLimit: 5000 },
 { key: "Groceries", name: "Groceries", icon: "🛒", color: "#10b981", monthlyLimit: 7000 },
 { key: "Medical", name: "Medical", icon: "💊", color: "#a855f7", monthlyLimit: 2000 },
 { key: "Fuel", name: "Fuel", icon: "⛽", color: "#f59e0b", monthlyLimit: 3000 },
 { key: "Bills", name: "Bills", icon: "🧾", color: "#64748b", monthlyLimit: 2500 },
 { key: "Other", name: "Other", icon: "📌", color: "#0f172a", monthlyLimit: 2500 },
];


const PAYMENT_MODES = ["UPI", "Card", "Cash", "NetBanking", "Wallet", "OCR"];


/* ---------- API CONFIG ---------- */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const ENDPOINTS = {
 EXPENSES: "/api/expenses/",
 DETAIL: (id) => `/api/expenses/${id}/`,
 OCR: "/api/expenses/ocr/",
};


/* ---------- LOCAL STORAGE KEYS ---------- */
const LS_BUDGET_LIMITS = "finpro_budget_limits_v1"; // { Shopping: 6000, Food: 5000, ... }


const normalizeDate = (v) => {
 if (!v) return "";
 const s = String(v).slice(0, 10);
 if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
 const d = new Date(v);
 if (Number.isNaN(d.getTime())) return "";
 const yyyy = d.getFullYear();
 const mm = String(d.getMonth() + 1).padStart(2, "0");
 const dd = String(d.getDate()).padStart(2, "0");
 return `${yyyy}-${mm}-${dd}`;
};


const monthKeyFromDate = (dateStr) => {
 const d = new Date(dateStr);
 if (Number.isNaN(d.getTime())) return "";
 const yyyy = d.getFullYear();
 const mm = String(d.getMonth() + 1).padStart(2, "0");
 return `${yyyy}-${mm}`; // e.g., "2026-01"
};


/* ---------- BACKEND <-> UI (UPDATED FIELD NAMES) ---------- */
const mapFromBackend = (row) => ({
 id: row.id,
 category: row.categoryKey || row.category || "Other",
 expense_date: normalizeDate(row.date || row.expense_date),
 description: row.note || row.description || "",
 merchant: row.merchant || "",
 amount: row.amount ?? "",
 payment_mode: row.paymentMode || row.payment_mode || "UPI",
 source: row.source || "MANUAL",
 direction: row.direction || "DEBIT",
 sub_category: row.sub_category || "",
 txn_id: row.txn_id || null,
 raw_text: row.raw_text || "",
});


const toBackendPayload = (draft) => ({
 categoryKey: String(draft.category || "Other").trim(),
 date: normalizeDate(draft.expense_date),
 amount: Number(draft.amount),
 note: String(draft.description || "").trim() || "",
 merchant: String(draft.merchant || "").trim() || null,
 paymentMode: String(draft.payment_mode || "").trim() || null,
 source: String(draft.source || "MANUAL").toUpperCase(),
 direction: "DEBIT",
});


/* =========================
  COMPONENT
  ========================= */
export default function Expenses() {
 /* ---------- AXIOS INSTANCE ---------- */
 const api = useMemo(() => {
   const instance = axios.create({
     baseURL: API_BASE_URL,
     timeout: 30000,
     withCredentials: false,
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
 }, []);


 /* ---------- STATE ---------- */
 const [activeTab, setActiveTab] = useState("overview"); // overview | expenses | ocr


 // Selected month for budgets/overview
 const [selectedMonth, setSelectedMonth] = useState(() => {
   const now = new Date();
   const yyyy = now.getFullYear();
   const mm = String(now.getMonth() + 1).padStart(2, "0");
   return `${yyyy}-${mm}`;
 });


 // Categories with limits (hydrated from localStorage)
 const [categories, setCategories] = useState(() => {
   let saved = {};
   try {
     saved = JSON.parse(localStorage.getItem(LS_BUDGET_LIMITS) || "{}") || {};
   } catch {
     saved = {};
   }
   return CATEGORY_MASTER.map((c) => ({
     ...c,
     monthlyLimit: Number.isFinite(Number(saved[c.key])) ? Number(saved[c.key]) : c.monthlyLimit,
   }));
 });


 const [expenses, setExpenses] = useState([]);
 const [loading, setLoading] = useState(false);
 const [errorMsg, setErrorMsg] = useState("");


 // manual add
 const [newExpense, setNewExpense] = useState({
   description: "",
   merchant: "",
   category: "Food",
   amount: "",
   expense_date: new Date().toISOString().slice(0, 10),
   payment_mode: "UPI",
   source: "MANUAL",
 });


 // edit existing expense
 const [editId, setEditId] = useState(null);
 const [editDraft, setEditDraft] = useState(null);


 // limits
 const [limitEditKey, setLimitEditKey] = useState(null);
 const [limitValue, setLimitValue] = useState("");


 // OCR
 const [ocrFile, setOcrFile] = useState(null);
 const [ocrLoading, setOcrLoading] = useState(false);
 const [ocrError, setOcrError] = useState("");
 const [ocrPreview, setOcrPreview] = useState([]); // editable rows
 const [ocrRawText, setOcrRawText] = useState("");
 const [ocrFileInputKey, setOcrFileInputKey] = useState(0);
 const ocrSelectAllRef = useRef(null);


 /* ---------- HELPERS ---------- */
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
   console.error(`${label} | status=${status} | url=${url}`);
   if (err?.response?.data) console.error("Backend:", err.response.data);
   else console.error("Message:", err?.message);
 };


 const catMeta = useMemo(() => {
   const map = {};
   for (const c of categories) map[c.key] = c;
   return map;
 }, [categories]);


 const ocrAllSelected = useMemo(
   () => ocrPreview.length > 0 && ocrPreview.every((r) => r._selected),
   [ocrPreview]
 );


 useEffect(() => {
   const el = ocrSelectAllRef.current;
   if (!el) return;
   const some = ocrPreview.some((r) => r._selected);
   el.indeterminate = some && !ocrAllSelected;
 }, [ocrPreview, ocrAllSelected]);


 /* ---------- FETCH EXPENSES ---------- */
 const fetchExpenses = useCallback(async () => {
   if (!ensureLoggedIn()) return;


   setLoading(true);
   setErrorMsg("");
   try {
     const res = await api.get(ENDPOINTS.EXPENSES);
     const list = Array.isArray(res.data) ? res.data : [];
     setExpenses(list.map(mapFromBackend));
   } catch (err) {
     logAxios("FETCH EXPENSES ERROR", err);
     setErrorMsg(
       err?.response?.status === 404
         ? "API not found: /api/expenses/ (check Django urls)."
         : err?.response?.status === 401
         ? "Unauthorized. Please login again."
         : "Failed to load expenses."
     );
   } finally {
     setLoading(false);
   }
 }, [api]);


 useEffect(() => {
   fetchExpenses();
 }, [fetchExpenses]);


 /* ---------- FILTER EXPENSES BY SELECTED MONTH (dynamic budgets) ---------- */
 const monthExpenses = useMemo(() => {
   return expenses.filter((e) => monthKeyFromDate(e.expense_date) === selectedMonth);
 }, [expenses, selectedMonth]);


 /* ---------- OVERVIEW METRICS (MONTH-AWARE) ---------- */
 const totalsByCategory = useMemo(() => {
   const map = {};
   for (const c of categories) map[c.key] = 0;


   for (const e of monthExpenses) {
     const key = e.category || "Other";
     map[key] = (map[key] || 0) + Number(e.amount || 0);
   }
   return map;
 }, [monthExpenses, categories]);


 const overall = useMemo(() => {
   const totalSpent = Object.values(totalsByCategory).reduce((a, b) => a + (Number(b) || 0), 0);
   const totalLimit = categories.reduce((a, c) => a + (Number(c.monthlyLimit) || 0), 0);
   const remaining = Math.max(totalLimit - totalSpent, 0);
   const exceededCount = categories.filter(
     (c) => (totalsByCategory[c.key] || 0) > (Number(c.monthlyLimit) || 0)
   ).length;


   return { totalSpent, totalLimit, remaining, exceededCount };
 }, [totalsByCategory, categories]);


 /* ---------- CRUD: ADD ---------- */
 const addExpense = async () => {
   if (!ensureLoggedIn()) return;


   const amt = Number(newExpense.amount);
   if (!Number.isFinite(amt) || amt <= 0) {
     setErrorMsg("Enter a valid amount.");
     return;
   }
   if (!newExpense.expense_date) {
     setErrorMsg("Select a date.");
     return;
   }


   setErrorMsg("");
   setLoading(true);


   try {
     const payload = toBackendPayload({
       ...newExpense,
       amount: amt,
       expense_date: newExpense.expense_date,
       source: "MANUAL",
     });


     await api.post(ENDPOINTS.EXPENSES, payload);


     setNewExpense({
       description: "",
       merchant: "",
       category: "Food",
       amount: "",
       expense_date: new Date().toISOString().slice(0, 10),
       payment_mode: "UPI",
       source: "MANUAL",
     });


     await fetchExpenses();
     setActiveTab("expenses");
   } catch (err) {
     logAxios("ADD EXPENSE ERROR", err);
     setErrorMsg(
       err?.response?.data?.detail ||
         err?.response?.data?.message ||
         (err?.response?.data && JSON.stringify(err.response.data)) ||
         "Failed to add expense."
     );
   } finally {
     setLoading(false);
   }
 };


 /* ---------- CRUD: DELETE ---------- */
 const deleteExpense = async (id) => {
   if (!ensureLoggedIn()) return;


   setLoading(true);
   setErrorMsg("");
   try {
     await api.delete(ENDPOINTS.DETAIL(id));
     await fetchExpenses();
   } catch (err) {
     logAxios("DELETE EXPENSE ERROR", err);
     setErrorMsg("Failed to delete expense.");
   } finally {
     setLoading(false);
   }
 };


 /* ---------- CRUD: EDIT ---------- */
 const startEditExpense = (row) => {
   setEditId(row.id);
   setEditDraft({
     description: row.description || "",
     merchant: row.merchant || "",
     category: row.category || "Other",
     amount: String(row.amount ?? ""),
     expense_date: normalizeDate(row.expense_date),
     payment_mode: row.payment_mode || "UPI",
     source: row.source || "MANUAL",
   });
 };


 const cancelEdit = () => {
   setEditId(null);
   setEditDraft(null);
 };


 const saveEditExpense = async () => {
   if (!ensureLoggedIn()) return;
   if (!editId || !editDraft) return;


   const amt = Number(editDraft.amount);
   if (!Number.isFinite(amt) || amt <= 0) {
     setErrorMsg("Enter a valid amount.");
     return;
   }


   setLoading(true);
   setErrorMsg("");


   try {
     const payload = toBackendPayload({ ...editDraft, amount: amt });
     await api.patch(ENDPOINTS.DETAIL(editId), payload);
     cancelEdit();
     await fetchExpenses();
   } catch (err) {
     logAxios("UPDATE EXPENSE ERROR", err);
     setErrorMsg(
       err?.response?.data?.detail ||
         (err?.response?.data && JSON.stringify(err.response.data)) ||
         "Failed to update expense."
     );
   } finally {
     setLoading(false);
   }
 };


 /* ---------- LIMITS (persist to localStorage) ---------- */
 const startLimitEdit = (cat) => {
   setLimitEditKey(cat.key);
   setLimitValue(String(cat.monthlyLimit ?? ""));
 };


 const persistLimits = (nextCategories) => {
   const obj = {};
   for (const c of nextCategories) obj[c.key] = Number(c.monthlyLimit) || 0;
   try {
     localStorage.setItem(LS_BUDGET_LIMITS, JSON.stringify(obj));
   } catch {
     // ignore
   }
 };


 const saveLimitEdit = (key) => {
   const val = Number(limitValue);
   if (!Number.isFinite(val) || val < 0) {
     setErrorMsg("Enter a valid limit.");
     return;
   }


   setCategories((prev) => {
     const next = prev.map((c) => (c.key === key ? { ...c, monthlyLimit: val } : c));
     persistLimits(next);
     return next;
   });


   setLimitEditKey(null);
 };


 const resetAllLimits = () => {
   setCategories(() => {
     const next = CATEGORY_MASTER.map((c) => ({ ...c }));
     persistLimits(next);
     return next;
   });
   setLimitEditKey(null);
   setLimitValue("");
 };


 /* ---------- OCR: PREVIEW ---------- */
 const runOcr = async () => {
   setActiveTab("ocr");
   if (!ocrFile) {
     setOcrError("Please select a receipt image or PDF first.");
     return;
   }
   if (!ensureLoggedIn()) return;


   setOcrError("");
   setOcrLoading(true);


   try {
     const fd = new FormData();
     fd.append("image", ocrFile);
     fd.append("file", ocrFile);


     const res = await api.post(ENDPOINTS.OCR, fd, { timeout: 120000 });


     const obj = res.data || {};
     const raw = obj.rawText ?? obj.raw_text ?? "";
     setOcrRawText((prev) => (prev && raw ? `${prev}\n\n---\n\n${raw}` : raw || prev));


     const rows = Array.isArray(obj.preview) ? obj.preview : [];
     if (rows.length === 0) {
       setOcrError("No preview returned from server.");
       return;
     }


     const mapped = rows.map((row, idx) => {
       const amt = row.amount;
       const amountStr =
         amt === null || amt === undefined || Number.isNaN(Number(amt)) ? "" : String(amt);
       return {
         _id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
         _selected: true,
         category: row.categoryKey || row.category || "Other",
         expense_date:
           normalizeDate(row.date || row.expense_date) || new Date().toISOString().slice(0, 10),
         description: row.note || row.description || "Bill OCR",
         merchant: row.merchant || "",
         amount: amountStr,
         payment_mode: row.payment_mode || "OCR",
         source: row.source || "OCR",
         direction: "DEBIT",
       };
     });
     setOcrPreview((prev) => [...prev, ...mapped]);
     setOcrFile(null);
     setOcrFileInputKey((k) => k + 1);
   } catch (err) {
     logAxios("OCR ERROR", err);
     const status = err?.response?.status;
     const d = err?.response?.data;
     const backendErr = d?.detail || d?.error;
     let msg = backendErr || "OCR failed. Please check backend logs.";
     if (status === 404) msg = "OCR API not found. Add /api/expenses/ocr/ in backend urls.";
     if (status === 401) msg = "Unauthorized (401). Please login again.";
     if (status === 400 && !backendErr) msg = "Bad request (400). Upload a valid image or PDF.";
     if (status >= 500 && !backendErr) msg = "Server error (500). OCR crashed (check Django console).";
     setOcrError(msg);
   } finally {
     setOcrLoading(false);
   }
 };


 const updateOcrRow = (rowId, patch) => {
   setOcrPreview((prev) => prev.map((r) => (r._id === rowId ? { ...r, ...patch } : r)));
 };


 const toggleAllOcr = (checked) => {
   setOcrPreview((prev) => prev.map((r) => ({ ...r, _selected: checked })));
 };


 const addOcrRow = () => {
   setOcrPreview((prev) => [
     ...prev,
     {
       _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
       _selected: true,
       description: "",
       merchant: "",
       category: "Other",
       amount: "",
       expense_date: new Date().toISOString().slice(0, 10),
       payment_mode: "OCR",
       source: "OCR",
     },
   ]);
   setActiveTab("ocr");
 };


 const clearOcrPreview = () => {
   setOcrPreview([]);
   setOcrRawText("");
   setOcrError("");
 };


 const removeOcrRow = (rowId) => {
   setOcrPreview((prev) => prev.filter((r) => r._id !== rowId));
 };


 const saveOcrSelected = async () => {
   if (!ensureLoggedIn()) return;


   const selected = ocrPreview.filter((r) => r._selected);
   if (selected.length === 0) {
     setOcrError("Select at least one row to save.");
     return;
   }


   setOcrError("");
   setOcrLoading(true);


   try {
     for (const r of selected) {
       const amt = Number(r.amount);
       if (!Number.isFinite(amt) || amt <= 0) continue;


       const payload = toBackendPayload({
         ...r,
         amount: amt,
         source: "OCR",
       });


       await api.post(ENDPOINTS.EXPENSES, payload);
     }


     setOcrFile(null);
     setOcrPreview([]);
     setOcrRawText("");
     await fetchExpenses();
     setActiveTab("expenses");
   } catch (err) {
     logAxios("SAVE OCR ERROR", err);
     setOcrError(
       err?.response?.data?.detail ||
         (err?.response?.data && JSON.stringify(err.response.data)) ||
         "Failed to save OCR rows."
     );
   } finally {
     setOcrLoading(false);
   }
 };


 return (
   <div className="exp-wrap">
     <div className="exp-top">
       <div className="exp-title">
         <h2>Expenses</h2>
         <div className="exp-subtitle">Manual + OCR/Statement import with category budgets.</div>
       </div>


       <div className="exp-actions">
         <button className="exp-btn" onClick={fetchExpenses} disabled={loading} type="button">
           {loading ? "Refreshing..." : "Refresh"}
         </button>
       </div>
     </div>


     {/* Tabs */}
     <div className="exp-tabs">
       <button className={`exp-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")} type="button">
         Overview
       </button>
       <button className={`exp-tab ${activeTab === "expenses" ? "active" : ""}`} onClick={() => setActiveTab("expenses")} type="button">
         Expenses
       </button>
       <button className={`exp-tab ${activeTab === "ocr" ? "active" : ""}`} onClick={() => setActiveTab("ocr")} type="button">
         OCR / Statement
       </button>
     </div>


     {errorMsg && <div className="exp-alert">{errorMsg}</div>}


     {/* OVERVIEW */}
     {activeTab === "overview" && (
       <>
         <div className="exp-panel" style={{ marginBottom: 16 }}>
           <div className="exp-panel-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
             <div>
               <h3>Overview</h3>
               <div className="exp-panel-sub">All budget calculations below are for the selected month.</div>
             </div>


             <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
               <label style={{ fontSize: 12, opacity: 0.8 }}>Month</label>
               <input
                 type="month"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}
               />
             </div>
           </div>
         </div>


         <div className="exp-grid-4">
           <SummaryCard title="Total Spent" value={inr(overall.totalSpent)} />
           <SummaryCard title="Total Limit" value={inr(overall.totalLimit)} />
           <SummaryCard title="Remaining" value={inr(overall.remaining)} />
           <SummaryCard title="Exceeded Categories" value={String(overall.exceededCount)} />
         </div>


         <div className="exp-panel">
           <div className="exp-panel-head">
             <h3>Quick OCR Import</h3>
             <div className="exp-panel-sub">
               Upload a receipt image or PDF. We extract <strong>date</strong>, <strong>category</strong> (Shopping, Food, Groceries, Medical, Fuel, Bills, Other), and{" "}
               <strong>total amount</strong> — then you can edit and save.
             </div>
           </div>


           <div className="exp-ocr-quick">
             <input
               key={`quick-${ocrFileInputKey}`}
               className="exp-ocr-file-native"
               type="file"
               accept="image/*,.pdf,application/pdf"
               onChange={(e) => {
                 setOcrFile(e.target.files?.[0] || null);
                 setOcrError("");
               }}
             />
             {ocrFile ? <span className="exp-ocr-file-name">{ocrFile.name}</span> : null}
             <button className="exp-btn primary" onClick={runOcr} disabled={ocrLoading} type="button">
               {ocrLoading ? "Processing..." : "Run OCR"}
             </button>
             <button className="exp-btn" onClick={() => setActiveTab("ocr")} type="button">
               Open bill review
             </button>
           </div>
         </div>


         <div className="exp-panel">
           <div className="exp-panel-head" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
             <div>
               <h3>Category Budgets</h3>
               <div className="exp-panel-sub">
                 Limits are saved in your browser (localStorage). Spent is calculated for <b>{selectedMonth}</b>.
               </div>
             </div>


             <button className="exp-btn" onClick={resetAllLimits} type="button">
               Reset Limits
             </button>
           </div>


           <div className="exp-cat-grid">
             {categories.map((c) => {
               const spent = totalsByCategory[c.key] || 0;
               const limit = Number(c.monthlyLimit) || 0;
               const pct = limit > 0 ? (spent / limit) * 100 : 0;
               const exceeded = limit > 0 && spent > limit;


               let barClass = "ok";
               if (pct >= 50 && !exceeded) barClass = "warn";
               if (exceeded) barClass = "bad";


               return (
                 <div key={c.key} className="exp-cat-card">
                   <div className="exp-cat-top">
                     <div className="exp-cat-icon" style={{ background: c.color }}>
                       {c.icon}
                     </div>
                     <div className="exp-cat-meta">
                       <div className="exp-cat-name">{c.name}</div>
                       <div className="exp-cat-sub">{inr(spent)} spent</div>
                     </div>


                     <div className="exp-cat-actions">
                       {limitEditKey === c.key ? (
                         <>
                           <input
                             className="exp-mini-input"
                             type="number"
                             value={limitValue}
                             onChange={(e) => setLimitValue(e.target.value)}
                             placeholder="Limit"
                           />
                           <button className="exp-mini-btn" onClick={() => saveLimitEdit(c.key)} type="button">
                             Save
                           </button>
                         </>
                       ) : (
                         <button className="exp-mini-btn" onClick={() => startLimitEdit(c)} type="button">
                           Edit Limit
                         </button>
                       )}
                     </div>
                   </div>


                   <div className="exp-progress">
                     <div className="exp-progress-meta">
                       <span>{limit > 0 ? `${Math.min(pct, 100).toFixed(0)}%` : "-"}</span>
                       <span>{limit > 0 ? `${inr(spent)} / ${inr(limit)}` : `No limit set`}</span>
                     </div>


                     <div className="exp-bar">
                       <div className={`exp-bar-fill ${barClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                     </div>


                     {exceeded && <div className="exp-exceeded">Exceeded limit!</div>}
                   </div>


                   <div className="exp-cat-footer">
                     <button
                       className="exp-btn small"
                       onClick={() => {
                         setNewExpense((p) => ({ ...p, category: c.key }));
                         setActiveTab("expenses");
                       }}
                       type="button"
                     >
                       + Add Expense
                     </button>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       </>
     )}


     {/* EXPENSES TAB */}
     {activeTab === "expenses" && (
       <>
         <div className="exp-panel">
           <div className="exp-panel-head">
             <h3>Add Expense</h3>
             <div className="exp-panel-sub">Creates an expense in Django DB.</div>
           </div>


           <div className="exp-form">
             <div className="exp-field">
               <label>Category</label>
               <select value={newExpense.category} onChange={(e) => setNewExpense((p) => ({ ...p, category: e.target.value }))}>
                 {categories.map((c) => (
                   <option key={c.key} value={c.key}>
                     {c.name}
                   </option>
                 ))}
               </select>
             </div>


             <div className="exp-field">
               <label>Amount</label>
               <input type="number" value={newExpense.amount} onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))} placeholder="e.g. 499" />
             </div>


             <div className="exp-field">
               <label>Date</label>
               <input type="date" value={newExpense.expense_date} onChange={(e) => setNewExpense((p) => ({ ...p, expense_date: e.target.value }))} />
             </div>


             <div className="exp-field">
               <label>Merchant (optional)</label>
               <input type="text" value={newExpense.merchant} onChange={(e) => setNewExpense((p) => ({ ...p, merchant: e.target.value }))} placeholder="e.g. Amazon" />
             </div>


             <div className="exp-field wide">
               <label>Description / Note</label>
               <input type="text" value={newExpense.description} onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. groceries for week" />
             </div>


             <div className="exp-field">
               <label>Payment</label>
               <select value={newExpense.payment_mode} onChange={(e) => setNewExpense((p) => ({ ...p, payment_mode: e.target.value }))}>
                 {PAYMENT_MODES.map((m) => (
                   <option key={m} value={m}>
                     {m}
                   </option>
                 ))}
               </select>
             </div>


             <div className="exp-field actions">
               <button className="exp-btn primary" onClick={addExpense} type="button" disabled={loading}>
                 {loading ? "Saving..." : "Add Expense"}
               </button>
             </div>
           </div>
         </div>


         <div className="exp-panel">
           <div className="exp-panel-head">
             <h3>Recent Expenses</h3>
             <div className="exp-panel-sub">Edit / delete rows from DB.</div>
           </div>


           {expenses.length === 0 ? (
             <div className="exp-empty">No expenses found.</div>
           ) : (
             <div className="exp-table">
               <div className="exp-row head">
                 <div>Date</div>
                 <div>Category</div>
                 <div>Merchant</div>
                 <div>Description</div>
                 <div className="right">Amount</div>
                 <div className="right">Actions</div>
               </div>


               {expenses.map((row) => {
                 const isEdit = editId === row.id;
                 const cat = catMeta[row.category] || { name: row.category };


                 return (
                   <div className="exp-row" key={row.id}>
                     <div>
                       {isEdit ? (
                         <input className="exp-cell-input" type="date" value={editDraft?.expense_date || ""} onChange={(e) => setEditDraft((p) => ({ ...p, expense_date: e.target.value }))} />
                       ) : (
                         normalizeDate(row.expense_date)
                       )}
                     </div>


                     <div>
                       {isEdit ? (
                         <select className="exp-cell-input" value={editDraft?.category || "Other"} onChange={(e) => setEditDraft((p) => ({ ...p, category: e.target.value }))}>
                           {categories.map((c) => (
                             <option key={c.key} value={c.key}>
                               {c.name}
                             </option>
                           ))}
                         </select>
                       ) : (
                         cat.name
                       )}
                     </div>


                     <div>
                       {isEdit ? (
                         <input className="exp-cell-input" type="text" value={editDraft?.merchant || ""} onChange={(e) => setEditDraft((p) => ({ ...p, merchant: e.target.value }))} />
                       ) : (
                         row.merchant || "-"
                       )}
                     </div>


                     <div>
                       {isEdit ? (
                         <input className="exp-cell-input" type="text" value={editDraft?.description || ""} onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))} />
                       ) : (
                         row.description || "-"
                       )}
                     </div>


                     <div className="right">
                       {isEdit ? (
                         <input className="exp-cell-input" type="number" value={editDraft?.amount ?? ""} onChange={(e) => setEditDraft((p) => ({ ...p, amount: e.target.value }))} />
                       ) : (
                         inr(row.amount)
                       )}
                     </div>


                     <div className="right">
                       {isEdit ? (
                         <>
                           <button className="exp-mini-btn" onClick={saveEditExpense} type="button" disabled={loading}>
                             Save
                           </button>
                           <button className="exp-mini-btn ghost" onClick={cancelEdit} type="button" disabled={loading}>
                             Cancel
                           </button>
                         </>
                       ) : (
                         <>
                           <button className="exp-mini-btn" onClick={() => startEditExpense(row)} type="button">
                             Edit
                           </button>
                           <button className="exp-mini-btn danger" onClick={() => deleteExpense(row.id)} type="button" disabled={loading}>
                             Delete
                           </button>
                         </>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
         </div>
       </>
     )}


     {/* OCR TAB */}
     {activeTab === "ocr" && (
       <div className="exp-ocr-page">
         <div className="exp-ocr-hero">
           <div className="exp-ocr-hero-icon" aria-hidden>
             <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path
                 d="M7 3h8l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                 stroke="currentColor"
                 strokeWidth="1.8"
                 strokeLinejoin="round"
               />
               <path d="M14 3v4h4M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
             </svg>
           </div>
           <div>
             <h3 className="exp-ocr-hero-title">Bill OCR</h3>
             <p className="exp-ocr-hero-sub">
               Upload receipts (image or PDF). Each run adds items below — edit any field, then save selected rows to your expenses.
             </p>
           </div>
         </div>


         {ocrError && <div className="exp-alert">{ocrError}</div>}


         <div className="exp-ocr-upload-card">
           <div className="exp-ocr-upload-row">
             <div className="exp-ocr-upload-left">
               <label className="exp-ocr-file-label">
                 <span className="exp-ocr-file-label-text">Choose file</span>
                 <input
                   key={ocrFileInputKey}
                   className="exp-ocr-file-input"
                   type="file"
                   accept="image/*,.pdf,application/pdf"
                   onChange={(e) => {
                     setOcrFile(e.target.files?.[0] || null);
                     setOcrError("");
                   }}
                 />
               </label>
               <span className="exp-ocr-file-hint">{ocrFile ? ocrFile.name : "No file selected"}</span>
             </div>
             <div className="exp-ocr-upload-actions">
               <button className="exp-btn exp-btn-ocr-primary" onClick={runOcr} disabled={ocrLoading} type="button">
                 {ocrLoading ? "Scanning…" : "Run OCR"}
               </button>
               <button className="exp-btn" onClick={addOcrRow} disabled={ocrLoading} type="button">
                 + Add row
               </button>
             </div>
           </div>
         </div>


         {ocrPreview.length > 0 && (
           <div className="exp-ocr-toolbar">
             <label className="exp-ocr-select-all-label">
               <input
                 ref={ocrSelectAllRef}
                 type="checkbox"
                 checked={ocrAllSelected}
                 onChange={(e) => toggleAllOcr(e.target.checked)}
               />
               <span>Select all</span>
             </label>
             <span className="exp-ocr-count">{ocrPreview.length} item(s)</span>
             <div className="exp-ocr-toolbar-spacer" />
             <button className="exp-btn exp-btn-ghost" onClick={clearOcrPreview} disabled={ocrLoading} type="button">
               Clear list
             </button>
             <button className="exp-btn exp-btn-ocr-primary" onClick={saveOcrSelected} disabled={ocrLoading} type="button">
               Save selected
             </button>
           </div>
         )}


         {ocrPreview.length === 0 ? (
           <div className="exp-ocr-empty">
             <p>No bills yet. Choose a file and click <strong>Run OCR</strong>, or add a row manually.</p>
           </div>
         ) : (
           <div className="exp-ocr-scroll">
             {ocrPreview.map((r, idx) => {
               const meta = catMeta[r.category] || { name: r.category, icon: "📌", color: "#64748b" };
               return (
                 <div className="exp-ocr-card" key={r._id}>
                   <div className="exp-ocr-card-top">
                     <label className="exp-ocr-card-check">
                       <input
                         type="checkbox"
                         checked={!!r._selected}
                         onChange={(e) => updateOcrRow(r._id, { _selected: e.target.checked })}
                       />
                       <span className="exp-ocr-card-badge" style={{ background: meta.color }}>
                         {meta.icon}
                       </span>
                       <span className="exp-ocr-card-title">Item {idx + 1}</span>
                     </label>
                     <button className="exp-ocr-remove" onClick={() => removeOcrRow(r._id)} type="button">
                       Remove
                     </button>
                   </div>


                   <div className="exp-ocr-fields">
                     <div className="exp-ocr-field">
                       <label htmlFor={`ocr-cat-${r._id}`}>Category</label>
                       <select
                         id={`ocr-cat-${r._id}`}
                         className="exp-ocr-input"
                         value={r.category}
                         onChange={(e) => updateOcrRow(r._id, { category: e.target.value })}
                       >
                         {categories.map((c) => (
                           <option key={c.key} value={c.key}>
                             {c.name}
                           </option>
                         ))}
                       </select>
                     </div>


                     <div className="exp-ocr-field">
                       <label htmlFor={`ocr-date-${r._id}`}>Date</label>
                       <input
                         id={`ocr-date-${r._id}`}
                         className="exp-ocr-input"
                         type="date"
                         value={r.expense_date}
                         onChange={(e) => updateOcrRow(r._id, { expense_date: e.target.value })}
                       />
                     </div>


                     <div className="exp-ocr-field">
                       <label htmlFor={`ocr-amt-${r._id}`}>Total amount (₹)</label>
                       <input
                         id={`ocr-amt-${r._id}`}
                         className="exp-ocr-input"
                         type="number"
                         min="0"
                         step="0.01"
                         inputMode="decimal"
                         value={r.amount}
                         onChange={(e) => updateOcrRow(r._id, { amount: e.target.value })}
                         placeholder="0.00"
                       />
                     </div>


                     <div className="exp-ocr-field exp-ocr-field-wide">
                       <label htmlFor={`ocr-merch-${r._id}`}>Merchant</label>
                       <input
                         id={`ocr-merch-${r._id}`}
                         className="exp-ocr-input"
                         value={r.merchant}
                         onChange={(e) => updateOcrRow(r._id, { merchant: e.target.value })}
                         placeholder="Store or payee name"
                       />
                     </div>


                     <div className="exp-ocr-field exp-ocr-field-wide">
                       <label htmlFor={`ocr-desc-${r._id}`}>Description</label>
                       <input
                         id={`ocr-desc-${r._id}`}
                         className="exp-ocr-input"
                         value={r.description}
                         onChange={(e) => updateOcrRow(r._id, { description: e.target.value })}
                         placeholder="Note (optional)"
                       />
                     </div>


                     <div className="exp-ocr-field">
                       <label>Payment</label>
                       <div className="exp-ocr-readonly">{r.payment_mode || "OCR"}</div>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         )}


         {ocrRawText ? (
           <details className="exp-ocr-raw">
             <summary>Extracted text (debug)</summary>
             <pre className="exp-ocr-raw-pre">{ocrRawText}</pre>
           </details>
         ) : null}
       </div>
     )}
   </div>
 );
}


/* ---------- UI HELPERS ---------- */
function SummaryCard({ title, value }) {
 return (
   <div className="exp-card">
     <div className="k">{title}</div>
     <div className="v">{value}</div>
   </div>
 );
}


function inr(x) {
 return Number(x || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

