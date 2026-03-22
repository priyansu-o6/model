import torch
import numpy as np
import cv2
from PIL import Image
from transformers import pipeline


class AIImageDetector:
    def __init__(self):
        self.detector = None
        self.loaded = False
        self._load_model()

    def _load_model(self):
        try:
            self.detector = pipeline(
                "image-classification",
                model="Organika/sdxl-detector",
                device=-1  # CPU
            )
            self.loaded = True
            print("AI Image Detector loaded successfully")
        except Exception as e:
            print(f"AI Image Detector load error: {e}")

    def predict_frame(self, frame: np.ndarray) -> dict:
        if not self.loaded or frame is None:
            return {"score": 0.5, "is_ai_generated": False, "loaded": False}
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb)
            results = self.detector(pil_image)
            ai_score = 0.5
            for r in results:
                label = r["label"].lower()
                if "ai" in label or "fake" in label or "sdxl" in label or "generated" in label:
                    ai_score = float(r["score"])
                    break
                elif "real" in label or "human" in label or "photo" in label:
                    ai_score = 1.0 - float(r["score"])
                    break
            return {
                "score": float(ai_score),
                "is_ai_generated": ai_score > 0.5,
                "loaded": True,
                "raw": results
            }
        except Exception as e:
            print(f"AI Image Detector inference error: {e}")
            return {"score": 0.5, "is_ai_generated": False, "loaded": False}
