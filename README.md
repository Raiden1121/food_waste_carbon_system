<!-- Project overview, data flow, and startup guide for the food waste carbon system. -->

# food-waste-carbon-system

`food-waste-carbon-system` 是一個廚餘碳排放估算系統。它結合 React 前端、FastAPI 後端、YOLOv11 segmentation、雲端 VLM（Gemini / GPT-4o）二次確認，以及 PostgreSQL，讓使用者可以上傳餐盤廚餘圖片，輸入整盤重量，並取得每項食物的推估重量與碳排放量。

## 系統目標

- 使用 YOLOv11 segmentation 辨識餐盤中的食物廚餘（邊緣端推論）
- 對低信心物件，透過 Google Gemini 或 OpenAI GPT-4o 進行二次視覺確認（雲端 VLM）
- 根據物件面積與 `density_factor` 推估各食物重量
- 根據 `carbon_factor` 計算各項食物碳排放量
- 儲存分析紀錄到 PostgreSQL
- 在 React 前端顯示辨識結果、重量、總碳排，以及 VLM 的修正明細

## 使用說明

1. **Step 1**：選擇輸入方式（上傳照片 或 直接拍照）
2. **Step 2**：上傳或拍攝一張包含**圓形餐盤**的廚餘照片
3. **Step 3**：輸入整盤廚餘重量（公克），按下「開始分析」

> **⚠️ 使用限制**：上傳的照片中**必須包含明顯的圓形餐盤**，系統才能以餐盤面積為基準推算各項食物的相對重量。若照片中無餐盤，系統會顯示錯誤提示。

若某項被辨識的食物尚無對應碳排資料（`has_carbon_data = false`），系統會保留其辨識與重量結果，但不納入總碳排計算。

## 專案結構

```text
food-waste-carbon-system/
├── frontend/                   # React + Vite 前端
├── backend/                    # FastAPI + YOLOv11 + SQLAlchemy 後端
├── database/                   # PostgreSQL 初始化 SQL
├── docs/                       # 系統設計與開發說明
├── experiments/                # 實驗評估資料（YOLO vs YOLO+VLM 準確率比較）
│   ├── test_images/            # 30 張測試用廚餘照片（含圓形餐盤）
│   ├── experiment_results.csv  # 以物件為單位的辨識結果記錄表
│   ├── label_categories.csv    # 廚餘類別定義對照表
│   └── README.md               # 實驗說明文件
├── docker-compose.yml          # 服務編排
├── .env                        # 環境變數
├── .gitignore                  # Git 忽略規則
└── README.md                   # 專案說明
```

## 系統流程

```text
使用者
↓
React 上傳圖片 + total_weight_g + model
↓
FastAPI /detect
↓
PIL 讀取圖片
↓
YOLOv11 segmentation（邊緣端，conf=0.10）
↓
取得 detected_objects
    ├── label_name
    ├── confidence
    ├── mask area
    └── box
↓
[若 model=yolo_gemini 或 yolo_gpt]
低信心物件（confidence < 0.70）→ 批次裁切圖片 → VLM 單次批次確認（節省 API 額度）
    ├── VLM 回傳已知食物標籤 → 更新 label_name，記錄 vlm_corrected=True
    └── VLM 回傳 UNKNOWN 或 API 失敗 → 標記 vlm_ignored=True（丟棄物件）
↓
過濾非食物類別 / vlm_ignored 物件
↓
查詢 food_carbon_factors
↓
area × density_factor
↓
分配總重量
↓
estimated_weight_g / 1000 × carbon_factor
↓
加總 total_carbon_emission_kg
↓
回傳 JSON（含 vlm_corrected / original_yolo_label）
↓
React 顯示結果（含 VLM 修正欄位）
```

## 偵測與碳排計算邏輯

`backend/routes/detect.py` 會接收圖片與 `total_weight_g`，再呼叫 `backend/server/yolo/yolo.py` 執行 YOLOv11 segmentation。

YOLO 回傳的每個物件至少包含：

- `label_name`
- `confidence`
- `area`
- `box`

後端會先過濾垃圾類別、餐盤與忽略類別，再針對可食物件查詢 `food_carbon_factors`。每個物件會依據 `area × density_factor` 計算相對權重比例，最後把 `total_weight_g` 分配到各個食物項目，得到 `estimated_weight_g`。

碳排計算公式如下：

```text
carbon_emission_kg = estimated_weight_g / 1000 × carbon_factor
```

所有項目的 `carbon_emission_kg` 加總後，得到 `total_carbon_emission_kg`。

## API

### `POST /api/detect`

使用 `multipart/form-data` 傳送：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `file` | File | ✅ | 廚餘圖片檔案 |
| `total_weight_g` | float | ✅ | 整盤廚餘重量（公克） |
| `model` | string | 選填 | 辨識模式：`yolo`（預設）、`yolo_gemini`、`yolo_gpt` |
| `user_id` | int | 選填 | 使用者 ID |

主要回傳欄位：

- `objects`
- `image_base64`
- `clustering_image_base64`
- `waste_percentage`
- `food_area` / `garbage_area` / `plate_area`
- `total_weight_g`
- `total_carbon_emission_kg`
- `matched_item_count` / `unmatched_item_count`

每個 `object` 包含：

