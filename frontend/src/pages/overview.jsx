import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaWallet, FaArrowUp, FaArrowDown, FaPiggyBank } from "react-icons/fa";
import "./overview.css";

/* ---------- TOKEN UTILS ---------- */
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const readToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

function inr(x) {
  return Number(x || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function Overview() {
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [savings, setSavings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
  }, []);

  const ensureLoggedIn = () => {
    if (!readToken()) {
      setError("Please login to see overview.");
      return false;
    }
    return true;
  };

  useEffect(() => {
    const load = async () => {
      if (!ensureLoggedIn()) return;

      setLoading(true);
      setError("");
      try {
        // These should match your backend routes
        const [incRes, expRes, savRes] = await Promise.all([
          api.get("/api/income/"),
          api.get("/api/expense/"),
          api.get("/api/saving/"),
        ]);

        setIncome(Array.isArray(incRes.data) ? incRes.data : []);
        setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        setSavings(Array.isArray(savRes.data) ? savRes.data : []);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
            "Could not load overview data."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [api]);

  const totals = useMemo(() => {
    const totalIncome = income.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalSavings = savings.reduce((s, x) => s + Number(x.amount || 0), 0);
    const balance = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, totalSavings, balance };
  }, [income, expenses, savings]);

  return (
    <div className="ov">
      <div className="ov__header">
        <div>
          <h2 className="ov__title">Overview</h2>
          <p className="ov__subtitle">Your quick financial summary</p>
        </div>
      </div>

      {error && <div className="ov__alert">{error}</div>}
      {loading && <div className="ov__alert">Loading...</div>}

      <div className="ov__grid">
        <div className="ov__card">
          <div className="ov__icon">
            <FaArrowUp />
          </div>
          <div>
            <div className="ov__label">Total Income</div>
            <div className="ov__value">{inr(totals.totalIncome)}</div>
          </div>
        </div>

        <div className="ov__card">
          <div className="ov__icon">
            <FaArrowDown />
          </div>
          <div>
            <div className="ov__label">Total Expenses</div>
            <div className="ov__value">{inr(totals.totalExpenses)}</div>
          </div>
        </div>

        <div className="ov__card">
          <div className="ov__icon">
            <FaPiggyBank />
          </div>
          <div>
            <div className="ov__label">Total Savings</div>
            <div className="ov__value">{inr(totals.totalSavings)}</div>
          </div>
        </div>

        <div className="ov__card ov__card--accent">
          <div className="ov__icon">
            <FaWallet />
          </div>
          <div>
            <div className="ov__label">Balance</div>
            <div className="ov__value">{inr(totals.balance)}</div>
          </div>
        </div>
      </div>

      <div className="ov__note">
        This page is intentionally not showing Loans. Your Loans are only on the Loan page.
      </div>
    </div>
  );
}
console.log("✅ OVERVIEW RENDERING (NEW FILE)");