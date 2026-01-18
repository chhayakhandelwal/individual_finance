import React, { useMemo, useState } from "react";
import "./tabs.css";

export default function InvestmentGoals() {
  const [goal, setGoal] = useState({
    name: "",
    target: "",
    years: "",
    risk: "MEDIUM",
  });

  const riskReturns = {
    LOW: { min: 6, max: 8, alloc: "Debt 70% • Equity 30%", cls: "risk-low" },
    MEDIUM: { min: 10, max: 12, alloc: "Equity 60% • Debt 40%", cls: "risk-medium" },
    HIGH: { min: 12, max: 15, alloc: "Equity 80% • Debt 20%", cls: "risk-high" },
  };

  const out = useMemo(() => {
    const P = Number(goal.target);
    const y = Number(goal.years);
    if (!P || !y) return null;

    const { min, max } = riskReturns[goal.risk];
    const minFV = P * Math.pow(1 + min / 100, y);
    const maxFV = P * Math.pow(1 + max / 100, y);

    const sipNeeded = (annualRate) => {
      const i = annualRate / 100 / 12;
      const n = y * 12;
      const factor = (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
      return P / factor;
    };

    return {
      minFV,
      maxFV,
      sipMin: sipNeeded(min),
      sipMax: sipNeeded(max),
      alloc: riskReturns[goal.risk].alloc,
    };
  }, [goal]);

  return (
    <div className="inv-panel inv-tab-panel">
      {/* Header */}
      <div className="inv-head">
        <div>
          <h3>Goal-Based Investing</h3>
          <p>Plan investments by goal, horizon, and risk appetite.</p>
        </div>
        <span className={`risk-pill ${riskReturns[goal.risk].cls}`}>
          {goal.risk} RISK
        </span>
      </div>

      {/* Input Card */}
      <div className="inv-card">
        <div className="inv-form-grid">
          <Field label="Goal Name">
            <input
              value={goal.name}
              onChange={(e) => setGoal({ ...goal, name: e.target.value })}
              placeholder="e.g. House Down Payment"
            />
          </Field>

          <Field label="Target Amount (₹)">
            <input
              type="number"
              value={goal.target}
              onChange={(e) => setGoal({ ...goal, target: e.target.value })}
              placeholder="e.g. 10,00,000"
            />
          </Field>

          <Field label="Time Horizon (Years)">
            <input
              type="number"
              value={goal.years}
              onChange={(e) => setGoal({ ...goal, years: e.target.value })}
              placeholder="e.g. 7"
            />
          </Field>

          <Field label="Risk Preference">
            <select
              value={goal.risk}
              onChange={(e) => setGoal({ ...goal, risk: e.target.value })}
            >
              <option value="LOW">Low – Stable</option>
              <option value="MEDIUM">Medium – Balanced</option>
              <option value="HIGH">High – Aggressive</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Output */}
      {!out ? (
        <div className="inv-empty">
          Enter <strong>Target Amount</strong> and <strong>Time Horizon</strong> to get your plan.
        </div>
      ) : (
        <>
          <div className="inv-grid-3">
            <Metric
              title="Suggested Monthly SIP"
              value={`${inr(out.sipMin)} – ${inr(out.sipMax)}`}
            />
            <Metric
              title="Expected Corpus"
              value={`${inr(out.minFV)} – ${inr(out.maxFV)}`}
            />
            <Metric title="Asset Allocation" value={out.alloc} />
          </div>

          <div className="inv-note">
            Estimates are indicative. Actual returns depend on market performance and fund selection.
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="inv-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div className="inv-metric">
      <div className="k">{title}</div>
      <div className="v">{value}</div>
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