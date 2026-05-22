// Main application shell managing three views: form, summary, and detail.
// View transitions between summary and detail use a horizontal slide animation.

import { useRef, useState } from "react";
import UploadForm from "./components/UploadForm";
import CarbonSummary from "./components/CarbonSummary";
import ImagePreview from "./components/ImagePreview";
import ResultTable from "./components/ResultTable";
import { IconArrowLeft } from "./components/Icons";
import Button from "./components/Button";

// ─── Global keyframe injection ───────────────────────────────────────────────

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Noto Sans TC', 'Avenir Next', sans-serif;
    background: transparent;
    color: #111;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes analysisPulse {
    0%, 100% { opacity: 0.45; transform: scale(0.92); }
    50%       { opacity: 1;    transform: scale(1); }
  }

  @keyframes overlayFloat {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }

  /* Slide containers */
  .result-viewport {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .result-panel {
    width: 100%;
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  .result-panel--summary {
    position: relative;
  }

  .result-panel--detail {
    position: absolute;
    top: 0;
    left: 0;
  }

  /* Summary visible, detail hidden to the right */
  .slide-summary .result-panel--summary { transform: translateX(0); }
  .slide-summary .result-panel--detail  { transform: translateX(100%); }

  /* Detail visible, summary hidden to the left */
  .slide-detail .result-panel--summary { transform: translateX(-100%); }
  .slide-detail .result-panel--detail  { transform: translateX(0); }

  /* Ripple Effect */
  .ripple-effect {
    position: absolute;
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(0);
    animation: ripple-animation 0.6s ease-out forwards;
    background-color: rgba(0, 0, 0, 0.15);
    pointer-events: none;
    z-index: 0;
  }

  @keyframes ripple-animation {
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }

  /* Aurora Flow Animation */
  @keyframes aurora-flow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

// ─── Loading overlay ──────────────────────────────────────────────────────────

function LoadingOverlay() {
  const dotDelay = ["0s", "0.18s", "0.36s"];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22, 34, 26, 0.46)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: "24px",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          width: "min(400px, 100%)",
          background: "rgba(255,255,255,0.96)",
          borderRadius: "28px",
          padding: "36px 28px",
          boxShadow: "0 30px 80px rgba(25, 41, 30, 0.28)",
          display: "grid",
          gap: "20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            margin: "0 auto",
            borderRadius: "22px",
            display: "grid",
            placeItems: "center",
            animation: "overlayFloat 1.6s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }} aria-hidden="true">
            {dotDelay.map((delay, i) => (
              <span
                key={i}
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "999px",
                  background: "#6abf4b",
                  animation: "analysisPulse 1s ease-in-out infinite",
                  animationDelay: delay,
                  display: "block",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: "8px" }}>
          <strong style={{ fontSize: "1.25rem", color: "#111" }}>正在分析中</strong>
          <p style={{ color: "#555", lineHeight: 1.7, fontSize: "0.95rem" }}>
            系統正在辨識餐盤內容、估算重量，<br />並生成偵測結果圖片。
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

/**
 * Root application component.
 * Manages three views: 'form' (homepage + input), 'summary' (result overview),
 * 'detail' (images + table). Summary ↔ Detail use a horizontal slide animation.
 */
export default function App() {
  const [view, setView] = useState("form");
  // 'summary' | 'detail' — controls the CSS slide class
  const [slideState, setSlideState] = useState("summary");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // NOTE: track height of summary panel so the viewport can size correctly
  // when detail panel is positioned absolutely on top.
  const summaryRef = useRef(null);
  const detailRef = useRef(null);

  /** Called by UploadForm after a successful API response. */
  const handleSubmitResult = (data) => {
    setResult(data);
    setSlideState("summary");
    setView("result");
    // Scroll to top of result section
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Navigate from Summary → Detail with slide-left animation. */
  const goToDetail = () => {
    setSlideState("detail");
    // Sync viewport height to detail panel height after transition
    setTimeout(() => {
      if (detailRef.current && summaryRef.current) {
        summaryRef.current.style.minHeight = `${detailRef.current.scrollHeight}px`;
      }
    }, 460);
  };

  /** Navigate from Detail → Summary with slide-right animation. */
  const goToSummary = () => {
    setSlideState("summary");
    setTimeout(() => {
      if (summaryRef.current) {
        summaryRef.current.style.minHeight = "";
      }
    }, 460);
  };

  /** Reset everything and scroll back to the hero section. */
  const resetToHome = () => {
    // 1. 瞬間跳回頂端 (Hero Section 影片區塊)
    window.scrollTo(0, 0);
    
    setView("form");
    setResult(null);
    setError("");
    setSlideState("summary");

    // 2. 稍微停留 800ms 讓使用者看到影片後，順滑捲動到表單區塊
    setTimeout(() => {
      const formSection = document.getElementById("upload-form-section");
      if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 800);
  };

  return (
    <>
      <style>{globalStyles}</style>

      {/* ── VIEW A: Homepage + Form ────────────────────────────────────────── */}
      {view === "form" && (
        <main>
          {/* Hero section with video background */}
          <HeroSection />

          {/* Step 1/2/3 input form */}
          <section id="upload-form-section" style={{ background: "#fff" }}>
            <div
              style={{
                maxWidth: "1100px",
                margin: "0 auto",
                padding: "56px 24px 80px",
              }}
            >
              <UploadForm
                loading={loading}
                onSubmitResult={handleSubmitResult}
                onLoadingChange={setLoading}
                onErrorChange={setError}
                error={error}
              />
            </div>
          </section>
        </main>
      )}

      {/* ── VIEW B + C: Results (slide viewport) ──────────────────────────── */}
      {view === "result" && (
        <main style={{ padding: "56px 24px 80px", background: "#fff", minHeight: "100vh" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {/* Slide viewport */}
            <div className={`result-viewport slide-${slideState}`}>
              {/* Panel B — Summary */}
              <div className="result-panel result-panel--summary" ref={summaryRef}>
                <CarbonSummary
                  result={result}
                  onAnalyseOther={resetToHome}
                  onViewDetail={goToDetail}
                />
              </div>

              {/* Panel C — Detail */}
              <div className="result-panel result-panel--detail" ref={detailRef}>
                <DetailView result={result} onBack={goToSummary} />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Loading overlay */}
      {loading && <LoadingOverlay />}
    </>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        paddingBottom: "48px",
      }}
    >
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          zIndex: -2,
        }}
      >
        <source src="/src/assets/Homepage_video.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.55) 100%)",
          zIndex: -1,
        }}
      />

      {/* Text content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px",
          width: "100%",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontWeight: 700,
            letterSpacing: "0.08em",
            fontSize: "1.25rem",
            marginBottom: "12px",
            textTransform: "uppercase",
          }}
        >
          Food Waste Carbon System
        </p>
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(3rem, 6vw, 5rem)",
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: "24px",
          }}
        >
          廚餘碳排放估算系統
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.9)",
            maxWidth: "760px",
            lineHeight: 1.8,
            fontSize: "1.125rem",
          }}
        >
          上傳餐盤照片並輸入整盤廚餘重量，系統會使用 YOLOv11 辨識食物殘渣，<br />
          依據資料庫中的密度係數與碳排係數推估每項食物重量與碳排量。
          <br />
          如果某個辨識食物尚未建立碳排對應，系統會保留辨識與重量結果，但不會把它計入總碳排。
        </p>
      </div>
    </div>
  );
}

// ─── Detail View (Panel C) ────────────────────────────────────────────────────

/**
 * Panel C — shows detection images and the recognition result table.
 * @param {{ result: object, onBack: () => void }} props
 */
function DetailView({ result, onBack }) {
  return (
    <div style={{ display: "grid", gap: "28px" }}>
      {/* Back button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          id="btn-back-to-summary"
          onClick={() => setTimeout(onBack, 250)}
          style={{
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
          }}
        >
          <IconArrowLeft />
          返回前頁
        </Button>
      </div>

      {/* Detection images */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        <ImagePreview title="偵測結果" imageBase64={result?.image_base64} />
        <ImagePreview title="分群視圖" imageBase64={result?.clustering_image_base64} />
      </div>

      {/* Recognition table */}
      <ResultTable items={result?.objects ?? []} />
    </div>
  );
}
