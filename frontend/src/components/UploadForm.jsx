// Upload form component — Exact layout matching design 1.png to 4.png.

import { useEffect, useRef, useState } from "react";
import { detectWaste } from "../api/wasteApi";
import { IconUpload, IconCamera, IconTrash, IconArrowRight, IconRefresh } from "./Icons";
import Button from "./Button";

// ─── Design tokens ────────────────────────────────────────────────────────────

const GREEN = "#b3d85a"; // Bright green for active buttons / CTAs
const AURORA_GRADIENT = "linear-gradient(120deg, #b3d85a, #84cc16, #4ade80, #a3e635, #b3d85a)";
const GREEN_HOVER = "#c4e66d";
const GRAY_BG = "#e5e7eb"; // Very light gray for inactive buttons and backgrounds
const TEXT_DARK = "#111827"; // Dark black for typography
const TEXT_MUTED = "#6b7280";
const TEXT_ERROR = "#dc2626";

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionTitleStyle = {
  fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
  fontWeight: 900,
  color: TEXT_DARK,
  marginBottom: "4px",
  lineHeight: 1.1,
};

const sectionSubStyle = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: TEXT_DARK,
  marginBottom: "24px",
};

const pillButtonStyle = (active) => ({
  border: "none",
  borderRadius: "999px",
  padding: "16px 24px",
  background: active ? AURORA_GRADIENT : GRAY_BG,
  backgroundSize: active ? "300% 300%" : "auto",
  animation: active ? "aurora-flow 12s ease infinite" : "none",
  color: TEXT_DARK,
  fontWeight: 900,
  fontSize: "1.125rem",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.2s",
  textAlign: "center",
  width: "100%",
  maxWidth: "200px",
});

const imagePlaceholderStyle = (hasError) => ({
  width: "100%",
  aspectRatio: "16/10",
  background: GRAY_BG,
  borderRadius: "24px",
  border: hasError ? `3px solid ${TEXT_ERROR}` : "none",
  display: "grid",
  placeItems: "center",
  color: TEXT_MUTED,
  fontSize: "1.25rem",
  fontWeight: 700,
  overflow: "hidden",
  position: "relative",
});

const actionButtonStyle = (variant = "primary") => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    border: "none",
    borderRadius: "999px",
    padding: "12px 28px",
    fontWeight: 900,
    fontSize: "1.125rem",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.2s",
  };
  if (variant === "primary") {
    return {
      ...base,
      background: AURORA_GRADIENT,
      backgroundSize: "300% 300%",
      animation: "aurora-flow 12s ease infinite",
      color: TEXT_DARK,
    };
  }
  if (variant === "danger") {
    return { ...base, background: "#fee2e2", color: TEXT_ERROR };
  }
  return { ...base, background: GRAY_BG, color: TEXT_DARK };
};

const inputStyle = (hasError) => ({
  width: "100%",
  maxWidth: "200px",
  padding: "18px 24px",
  borderRadius: "999px",
  border: hasError ? `3px solid ${TEXT_ERROR}` : "none",
  fontSize: "1.125rem",
  fontWeight: 600,
  background: GRAY_BG,
  color: TEXT_DARK,
  fontFamily: "inherit",
  outline: "none",
});

