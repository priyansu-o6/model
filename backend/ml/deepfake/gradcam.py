import torch
import torch.nn.functional as F
import numpy as np
import cv2
from typing import Optional


class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate(self, input_tensor: torch.Tensor) -> np.ndarray:
        self.model.eval()
        input_tensor.requires_grad_(True)

        output = self.model(input_tensor)
        self.model.zero_grad()
        output.backward()

        gradients = self.gradients
        activations = self.activations

        weights = gradients.mean(dim=[2, 3], keepdim=True)
        cam = (weights * activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()

        if cam.max() > cam.min():
            cam = (cam - cam.min()) / (cam.max() - cam.min())

        return cam

    def overlay_on_image(
        self, 
        frame: np.ndarray, 
        cam: np.ndarray, 
        alpha: float = 0.4
    ) -> np.ndarray:
        cam_resized = cv2.resize(cam, (frame.shape[1], frame.shape[0]))
        heatmap = cv2.applyColorMap(
            np.uint8(255 * cam_resized), cv2.COLORMAP_JET
        )
        heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        overlay = cv2.addWeighted(frame, 1 - alpha, heatmap, alpha, 0)
        return overlay, cam_resized


class MesoNetGradCAM:
    def __init__(self, mesonet_detector):
        self.detector = mesonet_detector
        self.gradcam = GradCAM(
            model=mesonet_detector.model,
            target_layer=mesonet_detector.model.conv4
        )

    def analyze(self, frame: np.ndarray) -> dict:
        if frame is None or not isinstance(frame, np.ndarray):
            return {"cam": None, "overlay": None, "suspicious_regions": []}

        try:
            tensor = self.detector.preprocess(frame)
            cam = self.gradcam.generate(tensor)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            resized = cv2.resize(rgb_frame, (256, 256))
            overlay, cam_resized = self.gradcam.overlay_on_image(resized, cam)
            suspicious_regions = self._get_suspicious_regions(cam_resized)

            return {
                "cam": cam_resized,
                "overlay": overlay,
                "suspicious_regions": suspicious_regions,
                "has_manipulation": cam_resized.max() > 0.6
            }
        except Exception as e:
            print(f"GradCAM error: {e}")
            return {"cam": None, "overlay": None, "suspicious_regions": []}

    def _get_suspicious_regions(self, cam: np.ndarray) -> list:
        regions = []
        region_names = {
            "forehead": cam[0:85, 64:192],
            "eyes": cam[60:120, 32:224],
            "nose": cam[100:160, 80:176],
            "mouth": cam[150:210, 64:192],
            "jawline": cam[190:256, 32:224],
            "left_cheek": cam[100:190, 0:100],
            "right_cheek": cam[100:190, 156:256],
        }
        for name, region in region_names.items():
            score = float(region.mean())
            if score > 0.3:
                regions.append({
                    "region": name.replace("_", " ").title(),
                    "confidence": round(score * 100, 1),
                    "description": f"Manipulation detected in {name.replace('_', ' ')} region"
                })
        regions.sort(key=lambda x: x["confidence"], reverse=True)
        return regions[:4]
