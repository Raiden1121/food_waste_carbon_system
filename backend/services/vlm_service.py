"""VLM (Vision Language Model) service for secondary food classification.

This service is called only when YOLO's confidence for a detected object
falls below the configured threshold. It crops the bounding box region
from the original image and sends it to either Gemini or OpenAI GPT
for a second-opinion classification.
"""

import base64
import io
import logging
import os

from PIL import Image

logger = logging.getLogger(__name__)

# NOTE: 可辨識的食物 YOLO 標籤清單，用於引導 VLM 從中選擇最接近的類別
FOOD_LABEL_LIST: list[str] = [
    "apple", "asparagus", "bacon", "baked potatoes", "banana", "beans",
    "black bean", "blueberries", "boiled egg", "bread", "breaded", "brocolis",
    "cabbage", "cabidela rice", "cake", "carrot", "cereals", "cheese",
    "chicken", "chicken steak", "chips", "chorizo", "coffee", "cucumber",
    "cutlet", "fish", "fish hake", "french fries", "fried cod", "fried egg",
    "gelatin", "grape", "greens", "grilled chop", "grilled steak", "ham",
    "lasagna", "lettuce", "lime", "mashed potatoes", "meatballs", "melon",
    "minced meat", "mushrooms", "mussel", "olives", "omelet", "onion",
    "pasta", "pineapple", "pizza", "pork", "pork belly", "pork intestines",
    "pork loin", "rice", "salmon", "scrambled eggs", "scrambled eggs with bacon",
    "soup", "spaghetti", "steak", "steaks with mushrooms", "stewed veal",
    "strawberry", "toasted bread", "tomato", "tuna", "tuna with mushrooms",
    "tuna with pasta", "turkey steak", "vegetables", "watermelon",
]

# NOTE: VLM 回傳此值代表「非食物，應排除」
UNKNOWN_LABEL = "unknown"

_VLM_PROMPT_TEMPLATE = """You are a food classification assistant.

The image is a cropped region from a cafeteria food tray.
YOLO detected this region as "{yolo_label}" but with low confidence (below 70%).

IMPORTANT: A single bounding box may contain MORE THAN ONE food item.
Please identify ALL food items visible in the image.

Try to match each item to one of the following known labels if possible:
{label_list}

For items that don't fit any known label, use a short 1-2 word English name (e.g. "dumplings", "tofu", "green pepper").
Only label something as "unknown" if it is completely NOT food (e.g. a napkin, plate rim, or garbage).

Reply with a COMMA-SEPARATED list of all food items you see (e.g. "steak, zucchini, mushroom").
Do NOT include explanations, quotes, or punctuation other than commas.
Do NOT include "unknown" in the list unless the entire region contains no food."""

_BATCH_VLM_PROMPT_TEMPLATE = """You are a food classification assistant.

I am providing you with {count} cropped images from a cafeteria food tray.
For each image, I have provided its sequence number and the original YOLO label (which had low confidence).

IMPORTANT: A single bounding box may contain MORE THAN ONE food item.
Please identify ALL food items visible in EACH image.

For each image, try to match items to the following known labels if possible:
{label_list}

For items not in the list, use short 1-2 word English names.
Only use "unknown" if the entire region contains no food.

You must respond in strictly valid JSON format, with a "results" key mapping to a list of strings.
Each string is a COMMA-SEPARATED list of all food items seen in that image (e.g. "steak, zucchini, mushroom").
The list must contain exactly {count} strings.

Example format:
{{
  "results": ["apple", "steak, zucchini, mushroom", "unknown", "rice, carrot"]
}}
"""


# NOTE: Visual Prompting (Method B) — full image with a red bounding box drawn on it.
# This provides global context so the VLM can leverage surrounding food items for inference.
_VISUAL_CONTEXT_PROMPT_TEMPLATE = """You are a food classification assistant for a Taiwanese cafeteria.

I have provided you with a food tray photo. A RED rectangle is drawn on the image to highlight a specific region.
YOLO initially detected the highlighted region as "{yolo_label}" but with LOW confidence.

Your task:
1. Look at the ENTIRE image to understand what meal this is.
2. Then focus on the RED-BOXED region and identify ALL food items inside it.

Try to match each item to one of the following known labels:
{label_list}

For items not in the list, use a short 1-2 word English name (e.g. "dumplings", "tofu").
Ignore the plate, bowl, fork, chopsticks or other non-food items.

Reply with a COMMA-SEPARATED list of food items in the red-boxed region (e.g. "steak, zucchini, mushroom").
Do NOT include explanations, quotes, or punctuation other than commas."""

