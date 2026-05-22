// Upload form component — Exact layout matching design 1.png to 4.png.

import { useEffect, useRef, useState } from "react";
import { detectWaste } from "../api/wasteApi";
import { IconUpload, IconCamera, IconTrash, IconArrowRight } from "./Icons";
import Button from "./Button";

// ─── Design tokens ────────────────────────────────────────────────────────────

const GREEN = "#b3d85a"; // Bright green for active buttons / CTAs
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
  background: active ? GREEN : GRAY_BG,
  color: TEXT_DARK,
  fontWeight: 900,
  fontSize: "1.125rem",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.2s",
  textAlign: "center",
  width: "100%",
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
    return { ...base, background: GREEN, color: TEXT_DARK };
  }
  if (variant === "danger") {
    return { ...base, background: "#fee2e2", color: TEXT_ERROR };
  }
  return { ...base, background: GRAY_BG, color: TEXT_DARK };
};

const inputStyle = (hasError) => ({
  width: "100%",
  maxWidth: "400px",
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
  padding: "20px 48px",
  background: disabled ? GRAY_BG : GREEN,
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

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraPhase, setCameraPhase] = useState("idle");

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
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("無法擷取相機畫面。");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
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
  };

  const handleVideoReady = () => {
    if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
      setCameraReady(true);
      setCameraStarting(false);
      setCameraError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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

    onLoadingChange(true);
    onErrorChange("");
    onSubmitResult(null);

    try {
      const result = await detectWaste(file, weight);
      onSubmitResult(result);
    } catch (err) {
      onErrorChange(err.message || "分析失敗，請稍後再試。");
    } finally {
      onLoadingChange(false);
    }
  };

  const fileHasError = fileTouched && !file;
  const weightHasError = weightTouched && (!weight || Number(weight) <= 0);

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "64px" }} noValidate>
      
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
          <p style={sectionSubStyle}>請選擇輸入餐盤圖片的方式。</p>
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
            {inputMode === "upload" ? (
              <UploadModeActionButton file={file} onChange={handleFileChange} />
            ) : (
              <CameraModeActionButtonFixed
                phase={cameraPhase}
                cameraStarting={cameraStarting}
                cameraReady={cameraReady}
                onStart={startCamera}
                onCapture={capturePhoto}
                onDiscard={discardCapture}
              />
            )}
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
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
            <p id="weight-error" style={{ color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>
              請輸入大於 0 的整盤廚餘重量。
            </p>
          )}
          {error && !weightHasError && !fileHasError && (
            <p style={{ color: TEXT_ERROR, fontSize: "1rem", marginTop: "12px", fontWeight: 700 }}>{error}</p>
          )}
        </div>

        <Button
          id="btn-submit"
          type="submit"
          disabled={loading}
          style={submitButtonStyle(loading)}
        >
          開始分析
          <IconArrowRight />
        </Button>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </form>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UploadModeActionButton({ file, onChange }) {
  const fileInputRef = useRef(null);
  const label = file ? "重新選擇既有圖片" : "從裝置選擇既有圖片";

  return (
    <>
      <Button
        id="btn-choose-file"
        type="button"
        style={actionButtonStyle("primary")}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload /> {label}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        style={{ display: "none" }}
      />
    </>
  );
}

function CameraModeActionButtonFixed({ phase, cameraStarting, cameraReady, onStart, onCapture, onDiscard }) {
  if (phase === "idle") {
    return (
      <Button id="btn-open-camera" type="button" style={actionButtonStyle("primary")} onClick={onStart}>
        <IconCamera /> {cameraStarting ? "啟動相機中..." : "開啟相機"}
      </Button>
    );
  }

  if (phase === "live") {
    return (
      <Button
        id="btn-capture"
        type="button"
        style={{
          ...actionButtonStyle("primary"),
          opacity: cameraReady ? 1 : 0.5,
          cursor: cameraReady ? "pointer" : "not-allowed",
        }}
        onClick={onCapture}
        disabled={!cameraReady}
      >
        <IconCamera /> 拍照並使用
      </Button>
    );
  }

  return (
    <div style={{ display: "flex", gap: "12px" }}>
      <Button id="btn-discard" type="button" style={actionButtonStyle("danger")} onClick={onDiscard}>
        <IconTrash /> 捨棄
      </Button>
      <Button id="btn-retake" type="button" style={actionButtonStyle("primary")} onClick={onStart}>
        <IconCamera /> 重新拍照
      </Button>
    </div>
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
