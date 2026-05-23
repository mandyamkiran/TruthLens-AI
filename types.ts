/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExifData {
  CameraModel?: string;
  Software?: string;
  ModifyDate?: string;
  Creator?: string;
  ColorSpace?: string;
  Compression?: string;
  MetadataStatus: 'stripped' | 'authentic' | 'altered';
  AiWatermarkDetected: boolean;
}

export interface HeatmapPoint {
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  radius: number; // radius of hotspot
  intensity: number; // 0 to 1 intensity
  feature: string; // "GAN texture", "Noise inconsistency", "JPEG compression grid"
}

export interface VideoFrameAnomaly {
  frameIndex: number;
  timestamp: string;
  anomalyType: string; // "Lip sync mismatch", "Facial blendshape distortion", "Temporal jitter"
  score: number; // 0 to 100
  screenshotUrl?: string;
}

export interface TimelineMark {
  seconds: number;
  type: 'manipulation' | 'audio_mismatch' | 'authentic' | 'warning';
  label: string;
  confidence: number;
}

export interface ScanReport {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: 'image' | 'video' | 'news';
  thumbnailUrl: string;
  createdAt: string;
  headlineText?: string; // For news input

  // News Fact Check specialized structures
  newsFactCheck?: {
    claimText: string;
    fakeNewsProbability: number;
    authenticityScore: number;
    trustScore: number;
    credibilityRating: 'Low' | 'Medium' | 'High' | 'Critical' | 'Excellent';
    confidenceLevel: number;
    sourceReliability: number;
    verificationSummary: string;
    relatedVerifiedArticles: {
      title: string;
      url: string;
      source: string;
      publishDate?: string;
      summary?: string;
    }[];
    mismatchIndicators: string[];
    manipulationWarnings: string[];
    sentimentBiasScore: number;
    headlineClickbaitProbability: number;
    propagandaPatternScore: number;
    factCheckTimeline: {
      date: string;
      event: string;
      status: 'Debunked' | 'Verified' | 'Claims Surged' | 'Origin Captured';
      description: string;
    }[];
    verificationSources: {
      domain: string;
      title: string;
      url: string;
      reputationScore: number;
    }[];
  };
  
  // High level scores
  truthScore: number; // 0 to 100 (high = authentic)
  aiProbability: number; // 0 to 100
  deepfakeProbability: number; // 0 to 100
  manipulationScore: number; // 0 to 100
  confidenceScore: number; // 0 to 100
  status: 'scanning' | 'completed' | 'failed';

  // Specific Heuristic findings
  exif: ExifData;
  heatmap: HeatmapPoint[];
  explanation: string;
  detectionLabel?: string;
  confidenceExplanation?: string;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical' | 'none';
  watermarkStatus?: string;
  aiSourceProbability?: {
    stableDiffusion: number;
    dalle: number;
    midjourney: number;
    flux: number;
    gemini: number;
    adobeFirefly: number;
    synthId: number;
  };
  aiArtifactIndicators?: string[];
  watermarkTraceType?: string;
  
  // Frequency Spectrum / Sensor Noise stats
  frequencySpectrumAnomalies: number; // 0 to 100 percentage
  noiseInconsistencyScore: number; // 0 to 100
  
  // Specific video items
  videoTimeline?: TimelineMark[];
  videoFrameAnomalies?: VideoFrameAnomaly[];
}

export interface UserActivity {
  id: string;
  type: 'scan_completed' | 'api_key_created' | 'login' | 'billing_upgrade' | 'scan_failed';
  title: string;
  description: string;
  timestamp: string;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  usageCount: number;
  status: 'active' | 'revoked';
}
