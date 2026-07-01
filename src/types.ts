
export interface Inspiration {
  id: string;
  niche: string;
  classification: string;
  content: string;
  createdAt: number;
  isGlobal?: boolean;
}

export interface ScriptScene {
  id: string;
  startTime: string;
  endTime: string;
  text: string;
  imagePrompt: string;
}

export interface ViralScoreAnalysis {
  curiosity: number;
  emotion: number;
  conflict: number;
  surprise: number;
  trend: number;
  justification: string;
}

export interface ContentDecision {
  worthProducing: boolean;
  reason: string;
  improvements: string;
}

export interface GeneratedScript {
  id: string;
  title: string;
  niche: string;
  fullText: string;
  scenes: ScriptScene[];
  thumbnailPrompt: string;
  format?: '16:9' | '9:16';
  createdAt: number;
  updatedAt?: number;
  wordCount: number | 'manual';
  isGlobal?: boolean;
  // Viral Engine v3.0
  viralScore?: number;
  viralClassification?: 'Alto' | 'Médio' | 'Baixo' | string;
  viralAnalysis?: ViralScoreAnalysis;
  decision?: ContentDecision;
  contentType?: string;
  advancedMode?: boolean;
  idealCut?: string;
  emotionalPeak?: string;
  thumbnailSuggestions?: string[];
}

export interface LanguagePattern {
  id: string;
  niche: string;
  style: string;
  content: string;
  createdAt: number;
  isGlobal?: boolean;
}

export type View = 'generator' | 'training' | 'history' | 'studio' | 'language_training' | 'seo';

export interface SEOMetadata {
  titles: string[];
  description: string;
  hashtags: string[];
  keywords: string[];
  thumbnailPrompt: string;
}

export interface VideoProject {
  id: string;
  originalScript: string;
  scenes: {
    text: string;
    duration: number;
    visualQuery: string;
    videoUrl?: string;
    assetUrl?: string; // Generic URL for either image or video
    assetType?: 'image' | 'video';
    isGenerating?: boolean;
  }[];
  createdAt: number;
  updatedAt: number;
}
