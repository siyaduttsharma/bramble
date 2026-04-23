import os
import json
import uuid
import time
import redis
import pickle
import numpy as np
from fastapi import FastAPI
from sklearn.ensemble import IsolationForest

app = FastAPI()
r = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=6379, db=0)

MODEL_PATH = "models/isolation_forest.pkl"

def train_model():
    # Generate 500 synthetic "normal" samples
    emails = np.random.uniform(0.1, 0.4, 500)
    speed = np.random.uniform(1000, 5000, 500)
    focus = np.random.uniform(3, 10, 500)
    duration = np.random.uniform(10000, 60000, 500)
    tz = np.random.choice([-480, -300, 0, 60, 120], 500)
    paste = np.zeros(500)
    
    X = np.column_stack([emails, speed, focus, duration, tz, paste])
    model = IsolationForest(n_estimators=100, contamination=0.01)
    model.fit(X)
    
    os.makedirs("models", exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    return model

# Load or train
try:
    with open(MODEL_PATH, 'rb') as f:
        ml_model = pickle.load(f)
except:
    ml_model = train_model()

def score_event(event):
    start_time = time.time()
    score = 0
    reasons = []
    visitor_id = event['visitorId']
    ip = event['ipAddress']

    # Step 1: Rules
    # Check blocklist
    if r.get(f"blocked:{visitor_id}"):
        return {"decision": "BLOCK", "score": 100, "reasons": ["REPEAT_FINGERPRINT"], "confidence": 1.0}

    # IP Velocity
    count = r.incr(f"velocity:{ip}")
    if count == 1:
        r.expire(f"velocity:{ip}", 60)
    if count >= 3:
        score += 40
        reasons.append("IP_VELOCITY")

    if event['typingSpeedMs'] < 400:
        score += 30
        reasons.append("BOT_TYPING")
    
    if event['pasteDetected']:
        score += 15
        reasons.append("PASTE_DETECTED")
    
    if event['emailEntropy'] > 0.8:
        score += 20
        reasons.append("HIGH_EMAIL_ENTROPY")
    
    if event['timezoneOffset'] == 0 and "en-US" not in event['userAgent']:
        score += 10
        reasons.append("TIMEZONE_MISMATCH")

    # Step 2: ML
    features = np.array([[
        event['emailEntropy'],
        event['typingSpeedMs'],
        event['fieldFocusCount'],
        event['sessionDurationMs'],
        event['timezoneOffset'],
        1 if event['pasteDetected'] else 0
    ]])
    anomaly_score = ml_model.decision_function(features)[0]
    # Normalize anomaly_score to 0-25 contribution
    ml_contribution = np.clip(abs(anomaly_score) * 50, 0, 25)
    score += ml_contribution

    # Step 3: Decision
    score = min(100, score)
    decision = "PASS"
    if score >= 70: decision = "BLOCK"
    elif score >= 30: decision = "GREYLIST"

    if decision == "BLOCK":
        r.setex(f"blocked:{visitor_id}", 7776000, 1) # 90 days
        r.incr("stats:blocked")
    elif decision == "GREYLIST":
        r.incr("stats:greylisted")
    else:
        r.incr("stats:passed")
    
    r.incr("stats:total_scored")

    verdict = {
        "eventId": event['eventId'],
        "visitorId": visitor_id,
        "decision": decision,
        "score": int(score),
        "confidence": float(np.clip(1 - abs(anomaly_score), 0, 1)),
        "reasons": reasons if reasons else ["NORMAL"],
        "latencyMs": int((time.time() - start_time) * 1000),
        "timestamp": event['timestamp']
    }
    
    # Publish to Redis Stream "verdicts"
    r.xadd("verdicts", {"data": json.dumps(verdict)})
    return verdict

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/stats")
def get_stats():
    return {
        "total_scored": int(r.get("stats:total_scored") or 0),
        "blocked": int(r.get("stats:blocked") or 0),
        "greylisted": int(r.get("stats:greylisted") or 0),
        "passed": int(r.get("stats:passed") or 0)
    }

# Background Consumer loop would be started here in a real deployment
