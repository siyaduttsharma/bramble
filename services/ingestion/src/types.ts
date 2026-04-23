import { z } from 'zod';

export const SignupEventSchema = z.object({
  visitorId: z.string().uuid().or(z.string().min(1)), // Allowing non-uuid for flexibility in tests
  ipAddress: z.string(),
  userAgent: z.string(),
  emailDomain: z.string(),
  emailEntropy: z.number().min(0).max(1),
  typingSpeedMs: z.number(),
  fieldFocusCount: z.number(),
  pasteDetected: z.boolean(),
  timezoneOffset: z.number(),
  sessionDurationMs: z.number(),
});

export type SignupEvent = z.infer<typeof SignupEventSchema>;

export interface EnrichedSignupEvent extends SignupEvent {
  eventId: string;
  timestamp: string;
}

export type Decision = 'PASS' | 'GREYLIST' | 'BLOCK';

export interface RiskVerdict {
  eventId: string;
  visitorId: string;
  decision: Decision;
  score: number;
  confidence: number;
  reasons: string[];
  latencyMs: number;
  timestamp: string;
}

export interface Stats {
  total_scored: number;
  blocked: number;
  greylisted: number;
  passed: number;
}
