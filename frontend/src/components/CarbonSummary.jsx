// Summary card for View B — Exact layout matching design 5.png.

import React, { useState, useEffect, useRef } from "react";
import { Car, TreeDeciduous, Smartphone } from "lucide-react";
import { IconSearch, IconArrowRight } from "./Icons";
import Button from "./Button";

const TEXT_DARK = "#111827";
const GRAY_BG = "#f3f4f6";

// NOTE: 換算常數定義於此，方便日後維護
const KG_CO2_PER_KM_CAR = 0.25;          // 1 km 行車約排放 0.25 kg CO₂ → 1 kg CO₂ ≈ 4 km
const KG_CO2_PER_TREE_PER_YEAR = 12;     // 一棵樹一年約吸收 12 kg CO₂
const PHONE_CHARGES_PER_KG_CO2 = 120;   // 1 kg CO₂ 約可讓手機充電 120 次

const auroraTextStyle = {
  background: "linear-gradient(120deg, #b3d85a, #84cc16, #4ade80, #a3e635, #b3d85a)",
  backgroundSize: "300% 300%",
  animation: "aurora-flow 12s ease infinite",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
};

const iconSvgStr = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cpath d='M8 18v-2'/%3E%3Cpath d='M12 18v-4'/%3E%3Cpath d='M16 18v-6'/%3E%3C/svg%3E";

const cardStyle = {
  background: GRAY_BG,
  borderRadius: "32px",
  padding: "48px 56px",
  display: "flex",
  flexDirection: "column",
  gap: "32px",
};

const metricLabelStyle = {
  fontSize: "1.25rem",
  color: TEXT_DARK,
  fontWeight: 700,
  marginBottom: "8px",
};

const metricValueStyle = {
  fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
  fontWeight: 900,
  lineHeight: 1.2,
  paddingBottom: "0.1em",
  ...auroraTextStyle,
};

const metricSmallValueStyle = {
  fontSize: "2rem",
  fontWeight: 900,
  lineHeight: 1.2,
  paddingBottom: "0.1em",
  ...auroraTextStyle,
};

const metricSecondaryLabelStyle = {
  fontSize: "1.125rem",
  color: TEXT_DARK,
  fontWeight: 700,
  marginBottom: "4px",
};

const metricSecondaryValueStyle = {
  fontSize: "1.125rem",
  color: "#4b5563",
  lineHeight: 1.4,
  fontWeight: 600,
};

const actionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  background: "linear-gradient(120deg, #b3d85a, #84cc16, #4ade80, #a3e635, #b3d85a)",
  backgroundSize: "300% 300%",
  animation: "aurora-flow 12s ease infinite",
  color: "#111",
  border: "none",
  borderRadius: "999px",
  padding: "16px 32px",
  fontWeight: 900,
  fontSize: "1.125rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const CountUpNumber = ({ value, decimals = 0, suffix = "" }) => {
  const [current, setCurrent] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }
    let start = null;
    const duration = 2000;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const percentage = Math.min(progress / duration, 1);
      // easeOutQuart function: fast start, smooth and noticeable slow down
      const easePercentage = 1 - Math.pow(1 - percentage, 4);
      setCurrent(target * easePercentage);
      if (percentage < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    window.requestAnimationFrame(step);
  }, [target]);

  return <>{current.toFixed(decimals)}{suffix}</>;
};

/**
 * CarbonSummary — View B result overview card.
 */
