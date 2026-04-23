import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { SignupEventSchema, EnrichedSignupEvent, RiskVerdict, Stats } from './services/ingestion/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory "Redis" for the preview
const eventLog: RiskVerdict[] = [];
const stats: Stats = { total_scored: 0, blocked: 0, greylisted: 0, passed: 0 };
const blockedFingerprints = new Set<string>();
const ipHistory: Record<string, number[]> = {};

// WebSocket connections by visitorId
const clients = new Map<string, WebSocket>();

// Re-seed logic removed as requested for empty start state
const seedData = () => {
  // No initial events
};
seedData();

// --- ADMIN API ---
// Reset endpoint removed as requested

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/v1/signup-event', (req, res) => {
  const eventId = uuidv4();
  res.set('X-Correlation-ID', eventId);

  try {
    const rawEvent = SignupEventSchema.parse(req.body);
    const enriched: EnrichedSignupEvent = {
      ...rawEvent,
      eventId,
      timestamp: new Date().toISOString()
    };

    logger.info({ eventId, visitorId: enriched.visitorId }, 'Signup event received');

    // Simulate publishing to Redis Stream "signup-events"
    // In the preview, we handle it in-process
    processRiskEvent(enriched);

    res.status(202).json({ eventId, status: 'accepted' });
  } catch (error) {
    logger.error({ error }, 'Invalid signup event');
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.get('/api/v1/events', (req, res) => {
  res.json(eventLog.slice(-50).reverse());
});

app.get('/api/v1/stats', (req, res) => {
  res.json(stats);
});

app.post('/api/v1/simulate', (req, res) => {
  const type = req.body.type || 'random';
  const visitorId = uuidv4();
  const eventId = uuidv4();

  let event: EnrichedSignupEvent = {
    visitorId,
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    emailDomain: 'gmail.com',
    emailEntropy: Math.random(),
    typingSpeedMs: 800 + Math.random() * 2000,
    fieldFocusCount: 2,
    pasteDetected: false,
    timezoneOffset: 480,
    sessionDurationMs: 5000,
    eventId,
    timestamp: new Date().toISOString()
  };

  if (type === 'bot') {
    event.typingSpeedMs = 50;
    event.pasteDetected = true;
    event.emailEntropy = 0.95;
    event.timezoneOffset = 0; // Trigger mismatch
  } else if (type === 'velocity') {
    event.ipAddress = '1.1.1.1'; // Fixed IP to trigger velocity
    // Trigger it 4 times immediately
    processRiskEvent({ ...event, eventId: uuidv4(), timestamp: new Date().toISOString() });
    processRiskEvent({ ...event, eventId: uuidv4(), timestamp: new Date().toISOString() });
    processRiskEvent({ ...event, eventId: uuidv4(), timestamp: new Date().toISOString() });
  }

  processRiskEvent(event);
  res.json({ status: 'simulated', eventId });
});

app.put('/api/v1/review/:eventId', (req, res) => {
  const { eventId } = req.params;
  const { action, visitorId } = req.body;
  
  if (action === 'block') {
    blockedFingerprints.add(visitorId);
  } else if (action === 'clear') {
    blockedFingerprints.delete(visitorId);
  }

  // Update the event in log so it reflects the new decision
  const eventIdx = eventLog.findIndex(e => e.eventId === eventId);
  if (eventIdx !== -1) {
    eventLog[eventIdx].decision = action === 'block' ? 'BLOCK' : 'PASS';
  }

  res.status(200).send();
});

// --- RISK BRAIN (Simulated in TS for Preview) ---

async function processRiskEvent(event: EnrichedSignupEvent) {
  const start = Date.now();
  let score = 0;
  const reasons: string[] = [];

  // Rule 1: Repeat Fingerprint
  if (blockedFingerprints.has(event.visitorId)) {
    score = 100;
    reasons.push('REPEAT_FINGERPRINT');
  } else {
    // Rule 2: IP Velocity
    const now = Date.now();
    const timestamps = ipHistory[event.ipAddress] || [];
    const recent = timestamps.filter(ts => now - ts < 60000);
    recent.push(now);
    ipHistory[event.ipAddress] = recent;
    if (recent.length >= 3) {
      score += 40;
      reasons.push('IP_VELOCITY');
    }

    // Rule 3: Bot Typing
    if (event.typingSpeedMs < 400) {
      score += 30;
      reasons.push('BOT_TYPING');
    }

    // Rule 4: Paste Detected
    if (event.pasteDetected) {
      score += 15;
      reasons.push('PASTE_DETECTED');
    }

    // Rule 5: High Email Entropy
    if (event.emailEntropy > 0.8) {
      score += 20;
      reasons.push('HIGH_EMAIL_ENTROPY');
    }

    // Rule 6: Timezone Mismatch
    if (event.timezoneOffset === 0 && !event.userAgent.includes('en-US')) {
      score += 10;
      reasons.push('TIMEZONE_MISMATCH');
    }

    // ML Layer (Mocking IsolationForest contribution)
    // In the real Python service, this adds up to 25 points
    const mlScore = Math.random() * 25;
    score += mlScore;
  }

  score = Math.min(100, score);
  
  let decision: 'PASS' | 'GREYLIST' | 'BLOCK' = 'PASS';
  if (score >= 70) decision = 'BLOCK';
  else if (score >= 30) decision = 'GREYLIST';

  if (decision === 'BLOCK') {
    blockedFingerprints.add(event.visitorId);
    stats.blocked++;
  } else if (decision === 'GREYLIST') {
    stats.greylisted++;
  } else {
    stats.passed++;
  }
  stats.total_scored++;

  const verdict: RiskVerdict = {
    eventId: event.eventId,
    visitorId: event.visitorId,
    decision,
    score: Math.round(score),
    confidence: 0.94 + (Math.random() * 0.05), // Mock confidence
    reasons: reasons.length > 0 ? reasons : ['NORMAL'],
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString()
  };

  eventLog.push(verdict);
  if (eventLog.length > 100) eventLog.shift();

  // "Publish" to connected WebSocket clients
  const client = clients.get(event.visitorId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(verdict));
  }
}

// --- VITE SETUP ---

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Bramble unified service running on http://localhost:${PORT}`);
  });

  // --- WEBSOCKET SERVER ---
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const visitorId = url.searchParams.get('visitorId');

    if (!visitorId) {
      ws.close();
      return;
    }

    clients.set(visitorId, ws);
    logger.info({ visitorId }, 'WebSocket client connected');

    ws.on('close', () => {
      clients.delete(visitorId);
    });
  });
}

startServer();
