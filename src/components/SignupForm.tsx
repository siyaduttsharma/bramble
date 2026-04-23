import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ShieldCheck, AlertTriangle, XCircle, ExternalLink, Shield } from 'lucide-react';
import { calculateEntropy } from '../lib/utils';
import { RiskVerdict } from '../../services/ingestion/src/types';

export default function SignupForm() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [status, setStatus] = useState<'idle' | 'verifying' | 'result'>('idle');
  const [verdict, setVerdict] = useState<RiskVerdict | null>(null);
  
  // Behavioral tracking refs
  const visitorIdRef = useRef<string>(localStorage.getItem('bramble_visitor_id') || '');
  const pageLoadTimeRef = useRef<number>(Date.now());
  const firstKeyPressTimeRef = useRef<number | null>(null);
  const focusCountRef = useRef<number>(0);
  const pasteDetectedRef = useRef<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!visitorIdRef.current) {
      const newId = uuidv4();
      visitorIdRef.current = newId;
      localStorage.setItem('bramble_visitor_id', newId);
    }
  }, []);

  const handleFocus = () => {
    focusCountRef.current += 1;
  };

  const handlePaste = () => {
    pasteDetectedRef.current = true;
  };

  const handleKeyDown = () => {
    if (firstKeyPressTimeRef.current === null) {
      firstKeyPressTimeRef.current = Date.now();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('verifying');

    const emailPrefix = formData.email.split('@')[0] || '';
    const eventData = {
      visitorId: visitorIdRef.current,
      ipAddress: '127.0.0.1', // Mocked for preview
      userAgent: navigator.userAgent,
      emailDomain: formData.email.split('@')[1] || 'unknown',
      emailEntropy: calculateEntropy(emailPrefix),
      typingSpeedMs: firstKeyPressTimeRef.current ? Date.now() - firstKeyPressTimeRef.current : 0,
      fieldFocusCount: focusCountRef.current,
      pasteDetected: pasteDetectedRef.current,
      timezoneOffset: new Date().getTimezoneOffset(),
      sessionDurationMs: Date.now() - pageLoadTimeRef.current,
    };

    try {
      // 1. POST to ingestion API
      await fetch('/api/v1/signup-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      // 2. Open WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}?visitorId=${visitorIdRef.current}`);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const result: RiskVerdict = JSON.parse(event.data);
        setVerdict(result);
        setStatus('result');
        socket.close();
      };

      socket.onclose = () => {
        if (status === 'verifying') {
          // Retry logic could go here
        }
      };
    } catch (error) {
      console.error('Submission failed', error);
      setStatus('idle');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="mb-8"
        >
          <Loader2 size={32} className="text-slate-400" />
        </motion.div>
        <h2 className="text-xl font-serif italic mb-2">Analyzing Behavioral Identity</h2>
        <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Protocol: Sensor_Metric_Validation</p>
      </div>
    );
  }

  if (status === 'result' && verdict) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {verdict.decision === 'PASS' && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mx-auto mb-6 text-teal-600">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-serif italic mb-2">Verified Successfully</h2>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">Your digital signature pattern is consistent with authentic behavior.</p>
              <button 
                onClick={() => setStatus('idle')}
                className="px-8 py-3 bg-[#1A1A1A] text-white font-medium rounded-full hover:bg-slate-800 transition-all text-sm"
              >
                Continue to app
              </button>
            </motion.div>
          )}

          {verdict.decision === 'GREYLIST' && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center max-w-sm"
            >
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-serif italic mb-4">Manual Review Required</h2>
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl mb-6">
                <p className="text-[10px] text-slate-400 mb-4 font-mono uppercase tracking-widest">Signal: Low_Confidence_Pattern</p>
                <div className="h-10 bg-white border border-dashed border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-300 uppercase tracking-widest font-mono">
                  [ HCAPTCHA_GATEWAY ]
                </div>
              </div>
              <button className="text-[10px] text-slate-500 underline uppercase font-mono tracking-widest">
                Appeal verification decision
              </button>
            </motion.div>
          )}

          {verdict.decision === 'BLOCK' && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600">
                <XCircle size={32} />
              </div>
              <h2 className="text-2xl font-serif italic mb-4">Access Denied</h2>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">Automated systems have flagged this session as high-risk behavior.</p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setStatus('idle')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 uppercase font-mono flex items-center gap-2 justify-center transition-colors"
                >
                  <ExternalLink size={12} /> Contact security team
                </button>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2 border border-slate-200 text-slate-600 font-medium rounded-full hover:bg-slate-50 transition-all text-xs"
                >
                  Retry session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#FDFCFB]">
      <div className="w-full max-w-md bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-10 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-50 rounded-full opacity-50"></div>
        
        <header className="mb-10 text-center">
          <h2 className="text-3xl font-serif italic text-slate-800 mb-2">Create Account</h2>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-[0.2em] px-1">Secured by bramble</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-1">Email</label>
            <input 
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onFocus={handleFocus}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#FAFAFA] border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-300 transition-colors placeholder:text-slate-300"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-1">Password</label>
            <input 
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              onFocus={handleFocus}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#FAFAFA] border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-slate-300 transition-colors"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#1A1A1A] text-white font-medium py-4 rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] mt-6 text-sm shadow-lg shadow-black/10"
          >
            Authenticate Identity
          </button>
        </form>

        <p className="mt-8 text-[9px] text-center text-slate-400 font-mono max-w-[240px] mx-auto uppercase leading-relaxed tracking-wider">
          Digital biometrics analyzed for platform integrity.
        </p>
      </div>
    </div>
  );
}
