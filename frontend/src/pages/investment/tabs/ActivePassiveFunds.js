import React, { useMemo, useState } from "react";
import "./ActivePassiveFunds.css";

const AMCS = [
  { key: "HDFC", label: "HDFC" },
  { key: "ICICI", label: "ICICI" },
  { key: "AXIS", label: "Axis" },
  { key: "SBI", label: "SBI" },
];

const CAP_OPTIONS = [
  { key: "LARGE", label: "Large Cap" },
  { key: "MID", label: "Mid Cap" },
  { key: "SMALL", label: "Small Cap" },
];

export default function ActivePassiveFunds() {
  const [mode, setMode] = useState(null); // null | "ACTIVE" | "PASSIVE"
  const [cap, setCap] = useState("LARGE");

  const links = useMemo(() => {
    // ACTIVE: cap-based links
    const active = {
      LARGE: {
        HDFC: "https://www.hdfcfund.com/explore/mutual-funds/hdfc-large-cap-fund/direct",
        ICICI:
          "https://www.icicipruamc.com/mutual-fund/equity-funds/icici-prudential-bluechip-fund/211",
        AXIS:
          "https://www.axismf.com/mutual-funds/equity-funds/axis-large-cap-fund/ef-dg/direct",
        SBI: "https://www.sbimf.com/sbimf-scheme-details/sbi-large-cap-fund-%28formerly-known-as-sbi-bluechip-fund%29-43",
      },
      MID: {
        HDFC: "https://www.hdfcfund.com/explore/mutual-funds/hdfc-mid-cap-fund/direct",
        ICICI:
          "https://www.icicipruamc.com/mutual-fund/equity-funds/icici-prudential-midcap-fund/15",
        AXIS:
          "https://www.axismf.com/mutual-funds/equity-funds/axis-mid-cap-fund/mc-dg/direct",
        SBI: "https://www.sbimf.com/sbimf-scheme-details/sbi-midcap-fund-34",
      },
      SMALL: {
        HDFC: "https://www.hdfcfund.com/explore/mutual-funds/hdfc-small-cap-fund/direct",
        ICICI:
          "https://www.icicipruamc.com/mutual-fund/equity-funds/icici-prudential-smallcap-fund/168",
        AXIS:
          "https://www.axismf.com/mutual-funds/equity-funds/axis-small-cap-fund/sc-dg/direct",
        SBI: "https://www.sbimf.com/sbimf-scheme-details/sbi-small-cap-fund-329",
      },
    };

    // PASSIVE: Nifty 50 links (same for Large/Mid/Small UI)
    const passiveNifty50 = {
      HDFC: "https://www.hdfcfund.com/explore/mutual-funds/hdfc-nifty-50-index-fund/direct",
      ICICI:
        "https://www.icicipruamc.com/mutual-fund/index-funds/icici-prudential-nifty-50-index-fund/57",
      AXIS:
        "https://www.axismf.com/mutual-funds/index-funds/axis-nifty-50-index-fund/n5-dg/direct",
      SBI: "https://www.sbimf.com/sbimf-scheme-details/sbi-nifty-index-fund-13",
    };

    if (mode === "PASSIVE") {
      return { LARGE: passiveNifty50, MID: passiveNifty50, SMALL: passiveNifty50 };
    }
    return active;
  }, [mode]);

  const currentLinks = mode ? links[cap] : null;

  const openLink = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="apf-wrap">
      <div className="apf-header">
        <div>
          <h3 className="apf-title">Active vs Passive Funds</h3>
          <div className="apf-subtitle">
            Choose a category, then pick market-cap segment and AMC to open the official fund page.
          </div>
        </div>

        {mode && (
          <button className="apf-ghost" type="button" onClick={() => setMode(null)}
            disabled={!mode}
          >
            Change Selection
          </button>
        )}
      </div>

      {/* STEP 1: Mode selection cards */}
      {!mode && (
        <div className="apf-mode-grid">
          <button
            type="button"
            className="apf-mode-card"
            onClick={() => {
              setMode("ACTIVE");
              setCap("LARGE");
            }}
          >
            <div className="apf-mode-icon active" aria-hidden="true">
              📈
            </div>
            <div className="apf-mode-content">
              <div className="apf-mode-title">Active Funds</div>
              <div className="apf-mode-desc">
                Fund manager selects stocks to beat the market. Explore Large/Mid/Small cap options.
              </div>
              <div className="apf-mode-cta">Explore Active →</div>
            </div>
          </button>

          <button
            type="button"
            className="apf-mode-card"
            onClick={() => {
              setMode("PASSIVE");
              setCap("LARGE");
            }}
          >
            <div className="apf-mode-icon passive" aria-hidden="true">
              🧭
            </div>
            <div className="apf-mode-content">
              <div className="apf-mode-title">Passive Funds</div>
              <div className="apf-mode-desc">
                Track an index (Nifty 50). Same AMCs, links open Nifty 50 index fund pages.
              </div>
              <div className="apf-mode-cta">Explore Passive →</div>
            </div>
          </button>
        </div>
      )}

      {/* STEP 2 + 3: Cap selector + AMC cards */}
      {mode && (
        <div className="apf-panel">
          <div className="apf-panel-top">
            <div className="apf-badge">
              {mode === "ACTIVE" ? "Active Funds" : "Passive Funds"} •{" "}
              {mode === "PASSIVE" ? "Nifty 50 Index" : "Category Funds"}
            </div>

            <div className="apf-cap-segment" role="tablist" aria-label="Market cap segments">
              {CAP_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`apf-cap-btn ${cap === c.key ? "is-active" : ""}`}
                  onClick={() => setCap(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="apf-amc-grid">
            {AMCS.map((amc) => (
              <button
                key={amc.key}
                type="button"
                className="apf-amc-card"
                onClick={() => openLink(currentLinks?.[amc.key])}
                title={`Open ${amc.label} fund page`}
              >
                <div className="apf-amc-logo" aria-hidden="true">
                  {amc.label.slice(0, 1)}
                </div>
                <div className="apf-amc-info">
                  <div className="apf-amc-name">{amc.label}</div>
                  <div className="apf-amc-sub">
                    {mode === "ACTIVE"
                      ? `${CAP_OPTIONS.find((x) => x.key === cap)?.label} fund`
                      : "Nifty 50 index fund"}
                  </div>
                </div>
                <div className="apf-amc-go" aria-hidden="true">
                  ↗
                </div>
              </button>
            ))}
          </div>

          <div className="apf-note">
            {mode === "PASSIVE"
              ? "Note: Passive links open the Nifty 50 Index Fund page for each AMC."
              : "Tip: Choose Large/Mid/Small cap, then click an AMC to open the fund page."}
          </div>
        </div>
      )}
    </div>
  );
}