# 實驗評估資料夾 (Experiment Evaluation)

本資料夾用於存放「YOLO vs. YOLO+VLM 協同辨識標籤準確率比較實驗」的所有相關資料。

## 實驗目的

比較「純 YOLO」與「YOLO + VLM 協同架構」在食物標籤辨識上的準確率差異。

VLM 的角色是：對 YOLO **信心度低於 0.70** 的物件進行二次視覺確認，將 YOLO 給出的錯誤標籤更正為正確的食物名稱。

## 資料夾結構

```
experiments/
├── test_images/              # 30 張測試用廚餘照片（必須含圓形餐盤）
├── experiment_results.csv    # 主記錄表：以「物件」為單位記錄辨識結果
├── label_categories.csv      # 廚餘類別定義對照表
└── README.md                 # 本說明文件
```

## 欄位說明 — `experiment_results.csv`

> ⚠️ 評估單位為**物件 (item)**，而非圖片。一張圖若有 3 個食物物件，則對應 3 列資料。

| 欄位 | 說明 | 合法值 |
|---|---|---|
| `image_id` | 所屬圖片編號 | `img_001` ~ `img_030` |
| `item_id` | 物件唯一編號（同圖多物件時遞增）| `img_001_item_01` |
| `image_filename` | 實際檔案名稱（含副檔名）| e.g. `chicken_rice_easy_001.jpg` |
| `scene_difficulty` | 拍攝場景難度 | `easy` / `hard` |
| `ground_truth_label` | 此物件的人工標記正確類別 | e.g. `豬排` |
| `yolo_label` | YOLO 給出的預測標籤 | e.g. `牛排` |
| `yolo_confidence` | YOLO 的信心度分數 | `0.00` ~ `1.00` |
| `vlm_triggered` | 是否觸發了 VLM 二次確認（信心度 < 0.70）| `1` / `0` |
| `vlm_label` | VLM 修正後的最終標籤（未觸發則與 yolo_label 相同）| e.g. `豬排` |
| `yolo_label_correct` | YOLO 標籤是否正確 | `1` (正確) / `0` (錯誤) |
| `vlm_label_correct` | VLM 最終標籤是否正確 | `1` (正確) / `0` (錯誤) |
| `notes` | 備註（光線、遮擋、特殊情況等）| 自由填寫 |

## 照片規範

**所有測試照片必須包含清楚可見的圓形餐盤**，因為系統以餐盤面積為基準推算廚餘比例。

照片命名規則：
```
{主要食物類別_英文}_{場景難度}_{編號}.jpg
```
例如：
- `chicken_rice_easy_001.jpg`
- `mixed_vegetables_hard_003.jpg`

### 建議的 30 張照片分布

| 類型 | 數量 | 場景特性 |
|---|---|---|
| 簡單場景 | 10 張 | 單一食物、光線充足、俯拍清晰 |
| 中等場景 | 10 張 | 2-3 種食物混合、有醬料 |
| 困難場景 | 10 張 | 光線昏暗、食物遮擋、外型相似易混淆 |

## 核心評估指標

本實驗以**物件標籤準確率 (Per-Item Label Accuracy)** 為主要指標：

```
物件標籤準確率 = 標籤正確的物件數 / 被偵測到的總物件數
```

輔助指標：
- **VLM 修正成功率**：`vlm_triggered=1` 的物件中，`vlm_label_correct=1` 的比例
- **YOLO vs VLM 差異**：對 `vlm_triggered=1` 的物件子集，分別計算 YOLO 與 VLM 的準確率

## 統計檢定

- **McNemar's Test**：比較「YOLO 錯但 VLM 對」vs「YOLO 對但 VLM 錯」的數量是否有顯著差異
- 若 **p < 0.05**，代表 VLM 的標籤修正具有統計顯著性
