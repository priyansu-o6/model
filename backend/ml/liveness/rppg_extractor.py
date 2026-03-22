import numpy as np
import cv2
from collections import deque
from scipy import signal as scipy_signal


class RPPGExtractor:
    def __init__(self, fps: float = 15.0, window_seconds: int = 10):
        self.fps = fps
        self.window_size = int(fps * window_seconds)
        self.green_channel_buffer = deque(maxlen=self.window_size)
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

    def add_frame(self, frame: np.ndarray) -> None:
        # Frame is already a cropped face - extract forehead directly
        if frame is None or frame.size == 0:
            return
        h, w = frame.shape[:2]
        # Take forehead region (top 30% center of frame)
        y1 = int(h * 0.05)
        y2 = int(h * 0.40)
        x1 = int(w * 0.20)
        x2 = int(w * 0.80)
        forehead = frame[y1:y2, x1:x2]
        if forehead.size == 0:
            return
        green_mean = float(np.mean(forehead[:, :, 1]))
        self.green_channel_buffer.append(green_mean)

    def compute_bpm(self) -> dict:
        if len(self.green_channel_buffer) < 15:
            return {
                "bpm": 0.0,
                "liveness_score": 0.5,
                "signal": [],
                "ready": False
            }
        
        signal_array = np.array(self.green_channel_buffer)
        
        # Detrend and normalize
        signal_array = scipy_signal.detrend(signal_array)
        signal_array = (signal_array - np.mean(signal_array)) / (np.std(signal_array) + 1e-8)
        
        # Bandpass filter for heart rate (0.7-3.0 Hz = 42-180 BPM)
        nyquist = self.fps / 2.0
        low = 0.7 / nyquist
        high = min(3.0 / nyquist, 0.99)
        
        try:
            b, a = scipy_signal.butter(3, [low, high], btype='band')
            filtered = scipy_signal.filtfilt(b, a, signal_array)
        except Exception:
            filtered = signal_array
        
        # FFT to find dominant frequency
        fft_vals = np.abs(np.fft.rfft(filtered))
        freqs = np.fft.rfftfreq(len(filtered), d=1.0/self.fps)
        
        # Only look at heart rate frequencies
        valid_mask = (freqs >= 0.7) & (freqs <= 3.0)
        if not np.any(valid_mask):
            return {"bpm": 0.0, "liveness_score": 0.5, "signal": [], "ready": False}
        
        valid_freqs = freqs[valid_mask]
        valid_fft = fft_vals[valid_mask]
        dominant_freq = valid_freqs[np.argmax(valid_fft)]
        bpm = float(dominant_freq * 60.0)
        
        # Liveness score based on normal BPM range
        if 50 <= bpm <= 120:
            liveness_score = 0.95
        elif 40 <= bpm <= 140:
            liveness_score = 0.75
        else:
            liveness_score = 0.2
        
        return {
            "bpm": round(bpm, 1),
            "liveness_score": liveness_score,
            "signal": filtered[-30:].tolist(),
            "ready": True
        }

    def reset(self):
        self.green_channel_buffer.clear()
