import cv2
import mediapipe as mp
import numpy as np

class MediaPipeFaceDetector:
    def __init__(self, min_detection_confidence=0.5):
        self.mp_face_detection = mp.solutions.face_detection
        # model_selection=0 is for short-range detections (within 2 meters)
        # model_selection=1 is for long-range detections (up to 5 meters)
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=0, 
            min_detection_confidence=min_detection_confidence
        )

    def detect_face(self, image, pad_ratio=0.3):
        """
        Detects the largest face in the image and returns a cropped version.
        
        Args:
            image: BGR image from OpenCV
            pad_ratio: Ratio of padding to add around the detected face
            
        Returns:
            Tuple of (cropped_image, face_found_bool, bbox_tuple)
            bbox_tuple is (x, y, w, h)
        """
        if image is None or image.size == 0:
            return image, False, None

        h, w = image.shape[:2]
        # MediaPipe expects RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(image_rgb)

        if not results.detections:
            return image, False, None

        # Take the detection with the largest bounding box area
        best_detection = max(
            results.detections,
            key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height
        )

        bbox = best_detection.location_data.relative_bounding_box
        
        # Convert relative coordinates to pixel coordinates
        x = int(bbox.xmin * w)
        y = int(bbox.ymin * h)
        w_f = int(bbox.width * w)
        h_f = int(bbox.height * h)

        # Ensure coordinates are within bounds
        x = max(0, x)
        y = max(0, y)
        w_f = min(w - x, w_f)
        h_f = min(h - y, h_f)

        # Apply padding
        pad = int(pad_ratio * max(w_f, h_f))
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(w, x + w_f + pad)
        y2 = min(h, y + h_f + pad)

        cropped = image[y1:y2, x1:x2]
        
        return cropped, True, (x, y, w_f, h_f)

    def close(self):
        self.face_detection.close()

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass
