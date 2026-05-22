// Summary card for View B — Exact layout matching design 5.png.

import React from "react";
import { IconSearch, IconArrowRight } from "./Icons";
import Button from "./Button";

const GREEN = "#b3d85a"; // Matching the bright green
const TEXT_DARK = "#111827";
const GRAY_BG = "#f3f4f6";

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
  color: GREEN,
  lineHeight: 1.1,
};

const metricSmallValueStyle = {
  fontSize: "2rem",
  fontWeight: 900,
  color: GREEN,
  lineHeight: 1.1,
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
  padding: "12px 28px",
  fontWeight: 900,
  fontSize: "1.125rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

/**
 * CarbonSummary — View B result overview card.
 */
export default function CarbonSummary({ result, onAnalyseOther, onViewDetail }) {
  return (
    <div style={{ display: "grid", gap: "32px" }}>
      {/* Title */}
      <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 900, color: TEXT_DARK }}>
        分析結果報告
      </h1>

      {/* Metric card */}
      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr",
            gap: "48px",
          }}
        >
          {/* Left column — primary metrics */}
          <div style={{ display: "grid", gap: "32px" }}>
            <div>
              <p style={metricLabelStyle}>總碳排量</p>
              <p style={metricValueStyle}>
                {Number(result?.total_carbon_emission_kg ?? 0).toFixed(6)} kg
              </p>
            </div>
            <div>
              <p style={metricLabelStyle}>廚餘比例</p>
              <p style={metricValueStyle}>
                {Number(result?.waste_percentage ?? 0).toFixed(2)} %
              </p>
            </div>
            <div>
              <p style={metricLabelStyle}>整盤重量</p>
              <p style={metricValueStyle}>
                {Number(result?.total_weight_g ?? 0).toFixed(2)} g
              </p>
            </div>
          </div>

          {/* Middle column — matched / unmatched */}
          <div style={{ display: "grid", gap: "32px", alignContent: "start", paddingTop: "12px" }}>
            <div>
              <p style={metricSecondaryLabelStyle}>已對應項目</p>
              <p style={metricSmallValueStyle}>
                {Number(result?.matched_item_count ?? 0)}
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>未對應項目</p>
              <p style={metricSmallValueStyle}>
                {Number(result?.unmatched_item_count ?? 0)}
              </p>
            </div>
          </div>

          {/* Right column — area metrics */}
          <div style={{ display: "grid", gap: "32px", alignContent: "start", paddingTop: "12px" }}>
            <div>
              <p style={metricSecondaryLabelStyle}>Food Area</p>
              <p style={metricSecondaryValueStyle}>
                {Number(result?.food_area ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>Garbage Area</p>
              <p style={metricSecondaryValueStyle}>
                {Number(result?.garbage_area ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p style={metricSecondaryLabelStyle}>Plate Area</p>
              <p style={metricSecondaryValueStyle}>
                {Number(result?.plate_area ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", flexWrap: "wrap", marginTop: "16px" }}>
        <Button id="btn-analyse-other" type="button" onClick={() => setTimeout(onAnalyseOther, 250)} style={actionButtonStyle}>
          <IconSearch /> 分析其它廚餘
        </Button>
        <Button id="btn-view-detail" type="button" onClick={() => setTimeout(onViewDetail, 250)} style={actionButtonStyle}>
          查看詳細分析結果 <IconArrowRight />
        </Button>
      </div>
    </div>
  );
}
