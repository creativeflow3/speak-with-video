export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TextChunk {
  text: string;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}

export interface ChunkOptions {
  /** Target word count per chunk before starting a new one. */
  targetWords?: number;
}

export interface LanguageCheckResult {
  matches: boolean;
  detected: string;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  title: string | null;
  channel: string | null;
}