| 欄位 | 說明 |
|------|------|
| `label_name` | 最終食物標籤（VLM 修正後的結果） |
| `estimated_weight_g` | 推估重量 |
| `carbon_factor` | 碳排係數 |
| `carbon_emission_kg` | 碳排量 |
| `has_carbon_data` | 是否有對應碳排資料 |
| `factor_source` | 碳排係數來源 |
| `vlm_corrected` | `true` 代表此物件的標籤有被 VLM 修正過 |
| `original_yolo_label` | VLM 修正前 YOLO 的原始標籤（僅在 `vlm_corrected=true` 時出現）|

如果 `has_carbon_data = false`，代表該食物有被辨識到，但目前沒有對應碳排資料，因此不會被計入 `total_carbon_emission_kg`。

### 其他 API

- `GET /` 健康檢查
- `GET /api/users` 查詢使用者
- `POST /api/users` 建立使用者
- `GET /api/records` 查詢分析紀錄
- `GET /api/records/{record_id}` 查詢單筆分析紀錄

## 資料表

系統使用以下資料表：

- `users`
- `food_carbon_factors`
- `analysis_records`
- `analysis_items`

`food_carbon_factors` 用來提供：

- `yolo_label`
- `food_name_zh`
- `category`
- `carbon_factor`
- `density_factor`
- `source`

## 環境變數設定

複製 `.env.example` 並重新命名為 `.env`，填入必要的設定：

```bash
cp .env.example .env
```

| 變數 | 必填 | 說明 |
|------|------|------|
| `POSTGRES_DB` | ✅ | PostgreSQL 資料庫名稱 |
| `POSTGRES_USER` | ✅ | PostgreSQL 使用者 |
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL 密碼 |
| `DATABASE_URL` | ✅ | SQLAlchemy 連線字串 |
| `GEMINI_API_KEY` | 選填 | 使用 YOLO + Gemini 模式才需要填入。[申請網址](https://aistudio.google.com/app/apikey)，最低儲值 NT$400 |
| `OPENAI_API_KEY` | 選填 | 使用 YOLO + GPT-4o 模式才需要填入。[申請網址](https://platform.openai.com/api-keys)，最低儲值 $5 USD |

> ⚠️ `.env` 已被 `.gitignore` 排除，**請勿 commit 到 Git**，以防 API Key 外洩被盜刷。

## 啟動方式

第一次啟動，或你有修改 `database/init.sql` 想重新匯入資料庫 seed 時，請在專案根目錄執行：

```bash
docker compose down -v
docker compose up --build -d
```

開發時要啟動整個系統：

```bash
docker compose up --build -d
```

一般重啟服務：

```bash
docker compose down
docker compose up --build -d
```

只重建後端：

```bash
docker compose up --build -d backend
```

如果你暫時不開發，想把本機 port 釋放掉，請停止容器：

```bash
docker compose down
```

這會關掉：

- `frontend` 的 `5173`
- `backend` 的 `8000`
- `postgres` 相關容器

如果你只想暫停容器但保留 compose 狀態，也可以：

```bash
docker compose stop
```

之後重新開啟：

```bash
docker compose start
```

差異如下：

- `docker compose down`
  - 停掉並移除容器與 network
  - 會釋放本機 port
- `docker compose stop`
  - 只停止容器
  - 仍然會釋放本機 port
  - 之後可用 `docker compose start` 快速恢復
- `docker compose down -v`
  - 連資料庫 volume 一起清掉
  - 會重新初始化 PostgreSQL 與 `init.sql`

啟動後可使用：

- React 前端：`http://localhost:5173`
- FastAPI Swagger 文件：`http://localhost:8000/docs`

如果你要啟用 pgAdmin：

```bash
docker compose --profile tools up -d pgadmin
```

pgAdmin 預設位置：

- `http://localhost:5050`

## 開發備註

- YOLO 權重檔應放在 `backend/server/yolo/weights/yolov11-x-weights-v6.pt`
- 權重檔不納入 Git 版本控制，請從官方 release 下載：
  - `https://github.com/joaopferreira19/Food-Waste-Detection-using-YOLOv11/releases/tag/0.3.0`
- 下載後請將 `yolov11-x-weights-v6.pt` 放到：
  - `backend/server/yolo/weights/`
- YOLO 載入邏輯位於 `backend/server/yolo/yolo.py`
- VLM 二次確認邏輯位於 `backend/services/vlm_service.py`
- 碳排計算邏輯位於 `backend/services/carbon_calculator.py`
- 因子查詢邏輯位於 `backend/services/food_factor_service.py`
- PostgreSQL 初始化檔位於 `database/init.sql`
- VLM 信心度觸發門檻（`VLM_CONFIDENCE_THRESHOLD`）定義於 `backend/routes/detect.py`，目前設定為 `0.70`
- VLM 二次確認採**批次（Batch）請求**策略：同一張圖片中所有低信心度物件的截圖會打包成**單一 API 請求**傳送，Gemini 與 GPT-4o 均以 JSON 格式一次回傳所有結果，有效節省 Free Tier 的 RPM（Requests Per Minute）配額

## 權重檔準備

如果你是第一次設定專案，請先建立權重目錄並放入模型檔：

```bash
mkdir -p backend/server/yolo/weights
```

接著從以下 release 下載 `yolov11-x-weights-v6.pt`：

- `https://github.com/joaopferreira19/Food-Waste-Detection-using-YOLOv11/releases/tag/0.3.0`

放入後的最終路徑應為：

```text
backend/server/yolo/weights/yolov11-x-weights-v6.pt
```

## 重新建置提醒

調整 Docker、依賴、資料庫初始化或後端模型後，請重新執行：

```bash
docker compose down
docker compose up --build -d
```

如果變更的是 `database/init.sql`，請改用：

```bash
docker compose down -v
docker compose up --build -d
```
