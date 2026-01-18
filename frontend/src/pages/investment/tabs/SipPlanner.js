import React, { useMemo, useState } from "react";
import "./tabs.css";

export default function SipPlanner() {
  const [amount, setAmount] = useState("");
  const [years, setYears] = useState("");
  const [rate, setRate] = useState(12);

  // SIP Future Value: FV = SIP * [((1+i)^n - 1)/i] * (1+i)
  const out = useMemo(() => {
    const sip = Number(amount);
    const y = Number(years);
    const r = Number(rate);

    if (!sip || !y || !r) return null;

    const i = r / 100 / 12;
    const n = y * 12;

    const fv = sip * (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
    const invested = sip * n;
    const gain = fv - invested;

    return { fv, invested, gain };
  }, [amount, years, rate]);

  return (
    <div className="inv-panel inv-tab-panel">
      {/* Header */}
      <div className="inv-head">
        <div>
          <h3>SIP Planner</h3>
          <p>Estimate future value of your monthly SIP investments.</p>
        </div>
      </div>

      {/* Input Card */}
      <div className="inv-card">
        <div className="inv-form-grid">
          <Field label="Monthly SIP (₹)">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5,000"
            />
          </Field>

          <Field label="Time Horizon (Years)">
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="e.g. 10"
            />
          </Field>

          <Field label="Expected Return (% p.a.)">
            <div className="rate-box">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <div className="rate-chips">
                {[8, 10, 12, 15].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rate-chip ${Number(rate) === r ? "active" : ""}`}
                    onClick={() => setRate(r)}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>
      </div>

      {/* Output */}
      {!out ? (
        <div className="inv-empty">
          Enter <strong>SIP amount</strong>, <strong>years</strong>, and <strong>return rate</strong>.
        </div>
      ) : (
        <div className="inv-grid-3">
          <Metric title="Total Invested" value={inr(out.invested)} />
          <Metric title="Estimated Value" value={inr(out.fv)} />
          <Metric title="Estimated Gain" value={inr(out.gain)} />
        </div>
      )}

      <div className="inv-note">
        Returns shown are indicative and may vary with market performance.
      </div>
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