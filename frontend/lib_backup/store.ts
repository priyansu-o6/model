"use client";

import { create } from "zustand";

export type User = {
  id: string;
  email: string;
  role: string;
  organization?: string | null;
};

export type Session = {
  id: string;
  user_id: string;
  mode: string;
  status: string;
  subject_name?: string | null;
  media_path?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
};

export type SignalData = {
  xception_score: number;
  rppg_bpm: number;
  risk_score: number;
  risk_level: string;
  verdict: string;
  liveness_score: number;
  audio_score: number;
  temporal_score: number;
  frame_count: number;
};

export type DashboardStats = {
  total_sessions: number;
  authentic_count: number;
  deepfake_count: number;
  suspicious_count: number;
  average_risk_score: number;
};

type AppStore = {
  user: User | null;
  currentSession: Session | null;
  liveSignals: SignalData | null;
  riskScore: number;
  isLiveActive: boolean;
  sessions: Session[];
  dashboardStats: DashboardStats | null;
  setUser: (user: User | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setLiveSignals: (signals: SignalData | null) => void;
  setRiskScore: (score: number) => void;
  setIsLiveActive: (active: boolean) => void;
  setSessions: (sessions: Session[]) => void;
  setDashboardStats: (stats: DashboardStats | null) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  currentSession: null,
  liveSignals: null,
  riskScore: 0,
  isLiveActive: false,
  sessions: [],
  dashboardStats: null,
  setUser: (user) => set({ user }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setLiveSignals: (liveSignals) => set({ liveSignals }),
  setRiskScore: (riskScore) => set({ riskScore }),
  setIsLiveActive: (isLiveActive) => set({ isLiveActive }),
  setSessions: (sessions) => set({ sessions }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
}));

