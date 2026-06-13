"""
Experiment evaluation script for food waste detection.

Runs three model variants against the 30 test images:
  1. yolo_only      - Pure YOLO, no VLM correction
  2. yolo_gemini    - YOLO + Gemini 2.5 Flash as corrector
  3. yolo_gpt       - YOLO + GPT-4o as corrector

Usage (run from the project root):
    cd experiments
    pip install ultralytics google-generativeai openai pillow python-dotenv
    python run_evaluation.py
"""

import csv
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

# ── Setup ──────────────────────────────────────────────────────────────────────

# Load .env from project root (one level above experiments/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

# Allow importing from backend/
sys.path.insert(0, str(_PROJECT_ROOT / "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Paths ───────────────────────────────────────────────────────────────────────
_EXPERIMENTS_DIR = Path(__file__).resolve().parent
_TEST_IMAGES_DIR = _EXPERIMENTS_DIR / "test_images"
_GT_CSV = _EXPERIMENTS_DIR / "experiment_results.csv"
_YOLO_WEIGHTS = (
    _PROJECT_ROOT / "backend" / "server" / "yolo" / "weights" / "yolov11-x-weights-v6.pt"
)

# ── VLM confidence threshold (same as production code) ────────────────────────
VLM_CONFIDENCE_THRESHOLD = 0.70

# ── Ground truth → YOLO label mapping ─────────────────────────────────────────
# Maps Chinese ground truth labels to the English YOLO class names that are
# considered "correct" for that item.  Multiple synonyms may be listed.
LABEL_MAP: dict[str, list[str]] = {
    # 蛋白質類
    "雞胸肉": ["chicken", "chicken steak", "chicken breast", "poultry"],
    "雞骨頭": ["chicken", "bone", "chicken bone"],
    "豬骨頭": ["pork", "pork belly", "pork loin", "bone", "pork bone"],
    "魚": ["fish", "fish hake", "fried cod", "salmon", "tuna"],
    "魚骨頭": ["fish", "fish hake", "bone", "fish bone"],
    "鮮蝦": ["shrimp", "seafood", "prawn", "prawns"],
    "蛤蜊": ["mussel", "seafood", "clam", "clams"],
    "蟹管肉": ["seafood", "fish", "crab", "crab stick", "crab meat"],
    "沙丁魚": ["fish", "fish hake", "sardine", "sardines"],
    "牛排": ["steak", "grilled steak", "beef steak"],
    "牛肉": ["steak", "grilled steak", "minced meat", "beef", "beef slice", "beef slices"],
    "香腸": ["chorizo", "pork", "sausage", "hot dog"],
    "培根/肉類": ["bacon", "scrambled eggs with bacon", "pork", "meat"],
    "肉片": ["pork", "steak", "chicken", "minced meat", "meat", "meat slice", "pork slice", "beef slice"],
    # 蛋類
    "炒蛋": ["scrambled eggs", "fried egg", "omelet", "egg", "eggs"],
    "蒸蛋": ["scrambled eggs", "omelet", "steamed egg", "egg", "eggs"],
    "水煮蛋": ["boiled egg", "egg", "eggs"],
    "皮蛋": ["boiled egg", "unknown", "century egg", "preserved egg", "egg"],
    # 蔬菜類
    "花椰菜": ["brocolis", "broccoli", "cauliflower"],
    "蘆筍": ["asparagus", "vegetables", "greens"],
    "紅蘿蔔": ["carrot", "carrots"],
    "小黃瓜": ["cucumber", "cucumbers"],
    "生菜": ["lettuce", "greens", "vegetables", "salad"],
    "菠菜": ["greens", "vegetables", "lettuce", "spinach"],
    "龍鬚菜": ["vegetables", "greens", "chayote leaves", "chayote"],
    "韭菜": ["vegetables", "greens", "leek", "leeks", "chives"],
    "白菜": ["cabbage", "vegetables", "chinese cabbage", "napa cabbage", "bok choy"],
    "高麗菜葉": ["cabbage", "vegetables", "greens"],
    "小白菜": ["cabbage", "vegetables", "greens", "bok choy", "baby bok choy"],
    "青椒": ["vegetables", "greens", "green pepper", "bell pepper", "capsicum"],
    "糯米椒": ["vegetables", "greens", "green pepper", "shishito pepper", "shishito", "glutinous pepper"],
    "青辣椒": ["vegetables", "greens", "green chili", "green pepper", "chili", "chili pepper"],
    "紅辣椒": ["vegetables", "greens", "red chili", "red pepper", "chili", "chili pepper"],
    "辣椒": ["vegetables", "greens", "chili", "pepper", "peppers", "chili pepper"],
    "九層塔": ["vegetables", "greens", "basil", "thai basil"],
    "茄子": ["vegetables", "eggplant", "aubergine"],
    "洋蔥": ["onion", "onions"],
    "蔥": ["onion", "greens", "green onion", "scallion", "scallions", "spring onion"],
    "青蔥": ["onion", "greens", "green onion", "scallion", "scallions", "spring onion"],
    "蔥段": ["onion", "greens", "green onion", "scallion", "scallions", "spring onion"],
    "牛蕃茄": ["tomato", "tomatoes"],
    "小番茄": ["tomato", "tomatoes", "cherry tomato", "cherry tomatoes"],
    "玉米粒": ["vegetables", "corn", "sweet corn"],
    "酪梨": ["vegetables", "greens", "avocado"],
    "菜梗": ["vegetables", "greens", "stem"],
    "蒜頭": ["vegetables", "onion", "garlic", "clove", "garlic clove"],
    "金針菇": ["mushrooms", "enoki", "enoki mushroom", "mushroom"],
    "香菇": ["mushrooms", "shiitake", "shiitake mushroom", "mushroom"],
    "杏鮑菇": ["mushrooms", "steaks with mushrooms", "king oyster mushroom", "mushroom", "oyster mushroom"],
    "櫛瓜": ["vegetables", "zucchini", "courgette"],
    # 根莖類
    "馬鈴薯": ["mashed potatoes", "baked potatoes", "chips", "potato", "potatoes"],
    "烤馬鈴薯": ["baked potatoes", "chips", "mashed potatoes", "potato", "potatoes"],
    "地瓜": ["baked potatoes", "vegetables", "sweet potato", "sweet potatoes", "yam"],
    # 豆製品
    "豆腐": ["tofu", "vegetables", "bean curd"],
    "嫩豆腐": ["tofu", "vegetables", "soft tofu", "silken tofu"],
    "豆干": ["tofu", "dried tofu", "firm tofu"],
    # 穀物/麵食類
    "飯": ["rice", "cabidela rice", "white rice"],
    "剩飯": ["rice", "white rice"],
    "義大利麵": ["pasta", "spaghetti", "tuna with pasta"],
    "炒麵": ["pasta", "spaghetti", "fried noodles", "noodles", "chow mein"],
    "泡麵": ["pasta", "spaghetti", "soup", "instant noodles", "noodles", "ramen"],
    "米粉": ["pasta", "spaghetti", "rice", "rice noodles", "vermicelli", "noodles"],
    "年糕": ["pasta", "rice", "rice cake", "tteokbokki", "korean rice cake"],
    "水餃": ["pasta", "dumpling", "dumplings"],
    "麵包": ["bread", "toasted bread"],
    "吐司": ["bread", "toasted bread", "toast"],
    # 水果類
    "蘋果": ["apple", "apples"],
    "藍莓": ["blueberries", "blueberry"],
    "覆盆莓": ["strawberry", "raspberry", "berries", "raspberries"],
    "柳橙": ["melon", "lime", "orange", "citrus"],
    # 甜點
    "鬆餅": ["cake", "bread", "waffle", "waffles", "pancake", "pancakes"],
    "餅乾": ["cake", "bread", "cookie", "cookies", "biscuit", "lotus"],
    # 調味/醬料
    "胡麻醬": ["unknown", "sauce", "sesame dressing", "dressing", "sesame sauce"],
    "香草/香料": ["unknown", "herb", "herbs", "parsley", "spices"],
}


def _label_is_correct(ground_truth: str, predicted: str) -> bool:
    """Return True if the predicted label matches the ground truth.

    Matching is done by checking if the English predicted label appears
    in the synonym list for the given Chinese ground truth.
    """
    synonyms = LABEL_MAP.get(ground_truth, [])
    predicted_lower = predicted.strip().lower()
    return any(predicted_lower in syn.lower() or syn.lower() in predicted_lower for syn in synonyms)


def _label_is_correct_in_multilabel(ground_truth: str, vlm_output: str) -> bool:
    """Return True if the ground truth label is found in a comma-separated VLM output.

    The VLM may return multiple food items separated by commas (e.g. 'steak, zucchini, mushroom').
    This function checks whether ANY of those items matches the ground truth synonym list.

    Args:
        ground_truth: Chinese ground truth label (key in LABEL_MAP).
        vlm_output:   Raw VLM response string, possibly comma-separated.

    Returns:
        True if at least one item in the VLM list matches ground_truth.
    """
    # Split by comma, strip whitespace from each token
    tokens = [t.strip() for t in vlm_output.split(",") if t.strip()]
    return any(_label_is_correct(ground_truth, token) for token in tokens)


def _load_yolo():
    """Load and return the YOLO model instance."""
    from ultralytics import YOLO as _YOLO
    logger.info("Loading YOLO weights from %s", _YOLO_WEIGHTS)
    model = _YOLO(str(_YOLO_WEIGHTS))
    logger.info("YOLO loaded.")
    return model


def _run_yolo_on_image(yolo_model, image_path: Path) -> list[dict]:
    """Run YOLO on a single image and return list of detection dicts.

    Each dict has:
        label_name (str), confidence (float), box ([x1,y1,x2,y2])
    """
    import torch
    with torch.no_grad():
        results = yolo_model(str(image_path), conf=0.10)

    detections = []
    for result in results:
        names = result.names
        for box in result.boxes:
            detections.append({
                "label_name": names[int(box.cls.item())],
                "confidence": box.conf.item(),
                "box": box.xyxy[0].tolist(),
            })
    return detections


def _crop_box(image: Image.Image, box: list[float]) -> Image.Image:
    """Crop a PIL image to a bounding box [x1, y1, x2, y2]."""
    x1, y1, x2, y2 = (int(v) for v in box)
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(image.width, x2)
    y2 = min(image.height, y2)
    return image.crop((x1, y1, x2, y2))


def _best_detection_for_truth(
    detections: list[dict],
    ground_truth: str,
) -> dict | None:
    """Find the detection that best matches the ground truth label.

    Priority:
      1. Exact / synonym match with highest confidence.
      2. Any detection with highest confidence (YOLO may detect wrong class).

    Returns None if no detections exist.
    """
    if not detections:
        return None

    synonyms = LABEL_MAP.get(ground_truth, [])
    # Find matching detections
    matches = [
        d for d in detections
        if any(
            d["label_name"].lower() in s.lower() or s.lower() in d["label_name"].lower()
            for s in synonyms
        )
    ]
    if matches:
        return max(matches, key=lambda d: d["confidence"])

    # No match — return highest confidence detection (YOLO wrong class)
    return max(detections, key=lambda d: d["confidence"])


def run_experiment(mode: str, gt_rows: list[dict], yolo_model) -> list[dict]:
    """Run one mode ('yolo_only', 'yolo_gemini', 'yolo_gpt') and return result rows.

    Each result row includes all original GT fields plus:
        yolo_label, yolo_confidence, vlm_triggered, vlm_label,
        yolo_label_correct, vlm_label_correct
    """
    from services.vlm_service import VLMService

    vlm = None
    if mode in ("yolo_gemini", "yolo_gpt"):
        vlm = VLMService(model=mode)

    # Group by image filename
    from itertools import groupby

    results = []
    # Cache YOLO results per image to avoid re-running
    yolo_cache: dict[str, list[dict]] = {}

    for row in gt_rows:
        filename = row["image_filename"]
        if not filename:
            results.append({**row, "yolo_label": "", "yolo_confidence": "",
                            "vlm_triggered": "", "vlm_label": "",
                            "yolo_label_correct": "", "vlm_label_correct": ""})
            continue

        image_path = _TEST_IMAGES_DIR / filename
        if not image_path.exists():
            logger.warning("Image not found: %s", image_path)
            results.append({**row, "yolo_label": "FILE_NOT_FOUND",
                            "yolo_confidence": 0, "vlm_triggered": 0,
                            "vlm_label": "", "yolo_label_correct": 0,
                            "vlm_label_correct": 0})
            continue

        # Run YOLO (use cache)
        if filename not in yolo_cache:
            logger.info("[%s] Running YOLO on %s", mode, filename)
            yolo_cache[filename] = _run_yolo_on_image(yolo_model, image_path)
        detections = yolo_cache[filename]

        ground_truth = row["ground_truth_label"]

        # Find best matching detection for this ground truth item
        best = _best_detection_for_truth(detections, ground_truth)

        if best is None:
            # YOLO detected nothing at all
            yolo_label = "not_detected"
            yolo_conf = 0.0
        else:
            yolo_label = best["label_name"]
            yolo_conf = best["confidence"]

        yolo_correct = 1 if _label_is_correct(ground_truth, yolo_label) else 0

        # VLM correction
        vlm_triggered = 0
        vlm_label = ""
        vlm_correct = yolo_correct  # default: same as YOLO

        if mode != "yolo_only":
            should_trigger = (best is None) or (yolo_conf < VLM_CONFIDENCE_THRESHOLD)
            if should_trigger and vlm is not None:
                vlm_triggered = 1
                try:
                    pil_img = Image.open(image_path).convert("RGB")
                    box_coords = best["box"] if best is not None else None

                    # NOTE: Method B (Visual Prompting) — draw a red bounding box on
                    # the full image and send it to the VLM. This lets the model use
                    # surrounding dishes as context to improve accuracy.
                    vlm_raw = vlm.confirm_with_visual_context(
                        full_image=pil_img,
                        box=box_coords,
                        yolo_label=yolo_label,
                    )
                    vlm_label = vlm_raw

                    # NOTE: Fallback strategy — if VLM cannot identify the item
                    # (returns 'unknown'), keep YOLO's prediction as the final answer.
                    # This reflects real-world behavior: VLM is a corrector, not a replacer.
                    from services.vlm_service import UNKNOWN_LABEL
                    if vlm_raw.strip().lower() == UNKNOWN_LABEL:
                        vlm_correct = yolo_correct  # fallback to YOLO
                    else:
                        # NOTE: Multi-label check — VLM may return comma-separated items
                        # (e.g. 'steak, zucchini, mushroom'). Count as correct if the
                        # ground truth matches ANY item in the returned list.
                        vlm_correct = 1 if _label_is_correct_in_multilabel(ground_truth, vlm_label) else 0

                    logger.info(
                        "[%s] %s | GT=%s | YOLO=%s(%.2f) → VLM=[%s] | correct=%d",
                        mode, filename, ground_truth, yolo_label, yolo_conf, vlm_label, vlm_correct,
                    )
                except Exception as exc:
                    logger.error("VLM call failed for %s: %s", filename, exc)
                    vlm_label = "error"
                    vlm_correct = yolo_correct  # fallback to YOLO on error
            else:
                # High-confidence YOLO — no VLM needed
                vlm_label = yolo_label
                vlm_correct = yolo_correct

        result_row = {
            **row,
            "yolo_label": yolo_label,
            "yolo_confidence": f"{yolo_conf:.4f}",
            "vlm_triggered": vlm_triggered,
            "vlm_label": vlm_label,
            "yolo_label_correct": yolo_correct,
            "vlm_label_correct": vlm_correct if mode != "yolo_only" else "",
        }
        results.append(result_row)

    return results


def load_ground_truth() -> list[dict]:
    """Read ground truth CSV rows that have a filename (non-placeholder)."""
    rows = []
    with open(_GT_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["image_filename"] and row["ground_truth_label"]:
                rows.append(row)
    logger.info("Loaded %d ground truth items.", len(rows))
    return rows


def save_results(results: list[dict], mode: str) -> Path:
    """Write evaluation results to a CSV file."""
    out_path = _EXPERIMENTS_DIR / f"results_{mode}.csv"
    if not results:
        return out_path
    fieldnames = list(results[0].keys())
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    logger.info("Saved %d rows to %s", len(results), out_path)
    return out_path


def print_summary(results: list[dict], mode: str) -> None:
    """Print accuracy summary to console."""
    total = len(results)
    yolo_correct = sum(1 for r in results if str(r.get("yolo_label_correct")) == "1")
    vlm_correct = sum(1 for r in results if str(r.get("vlm_label_correct")) == "1")
    yolo_acc = yolo_correct / total * 100 if total else 0

    print(f"\n{'='*55}")
    print(f"  Mode: {mode}")
    print(f"  Total items : {total}")
    print(f"  YOLO correct: {yolo_correct:3d}  →  YOLO Accuracy = {yolo_acc:.1f}%")
    if mode != "yolo_only":
        vlm_acc = vlm_correct / total * 100 if total else 0
        triggered = sum(1 for r in results if str(r.get("vlm_triggered")) == "1")
        print(f"  VLM triggered: {triggered} items")
        print(f"  VLM correct : {vlm_correct:3d}  →  Final Accuracy = {vlm_acc:.1f}%")
    print(f"{'='*55}\n")


def main() -> None:
    """Entry point: run all three evaluation modes."""
    gt_rows = load_ground_truth()

    logger.info("Loading YOLO model (shared across all modes)...")
    yolo_model = _load_yolo()

    modes = ["yolo_only", "yolo_gemini", "yolo_gpt"]
    all_summaries = {}

    for mode in modes:
        logger.info("\n" + "="*60)
        logger.info("Starting mode: %s", mode)
        logger.info("="*60)
        try:
            results = run_experiment(mode, gt_rows, yolo_model)
            save_results(results, mode)
            print_summary(results, mode)
            all_summaries[mode] = results
        except Exception as exc:
            logger.error("Mode '%s' failed: %s", mode, exc, exc_info=True)

    # Final comparison table
    print("\n" + "="*55)
    print("  FINAL COMPARISON SUMMARY")
    print("="*55)
    for mode, results in all_summaries.items():
        total = len(results)
        if total == 0:
            continue
        yolo_acc = sum(1 for r in results if str(r.get("yolo_label_correct")) == "1") / total * 100
        if mode == "yolo_only":
            print(f"  {mode:<20} | YOLO Acc: {yolo_acc:.1f}%")
        else:
            final_correct = sum(1 for r in results if str(r.get("vlm_label_correct")) == "1")
            final_acc = final_correct / total * 100
            print(f"  {mode:<20} | YOLO Acc: {yolo_acc:.1f}%  Final Acc: {final_acc:.1f}%")
    print("="*55)


if __name__ == "__main__":
    main()
