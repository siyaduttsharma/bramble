import argparse
import requests
import time
import uuid
import random

# Configuration
API_URL = "http://localhost:3000/api/v1/signup-event"

def send_event(payload):
    try:
        response = requests.post(API_URL, json=payload)
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def velocity_attack():
    print("--- [MODE: VELOCITY] Sending 20 events from same IP ---")
    visitor_id = str(uuid.uuid4())
    for i in range(20):
        payload = {
            "visitorId": visitor_id,
            "ipAddress": "192.168.1.50",
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "emailDomain": "gmail.com",
            "emailEntropy": 0.3,
            "typingSpeedMs": 1500,
            "fieldFocusCount": 5,
            "pasteDetected": False,
            "timezoneOffset": -480,
            "sessionDurationMs": 12000
        }
        res = send_event(payload)
        print(f"Event {i+1}: correlation_id={res['eventId']}")
        time.sleep(0.5)

def bot_attack():
    print("--- [MODE: BOT] Sending 10 events with bot signals ---")
    for i in range(10):
        payload = {
            "visitorId": str(uuid.uuid4()),
            "ipAddress": f"10.0.0.{i}",
            "userAgent": "Bot/1.0",
            "emailDomain": "junk.io",
            "emailEntropy": 0.95,
            "typingSpeedMs": 50,
            "fieldFocusCount": 1,
            "pasteDetected": True,
            "timezoneOffset": 0,
            "sessionDurationMs": 2000
        }
        res = send_event(payload)
        print(f"Bot Event {i+1}: correlation_id={res['eventId']}")

def fingerprint_attack():
    print("--- [MODE: FINGERPRINT] Testing repeat fingerprint block ---")
    visitor_id = "blocked-id-12345"
    for i in range(5):
        payload = {
            "visitorId": visitor_id,
            "ipAddress": "1.2.3.4",
            "userAgent": "Chrome/114.0",
            "emailDomain": f"user{i}@test.com",
            "emailEntropy": 0.4,
            "typingSpeedMs": 2000,
            "fieldFocusCount": 6,
            "pasteDetected": False,
            "timezoneOffset": -300,
            "sessionDurationMs": 15000
        }
        res = send_event(payload)
        print(f"Fingerprint Event {i+1}: correlation_id={res['eventId']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["velocity", "bot", "fingerprint"], required=True)
    args = parser.parse_args()

    if args.mode == "velocity": velocity_attack()
    elif args.mode == "bot": bot_attack()
    elif args.mode == "fingerprint": fingerprint_attack()