const submitButtonStyle = (disabled) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  border: "none",
  borderRadius: "999px",
  padding: "28px 48px",
  background: disabled ? GRAY_BG : AURORA_GRADIENT,
  backgroundSize: disabled ? "auto" : "300% 300%",
  animation: disabled ? "none" : "aurora-flow 12s ease infinite",
  color: disabled ? TEXT_MUTED : TEXT_DARK,
  fontWeight: 900,
  fontSize: "1.5rem",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "inherit",
  transition: "background 0.2s",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadForm({
  loading,
  onSubmitResult,
  onLoadingChange,
  onErrorChange,
  error,
}) {
  const [file, setFile] = useState(null);
  const [fileTouched, setFileTouched] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const [weight, setWeight] = useState("");
  const [weightTouched, setWeightTouched] = useState(false);

  const [inputMode, setInputMode] = useState("upload");
  const [submitPhase, setSubmitPhase] = useState("idle");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraPhase, setCameraPhase] = useState("idle");
  const [showFlash, setShowFlash] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraActive || !video || !cameraStream) return;

    const attach = async () => {
      try {
        video.srcObject = cameraStream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        await video.play();
        await waitForVideoReady(video);
        setCameraReady(true);
        setCameraStarting(false);
        setCameraError("");
      } catch {
        setCameraError("相機已啟動，但預覽載入失敗，請重新開啟相機。");
      }
    };

    attach();
  }, [cameraActive, cameraStream]);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setFileTouched(true);
    setCameraError("");
    event.target.value = "";

    // NOTE: 選圖成功後，絲滑捲動到 Step 3 引導使用者繼續填寫重量
    if (chosen) {
      setTimeout(() => {
        const step3 = document.getElementById("weight");
        if (step3) {
          step3.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCameraActive(false);
    setCameraReady(false);
    setCameraStarting(false);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("目前瀏覽器不支援直接開啟相機。");
      return;
    }
    stopCamera();
    setCameraError("");
    setCameraStarting(true);
    setCameraActive(true);
    setCameraReady(false);
    setCameraPhase("live");

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 }
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 }
          }, 
          audio: false 
        });
      }
      setCameraStream(stream);
    } catch {
      stopCamera();
      setCameraPhase("idle");
      setCameraError("無法開啟相機，請確認已允許瀏覽器使用攝影機。");
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      setCameraError("相機畫面尚未準備完成，請稍候再拍照。");
      return;
    }

    // 觸發拍照閃光動畫
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
    }, 50);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("無法擷取相機畫面。");
      return;
    }

    // 套用影像增強濾鏡，改善筆電鏡頭黯淡與色彩不飽和的問題
    ctx.filter = "contrast(1.1) brightness(1.05) saturate(1.05)";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
    if (!blob) {
      setCameraError("拍照失敗，請再試一次。");
      return;
    }

    const capturedFile = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setFile(capturedFile);
    setFileTouched(true);
    stopCamera();
    setCameraPhase("captured");
  };

  const discardCapture = () => {
    setFile(null);
    setFileTouched(false);
    setCameraPhase("idle");
    setCameraError("");
  };

  const handleModeSwitch = (mode) => {
    setInputMode(mode);
    stopCamera();
    setCameraPhase("idle");
    // NOTE: 切換模式時清除已選取/拍攝的圖片，避免舊圖片殘留
    setFile(null);
    setFileTouched(false);
  };

  const handleVideoReady = () => {
    if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
      setCameraReady(true);
      setCameraStarting(false);
      setCameraError("");
    }
  };

  const handleSubmit = async () => {

    if (!file) {
      setFileTouched(true);
      onErrorChange("請先選擇或拍攝圖片。");
      return;
    }
    if (!weight || Number(weight) <= 0) {
      setWeightTouched(true);
      onErrorChange("請輸入大於 0 的整盤廚餘重量。");
      return;
    }

    if (submitPhase !== "idle") return;

    setSubmitPhase("step1");
    
    setTimeout(() => {
      setSubmitPhase("step2");
      
      setTimeout(async () => {
        onLoadingChange(true);
        onErrorChange("");
        onSubmitResult(null);

        try {
          const result = await detectWaste(file, weight);
          onSubmitResult(result);
        } catch (err) {
          onErrorChange(err.message || "分析失敗，請稍後再試。");
          setSubmitPhase("idle");
        } finally {
          onLoadingChange(false);
          setTimeout(() => setSubmitPhase("idle"), 500);
        }
      }, 400);
    }, 350);
  };

  const fileHasError = fileTouched && !file;
  const weightHasError = weightTouched && (!weight || Number(weight) <= 0);

  // Compute properties for Step 2 Action Button
  let step2BtnLabel = "從裝置選擇既有圖片";
  let step2BtnIcon = <IconUpload />;
  let step2BtnOnClick = () => {};
  let step2BtnDisabled = false;
  let step2BtnStyle = actionButtonStyle("primary");

  if (inputMode === "upload") {
    step2BtnLabel = file ? "重新選擇既有圖片" : "從裝置選擇既有圖片";
    step2BtnIcon = <IconUpload />;
    step2BtnOnClick = () => {
      document.getElementById("hidden-file-input")?.click();
    };
  } else {
    if (cameraPhase === "idle") {
      step2BtnLabel = cameraStarting ? "啟動相機中..." : "開啟相機";
      step2BtnIcon = <IconCamera />;
      step2BtnOnClick = startCamera;
    } else if (cameraPhase === "live") {
      step2BtnLabel = "拍照並使用";
      step2BtnIcon = <IconCamera />;
      step2BtnOnClick = capturePhoto;
      step2BtnDisabled = !cameraReady;
      step2BtnStyle = {
        ...step2BtnStyle,
        opacity: cameraReady ? 1 : 0.5,
        cursor: cameraReady ? "pointer" : "not-allowed",
      };
    } else if (cameraPhase === "captured") {
      step2BtnLabel = "重新拍照";
      step2BtnIcon = <IconCamera />;
      step2BtnOnClick = startCamera;
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "grid", gap: "64px" }} noValidate>
      
      {/* ── Step 1 + 2 Row ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2.5fr",
          gap: "48px",
          alignItems: "start",
        }}
      >
        {/* Step 1 (Narrow Column) */}
        <div>
          <p style={sectionTitleStyle}>Step1</p>
          <p style={sectionSubStyle}>請選擇輸入餐盤圖片的方式</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Button
              id="btn-mode-upload"
              type="button"
              style={pillButtonStyle(inputMode === "upload")}
              onClick={() => handleModeSwitch("upload")}
            >
              上傳照片
            </Button>
            <Button
              id="btn-mode-camera"
              type="button"
              style={pillButtonStyle(inputMode === "camera")}
              onClick={() => handleModeSwitch("camera")}
            >
              直接拍照
            </Button>
          </div>
        </div>

        {/* Step 2 (Wide Column) */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <p style={{ ...sectionTitleStyle, marginBottom: "4px" }}>Step2</p>
              <p style={{ ...sectionSubStyle, margin: 0 }}>輸入照片</p>
            </div>
            
            {/* Header Action Button */}
            <AnimatedActionButton
              id="btn-step2-action"
              type="button"
              style={step2BtnStyle}
              onClick={step2BtnOnClick}
              disabled={step2BtnDisabled}
              icon={step2BtnIcon}
              label={step2BtnLabel}
            />
            <input
              id="hidden-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Large Image Area */}
          <div style={imagePlaceholderStyle(fileHasError)}>
            {inputMode === "upload" && (
              <>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="餐盤預覽"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <span>尚未選擇圖片</span>
                )}
              </>
            )}

            {inputMode === "camera" && (
              <>
                {cameraPhase === "idle" && (
                  <span>尚未開啟相機</span>
                )}
                {cameraPhase === "live" && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedData={handleVideoReady}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
                  />
                )}
                {cameraPhase === "captured" && previewUrl && (
                  <img
                    src={previewUrl}
                    alt="拍照預覽"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </>
            )}

            {/* 拍照動畫 Flash */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "white",
                zIndex: 50,
                opacity: showFlash ? 1 : 0,
                pointerEvents: "none",
                transition: showFlash ? "none" : "opacity 0.6s ease-out",
              }}
            />
          </div>

          {cameraError && (
            <p style={{ color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>{cameraError}</p>
          )}
          {fileHasError && (
            <p style={{ color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>請先選擇或拍攝圖片。</p>
          )}
        </div>
      </div>

      {/* ── Step 3 Row ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2.5fr",
          gap: "48px",
          alignItems: "end",
        }}
      >
        <div style={{ position: "relative" }}>
          <p style={sectionTitleStyle}>Step3</p>
          <p style={sectionSubStyle}>輸入整盤廚餘重量（g）</p>
          <input
            id="weight"
            type="number"
            min="0"
            step="0.01"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setWeightTouched(true);
              if (e.target.value && Number(e.target.value) > 0) {
                onErrorChange("");
              }
            }}
            onBlur={() => setWeightTouched(true)}
            placeholder="例如 350"
            style={inputStyle(weightHasError)}
            aria-describedby={weightHasError ? "weight-error" : undefined}
          />
          {weightHasError && (
            <p id="weight-error" style={{ position: "absolute", color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>
              請輸入大於 0 的整盤廚餘重量。
            </p>
          )}
          {error && !weightHasError && !fileHasError && (
            <p style={{ position: "absolute", color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>{error}</p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            id="btn-submit"
            type="submit"
            disabled={loading || submitPhase !== "idle"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: "999px",
              height: "80px",
              width: submitPhase === "step2" ? "80px" : "230px",
              padding: "0",
              background: (loading && submitPhase === "idle") ? GRAY_BG : AURORA_GRADIENT,
              backgroundSize: (loading && submitPhase === "idle") ? "auto" : "300% 300%",
              animation: (loading && submitPhase === "idle") ? "none" : "aurora-flow 12s ease infinite",
              color: (loading && submitPhase === "idle") ? TEXT_MUTED : TEXT_DARK,
              fontWeight: 900,
              fontSize: "1.5rem",
              cursor: (loading || submitPhase !== "idle") ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                opacity: submitPhase === "idle" ? 1 : 0,
                width: submitPhase === "idle" ? "96px" : "0px",
                marginRight: submitPhase === "idle" ? "12px" : "0px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                transition: "all 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
                display: "inline-block",
                textAlign: "center",
              }}
            >
              開始分析
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: submitPhase === "idle" ? "scale(1) translateX(0)" :
                           submitPhase === "step1" ? "scale(1.5) translateX(-40px)" :
                           "scale(1.5) translateX(0)",
                transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            >
              <IconArrowRight />
            </span>
          </Button>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </form>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedActionButton({ id, type, style, onClick, disabled, icon, label }) {
  const [displayedIcon, setDisplayedIcon] = useState(icon);
  const [displayedLabel, setDisplayedLabel] = useState(label);
  const [phase, setPhase] = useState("idle"); 
  const prevLabelRef = useRef(label);
  const timeouts = useRef([]);
  
  useEffect(() => {
    if (label !== prevLabelRef.current) {
      prevLabelRef.current = label;
      
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      
      setPhase("shrinking");
      
      const t1 = setTimeout(() => {
        setPhase("spinning");
        
        const t2 = setTimeout(() => {
          setDisplayedIcon(icon);
          setDisplayedLabel(label);
          setPhase("expanding");
          
          const t3 = setTimeout(() => {
            setPhase("idle");
          }, 150);
          timeouts.current.push(t3);
        }, 250); 
        timeouts.current.push(t2);
      }, 150); 
      timeouts.current.push(t1);
    }
  }, [label, icon]);

  useEffect(() => {
    return () => timeouts.current.forEach(clearTimeout);
  }, []);

  const isCollapsed = phase === "shrinking" || phase === "spinning";

  return (
    <Button
      id={id}
      type={type}
      style={{
        ...style,
        maxWidth: isCollapsed ? "48px" : "300px",
        minWidth: isCollapsed ? "48px" : "0",
        padding: isCollapsed ? "12px" : "12px 28px",
        justifyContent: "center",
        transition: "max-width 0.15s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.15s cubic-bezier(0.4, 0, 0.2, 1), padding 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
      onClick={onClick}
      disabled={disabled || phase !== "idle"}
    >
      <div 
        style={{
          display: "flex", 
          alignItems: "center",
          justifyContent: "center",
          gap: isCollapsed ? "0px" : "10px",
          transform: phase === "spinning" ? "rotate(180deg)" : "rotate(0deg)",
          transition: phase === "spinning" ? "transform 0.25s ease-in-out" : "none",
        }}
      >
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", minHeight: "24px" }}>
          {phase === "shrinking" || phase === "spinning" ? (
            <IconRefresh />
          ) : (
            displayedIcon
          )}
        </div>
        <span style={{ 
          opacity: isCollapsed ? 0 : 1, 
          maxWidth: isCollapsed ? "0px" : "200px",
          overflow: "hidden",
          transition: "max-width 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s",
        }}>
          {displayedLabel}
        </span>
      </div>
    </Button>
  );
}



function waitForVideoReady(video) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onReady = () => {
      if (!(video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime > 0)) return;
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("playing", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("playing", onReady);
  });
}
