export type Point = { x: number; y: number };

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SuspiciousRegion = {
  id?: string;
  region_name: string;
  confidence: number;
  description?: string;
  manipulation_type?: string;
  bbox?: BoundingBox;
};

export type LivenessChallengeType = "blink_twice" | "turn_left" | "turn_right" | "smile" | "nod";

export type LivenessChallengeState = "WAITING" | "ACTIVE" | "PASSED" | "FAILED";

export type LivenessChallengeItem = {
  id?: string;
  type: LivenessChallengeType;
  state: LivenessChallengeState;
  started_at?: number;
  expires_in_seconds?: number;
};

export type LiveDetectionResult = {
  session_id?: string;
  frame_number?: number;
  risk_score?: number;
  risk_level?: string;
  xception_score?: number;
  confidence?: number;
  liveness_score?: number;
  audio_score?: number;
  temporal_score?: number;
  rppg_bpm?: number;
  blink_rate?: number;
  blink_pattern?: "NORMAL" | "IRREGULAR" | "ABSENT";
  last_blink_ts?: string;
  audio_attack_type?: "TTS" | "REPLAY" | "CLONE" | "NONE";
  audio_spoof_probability?: number;
  temporal_history?: number[];
  rppg_history?: number[];
  face_detected?: boolean;
  bbox?: BoundingBox;
  landmarks?: Point[];
  gradcam_data?: string | null;
  suspicious_regions?: SuspiciousRegion[];
  challenge?: LivenessChallengeItem | null;
  completed_challenges?: LivenessChallengeItem[];
};
export type Point = { x: number; y: number };

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SuspiciousRegion = {
  id?: string;
  region_name: string;
  confidence: number;
  description?: string;
  manipulation_type?: string;
  bbox?: BoundingBox;
};

export type LivenessChallengeType = "blink_twice" | "turn_left" | "turn_right" | "smile" | "nod";

export type LivenessChallengeState = "WAITING" | "ACTIVE" | "PASSED" | "FAILED";

export type LivenessChallengeItem = {
  id?: string;
  type: LivenessChallengeType;
  state: LivenessChallengeState;
  started_at?: number;
  expires_in_seconds?: number;
};

export type LiveDetectionResult = {
  session_id?: string;
  frame_number?: number;
  risk_score?: number;
  risk_level?: string;
  xception_score?: number;
  confidence?: number;
  liveness_score?: number;
  audio_score?: number;
  temporal_score?: number;
  rppg_bpm?: number;
  blink_rate?: number;
  blink_pattern?: "NORMAL" | "IRREGULAR" | "ABSENT";
  last_blink_ts?: string;
  audio_attack_type?: "TTS" | "REPLAY" | "CLONE" | "NONE";
  audio_spoof_probability?: number;
  temporal_history?: number[];
  rppg_history?: number[];
  face_detected?: boolean;
  bbox?: BoundingBox;
  landmarks?: Point[];
  gradcam_data?: string | null;
  suspicious_regions?: SuspiciousRegion[];
  challenge?: LivenessChallengeItem | null;
  completed_challenges?: LivenessChallengeItem[];
};

