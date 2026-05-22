// Frontend API client that submits multipart form data to the FastAPI detect endpoint.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// NOTE: Maps backend English error messages to user-friendly Traditional Chinese.
const ERROR_MESSAGE_MAP = {
  "No plate detected in the image":
    "未偵測到餐盤！請確保照片中有明顯的圓形餐盤，並重新上傳。",
  "total_weight_g must be greater than 0":
    "整盤廚餘重量必須大於 0，請重新輸入。",
  "Invalid image upload":
    "無法讀取此圖片，請確認檔案格式為 JPG 、PNG 等圖片格式。",
  "Error in object detection":
    "影像辨識發生錯誤，請稍後再試。",
};

export async function detectWaste(file, totalWeightG) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("total_weight_g", totalWeightG);

  const response = await fetch(`${API_BASE_URL}/api/detect`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  return payload;
}

function extractErrorMessage(payload) {
  if (!payload) {
    return "請求失敗，請稍後再試。";
  }

  let rawMessage = null;

  if (typeof payload.detail === "string" && payload.detail) {
    rawMessage = payload.detail;
  } else if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    const first = payload.detail[0];
    rawMessage = typeof first === "string" ? first : first?.msg ?? null;
  } else if (typeof payload.error === "string" && payload.error) {
    rawMessage = payload.error;
  }

  if (rawMessage) {
    // Return localized message if mapped, otherwise return raw message
    return ERROR_MESSAGE_MAP[rawMessage] ?? rawMessage;
  }

  return "分析失敗，請檢查圖片與輸入欄位。";
}