# Fallback when YOLO detected NOTHING — VLM receives the raw full image.
_VISUAL_CONTEXT_NO_BOX_PROMPT = """You are a food classification assistant for a Taiwanese cafeteria.

The image shows a food tray. YOLO object detection completely failed to detect any items.

Please identify ALL food items visible in this image.
Try to match each item to one of the following known labels:
{label_list}

For items not in the list, use short 1-2 word English names.

Reply with a COMMA-SEPARATED list of all food items (e.g. "steak, zucchini, mushroom").
Do NOT include plates, cutlery, or other non-food items."""


def _pil_to_base64_jpeg(image: Image.Image) -> str:
    """Convert a PIL Image to a base64-encoded JPEG string."""
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class VLMService:
    """
    Wraps Gemini and OpenAI vision APIs for low-confidence object re-classification.

    Usage:
        service = VLMService(model="yolo_gemini")
        corrected = service.confirm_low_confidence_item(cropped_image, "bowl")
    """

    def __init__(self, model: str) -> None:
        """
        Args:
            model: One of "yolo_gemini" or "yolo_gpt".

        Raises:
            ValueError: If model is not a recognised VLM mode.
            EnvironmentError: If the required API key is not set.
        """
        if model not in ("yolo_gemini", "yolo_gpt"):
            raise ValueError(f"VLMService: unsupported model '{model}'")
        self.model = model
        self._validate_api_key()

    # ──────────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────────

    def confirm_low_confidence_item(
        self,
        cropped_image: Image.Image,
        yolo_label: str,
    ) -> str:
        """Send a cropped bounding-box image to the configured VLM for re-classification.

        Args:
            cropped_image: PIL Image of the YOLO bounding box region.
            yolo_label: The original YOLO label (used in the prompt as context).

        Returns:
            A comma-separated label string (may contain multiple items), or UNKNOWN_LABEL
            if the VLM determines the object is not food.
        """
        prompt = _VLM_PROMPT_TEMPLATE.format(
            yolo_label=yolo_label,
            label_list=", ".join(FOOD_LABEL_LIST),
        )
        image_b64 = _pil_to_base64_jpeg(cropped_image)

        if self.model == "yolo_gemini":
            return self._call_gemini(image_b64, prompt)
        return self._call_openai(image_b64, prompt)

    def confirm_with_visual_context(
        self,
        full_image: Image.Image,
        box: list[float] | None,
        yolo_label: str,
    ) -> str:
        """Re-classify a YOLO detection using Visual Prompting (Method B).

        Draws a red bounding box on the full image to highlight the region of
        interest, then sends the annotated full image to the VLM.  This gives
        the model surrounding context (other dishes on the tray) to make a more
        accurate inference about the highlighted item.

        When ``box`` is None (YOLO detected nothing), the raw full image is sent
        with a fallback prompt asking the VLM to enumerate all visible foods.

        Args:
            full_image: The original, un-cropped PIL Image of the entire food tray.
            box: YOLO bounding box [x1, y1, x2, y2] in pixel coordinates, or
                 None if YOLO produced no detections.
            yolo_label: The original YOLO label for context in the prompt.

        Returns:
            A comma-separated string of food items identified in the highlighted
            region (e.g. ``"steak, zucchini, mushroom"``), or UNKNOWN_LABEL.
        """
        if box is not None:
            # Draw a thick red rectangle on a copy of the full image
            annotated = self._draw_red_box(full_image, box)
            prompt = _VISUAL_CONTEXT_PROMPT_TEMPLATE.format(
                yolo_label=yolo_label,
                label_list=", ".join(FOOD_LABEL_LIST),
            )
        else:
            # YOLO detected nothing — send raw full image with a different prompt
            annotated = full_image.copy()
            prompt = _VISUAL_CONTEXT_NO_BOX_PROMPT.format(
                label_list=", ".join(FOOD_LABEL_LIST),
            )

        image_b64 = _pil_to_base64_jpeg(annotated)

        if self.model == "yolo_gemini":
            return self._call_gemini_visual(image_b64, prompt)
        return self._call_openai_visual(image_b64, prompt)

    def confirm_low_confidence_items_batch(
        self,
        items: list[tuple[Image.Image, str]],
    ) -> list[str]:
        """Send multiple cropped bounding-box images to the configured VLM for re-classification in a single request.

        Args:
            items: A list of tuples, each containing (cropped_image, yolo_label).

        Returns:
            A list of label strings corresponding to each input item.
        """
        if not items:
            return []
            
        if len(items) == 1:
            # Fallback to single if only 1 item to save context
            res = self.confirm_low_confidence_item(items[0][0], items[0][1])
            return [res]

        prompt = _BATCH_VLM_PROMPT_TEMPLATE.format(
            count=len(items),
            label_list=", ".join(FOOD_LABEL_LIST),
        )
        
        images_b64 = [_pil_to_base64_jpeg(img) for img, _ in items]
        labels = [lbl for _, lbl in items]

        if self.model == "yolo_gemini":
            return self._call_gemini_batch(images_b64, labels, prompt)
        return self._call_openai_batch(images_b64, labels, prompt)

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _draw_red_box(
        image: Image.Image,
        box: list[float],
        color: str = "red",
        line_width_ratio: float = 0.006,
    ) -> Image.Image:
        """Return a copy of *image* with a thick coloured rectangle drawn over *box*.

        The line width is computed as a fraction of the image diagonal so the
        annotation is visible at any resolution.

        Args:
            image: Source PIL Image (not mutated).
            box: Bounding box [x1, y1, x2, y2] in pixel coordinates.
            color: Rectangle stroke colour accepted by Pillow (default ``"red"``).
            line_width_ratio: Line thickness as a fraction of the image diagonal.

        Returns:
            A new PIL Image with the rectangle drawn.
        """
        from PIL import ImageDraw

        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)

        # Compute line width proportional to image size
        diagonal = (image.width ** 2 + image.height ** 2) ** 0.5
        lw = max(3, int(diagonal * line_width_ratio))

        x1, y1, x2, y2 = (int(v) for v in box)
        for offset in range(lw):
            draw.rectangle(
                [x1 - offset, y1 - offset, x2 + offset, y2 + offset],
                outline=color,
            )

        return annotated

    def _validate_api_key(self) -> None:
        """Raise EnvironmentError early if the required API key is absent."""
        if self.model == "yolo_gemini":
            key = os.environ.get("GEMINI_API_KEY", "").strip()
            if not key:
                raise EnvironmentError(
                    "GEMINI_API_KEY is not set. Please add it to your .env file."
                )
        else:
            key = os.environ.get("OPENAI_API_KEY", "").strip()
            if not key:
                raise EnvironmentError(
                    "OPENAI_API_KEY is not set. Please add it to your .env file."
                )

    def _call_gemini(self, image_b64: str, prompt: str) -> str:
        """Call Google Gemini Vision API and return the normalised label."""
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Build an inline image part from the base64 string
            image_part = {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_b64,
                }
            }
            response = model.generate_content([prompt, image_part])
            raw = response.text.strip().lower()
            return self._normalise_label(raw)

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("Gemini API call failed: %s", exc)
            return UNKNOWN_LABEL

    def _call_gemini_visual(self, image_b64: str, prompt: str) -> str:
        """Call Gemini Vision with the annotated full image (Visual Prompting).

        Unlike _call_gemini, this method does NOT normalise the output through
        _normalise_label, because the response may contain multiple comma-
        separated food items that should be evaluated individually by the caller.
        """
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel("gemini-2.5-flash")

            image_part = {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_b64,
                }
            }
            response = model.generate_content([prompt, image_part])
            # NOTE: Return raw text — multi-label normalisation happens in the
            # evaluation script via _label_is_correct_in_multilabel().
            return response.text.strip().lower()

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("Gemini Visual API call failed: %s", exc)
            return UNKNOWN_LABEL

    def _call_openai(self, image_b64: str, prompt: str) -> str:
        """Call OpenAI GPT-4o Vision API and return the normalised label."""
        try:
            from openai import OpenAI  # type: ignore

            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}",
                                    "detail": "low",
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                max_tokens=20,
            )
            raw = response.choices[0].message.content.strip().lower()
            return self._normalise_label(raw)

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("OpenAI API call failed: %s", exc)
            return UNKNOWN_LABEL

    def _call_openai_visual(self, image_b64: str, prompt: str) -> str:
        """Call GPT-4o Vision with the annotated full image (Visual Prompting).

        Unlike _call_openai, this method increases the image detail level to
        ``"high"`` so the model can clearly resolve the red bounding box annotation,
        and does NOT normalise the output (multi-label handled by caller).
        """
        try:
            from openai import OpenAI  # type: ignore

            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    # NOTE: Use 'high' detail so the red box annotation
                                    # is clearly visible and the model can resolve it.
                                    "url": f"data:image/jpeg;base64,{image_b64}",
                                    "detail": "high",
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                # NOTE: Longer max_tokens to accommodate comma-separated multi-label output
                max_tokens=80,
            )
            # NOTE: Return raw text — multi-label normalisation happens in the
            # evaluation script via _label_is_correct_in_multilabel().
            return response.choices[0].message.content.strip().lower()

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("OpenAI Visual API call failed: %s", exc)
            return UNKNOWN_LABEL

    def _call_gemini_batch(self, images_b64: list[str], labels: list[str], prompt: str) -> list[str]:
        """Call Google Gemini Vision API for multiple images."""
        import json
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel("gemini-2.5-flash")

            contents = [prompt]
            for idx, (img_b64, label) in enumerate(zip(images_b64, labels)):
                contents.append(f"Image {idx + 1} (YOLO detected as: {label}):")
                contents.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64,
                    }
                })

            response = model.generate_content(
                contents,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                )
            )
            
            raw_text = response.text.strip()
            data = json.loads(raw_text)
            results = data.get("results", [])
            
            # Ensure length matches
            while len(results) < len(images_b64):
                results.append(UNKNOWN_LABEL)
                
            return [self._normalise_label(res) for res in results[:len(images_b64)]]

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("Gemini batch API call failed: %s", exc)
            return [UNKNOWN_LABEL] * len(images_b64)

    def _call_openai_batch(self, images_b64: list[str], labels: list[str], prompt: str) -> list[str]:
        """Call OpenAI GPT-4o Vision API for multiple images."""
        import json
        try:
            from openai import OpenAI  # type: ignore

            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            
            content_list = [{"type": "text", "text": prompt}]
            for idx, (img_b64, label) in enumerate(zip(images_b64, labels)):
                content_list.append({"type": "text", "text": f"Image {idx + 1} (YOLO detected as: {label}):"})
                content_list.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{img_b64}",
                        "detail": "low",
                    },
                })
                
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": content_list,
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=200,
            )
            
            raw_text = response.choices[0].message.content.strip()
            data = json.loads(raw_text)
            results = data.get("results", [])
            
            # Ensure length matches
            while len(results) < len(images_b64):
                results.append(UNKNOWN_LABEL)
                
            return [self._normalise_label(res) for res in results[:len(images_b64)]]

        except EnvironmentError:
            raise
        except Exception as exc:
            logger.error("OpenAI batch API call failed: %s", exc)
            return [UNKNOWN_LABEL] * len(images_b64)

    @staticmethod
    def _normalise_label(raw: str) -> str:
        """Validate VLM output against the known label list.

        Returns the matched label from FOOD_LABEL_LIST, or UNKNOWN_LABEL if
        the response is not a known food item.
        """
        cleaned = raw.strip().lower().strip(".'\"")
        if cleaned == UNKNOWN_LABEL:
            return UNKNOWN_LABEL
            
        # 1. Exact match
        for label in FOOD_LABEL_LIST:
            if label.lower() == cleaned:
                return label
                
        # 2. Lenient match (e.g. 'tomato' in 'tomatoes', or 'grilled chicken' -> 'chicken')
        for label in FOOD_LABEL_LIST:
            if label.lower() in cleaned or cleaned in label.lower():
                return label
                
        # NOTE: Fallback — VLM returned a custom label not in the list.
        # Allow it to return the custom label so the evaluation script can map it.
        logger.warning("VLM returned unrecognised label: '%s', returning as-is", raw)
        return cleaned