export default function CarbonSummary({ result, onAnalyseOther, onViewDetail }) {
  const bottomRef = useRef(null);
  const totalKg = Number(result?.total_carbon_emission_kg) || 0;

  // 換算三個等效指標
  const carDistanceKm = totalKg * (1 / KG_CO2_PER_KM_CAR);
  const treesNeeded = totalKg / KG_CO2_PER_TREE_PER_YEAR;
  const phoneCharges = totalKg * PHONE_CHARGES_PER_KG_CO2;

  useEffect(() => {
    // 數字動畫長度為 2000ms，我們等動畫完成後稍微延遲 (2100ms) 再自動往下捲動
    const timer = setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 2100);
    return () => clearTimeout(timer);
  }, [result]);

  // NOTE: 等效卡片的 label 字級對齊「相當於」的 1.25rem / 700
  const equivalentLabelSize = "1.25rem";

  return (
    <div style={{ display: "grid", gap: "32px" }}>
      {/* Title */}
      <h1 style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 900, color: TEXT_DARK }}>
        <span style={{
          display: "inline-block",
          width: "1em",
          height: "1em",
          backgroundColor: TEXT_DARK,
          WebkitMaskImage: `url("${iconSvgStr}")`,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskImage: `url("${iconSvgStr}")`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }} />
        分析結果報告
      </h1>

      {/* Metric card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "48px" }}>
          {/* Left column — primary metrics */}
          <div style={{ display: "grid", gap: "32px" }}>
            <div>
              <p style={metricLabelStyle}>總碳排量</p>
              <p style={metricValueStyle}>
                <CountUpNumber value={result?.total_carbon_emission_kg} decimals={6} suffix=" kg" />
              </p>
            </div>
            <div>
              <p style={metricLabelStyle}>廚餘比例</p>
              <p style={metricValueStyle}>
                <CountUpNumber value={result?.waste_percentage} decimals={2} suffix=" %" />
              </p>
            </div>
            <div>
              <p style={metricLabelStyle}>整盤重量</p>
              <p style={metricValueStyle}>
                <CountUpNumber value={result?.total_weight_g} decimals={2} suffix=" g" />
              </p>
            </div>
          </div>

          {/* Middle column — matched / unmatched */}
          <div style={{ display: "grid", gap: "32px", alignContent: "start", paddingTop: "12px" }}>
            <div>
              <p style={metricSecondaryLabelStyle}>已對應項目</p>
              <p style={metricSmallValueStyle}>
                <CountUpNumber value={result?.matched_item_count} decimals={0} />
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>未對應項目</p>
              <p style={metricSmallValueStyle}>
                <CountUpNumber value={result?.unmatched_item_count} decimals={0} />
              </p>
            </div>
          </div>

          {/* Right column — area metrics */}
          <div style={{ display: "grid", gap: "32px", alignContent: "start", paddingTop: "12px" }}>
            <div>
              <p style={metricSecondaryLabelStyle}>Food Area</p>
              <p style={metricSecondaryValueStyle}>
                <CountUpNumber value={result?.food_area} decimals={2} />
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>Garbage Area</p>
              <p style={metricSecondaryValueStyle}>
                <CountUpNumber value={result?.garbage_area} decimals={2} />
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>Plate Area</p>
              <p style={metricSecondaryValueStyle}>
                <CountUpNumber value={result?.plate_area} decimals={2} />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 相當於 equivalent section ── */}
      <div>
        {/* Section header — 相當於 */}
        <p style={{ fontSize: "1.25rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "20px" }}>
          相當於
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>

          {/* Card 1 — 汽車行駛 */}
          <div style={{ background: GRAY_BG, borderRadius: "32px", padding: "36px 24px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center" }}>
            <Car size={56} strokeWidth={1.5} color={TEXT_DARK} />
            <p style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>
              汽車行駛
            </p>
            <p style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", lineHeight: 1.1 }}>
              <span style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", fontWeight: 900, ...auroraTextStyle }}>
                <CountUpNumber value={carDistanceKm} decimals={2} />
              </span>
              <span style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>km</span>
            </p>
          </div>

          {/* Card 2 — 樹木吸碳 */}
          <div style={{ background: GRAY_BG, borderRadius: "32px", padding: "36px 24px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center" }}>
            <TreeDeciduous size={56} strokeWidth={1.5} color={TEXT_DARK} />
            <p style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px", lineHeight: 1.1, flexWrap: "wrap" }}>
              <span style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", fontWeight: 900, ...auroraTextStyle }}>
                <CountUpNumber value={treesNeeded} decimals={2} />
              </span>
              <span style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>棵樹木</span>
            </p>
            <p style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>
              一年吸收的 CO₂
            </p>
          </div>

          {/* Card 3 — 手機充電 */}
          <div style={{ background: GRAY_BG, borderRadius: "32px", padding: "36px 24px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center" }}>
            <Smartphone size={56} strokeWidth={1.5} color={TEXT_DARK} />
            <p style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>
              手機充電
            </p>
            <p style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", lineHeight: 1.1 }}>
              <span style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", fontWeight: 900, ...auroraTextStyle }}>
                <CountUpNumber value={phoneCharges} decimals={0} />
              </span>
              <span style={{ fontSize: equivalentLabelSize, fontWeight: 700, color: TEXT_DARK }}>次</span>
            </p>
          </div>

        </div>
      </div>

      {/* Action buttons */}
      <div ref={bottomRef} style={{ display: "flex", justifyContent: "flex-end", gap: "32px", flexWrap: "wrap" }}>
        <Button id="btn-analyse-other" type="button" onClick={() => setTimeout(onAnalyseOther, 250)} style={actionButtonStyle}>
          <IconSearch /> 分析其它廚餘
        </Button>
        <Button id="btn-view-detail" type="button" onClick={() => { onViewDetail(); setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50); }} style={actionButtonStyle}>
          查看詳細分析結果 <IconArrowRight />
        </Button>
      </div>
    </div>
  );
}
