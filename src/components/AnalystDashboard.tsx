import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertTriangle, CheckCircle2, RotateCw, Trash2, Check, HardDrive } from 'lucide-react';
import { RiskVerdict, Stats } from '../../services/ingestion/src/types';
import { formatId } from '../lib/utils';

export default function AnalystDashboard() {
  const [stats, setStats] = useState<Stats>({ total_scored: 0, blocked: 0, greylisted: 0, passed: 0 });
  const [events, setEvents] = useState<RiskVerdict[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [statsRes, eventsRes] = await Promise.all([
        fetch(`/api/v1/stats?t=${ts}`),
        fetch(`/api/v1/events?t=${ts}`)
      ]);
      const statsData = await statsRes.json();
      const eventsData = await eventsRes.json();
      setStats(statsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Failed to poll dashboard data', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReview = async (eventId: string, visitorId: string, action: 'clear' | 'block') => {
    try {
      await fetch(`/api/v1/review/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, visitorId })
      });
      fetchData(); // Refresh immediately
    } catch (error) {
      console.error('Manual review action failed', error);
    }
  };

  const handleSimulate = async (type: 'bot' | 'velocity' | 'random') => {
    setIsRefreshing(true);
    try {
      await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      fetchData();
    } catch (error) {
      console.error('Simulation failed', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const greylistEvents = events.filter(e => e.decision === 'GREYLIST');

  const scrollToEntry = (eventId: string) => {
    setHighlightedId(eventId);
    const element = document.getElementById(`event-${eventId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="flex-1 bg-[#FDFCFB]">
      {/* Header */}
      <header className="px-10 py-10 flex items-center justify-between border-b border-slate-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-[10px] font-bold text-slate-400 font-mono tracking-[0.3em] uppercase mb-1.5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
            Live Oversight
          </h2>
          <p className="text-3xl font-serif italic text-slate-900 flex items-center gap-5">
            Threat Intelligence
            <span className="text-[10px] not-italic font-mono bg-slate-50 text-slate-500 px-3 py-1 rounded-full border border-slate-200">
              {events.length} ACTIVE SIGNALS
            </span>
          </p>
        </div>
        <div className="flex gap-6">
          <StatCard label="Analyzed" value={stats.total_scored} />
          <StatCard label="Restricted" value={stats.blocked} color="text-rose-600" />
          <StatCard label="Suspicious" value={stats.greylisted} color="text-amber-600" />
          <StatCard label="Verified" value={stats.passed} color="text-teal-600" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-8 flex gap-8 items-start">
        {/* Left Column: Review Queue (Direct Action) */}
        <aside className="w-80 flex flex-col gap-6 sticky top-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <p className="text-[10px] text-slate-400 font-bold font-mono mb-6 uppercase tracking-widest flex justify-between items-center">
              Critical Review Needed
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{greylistEvents.length}</span>
            </p>
            
            <div className="space-y-3 min-h-[100px]">
              <AnimatePresence mode="popLayout">
                {greylistEvents.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 gap-3 opacity-20"
                  >
                    <CheckCircle2 size={32} />
                    <span className="text-[10px] uppercase font-mono font-bold">Queue Clear</span>
                  </motion.div>
                ) : (
                  greylistEvents.map(event => (
                    <motion.div 
                      key={event.eventId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      onClick={() => scrollToEntry(event.eventId)}
                      className={`flex flex-col gap-3 p-4 rounded-xl border transition-all cursor-pointer group ${highlightedId === event.eventId ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20 shadow-md scale-[1.02]' : 'bg-slate-50 border-slate-100 hover:border-slate-300 shadow-sm'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-[10px] ${highlightedId === event.eventId ? 'text-amber-700' : 'text-slate-500'}`}>#{event.eventId.substring(0, 8)}</span>
                        <div className="flex gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReview(event.eventId, event.visitorId, 'block'); }}
                            className="w-8 h-8 bg-white text-rose-500 border border-slate-100 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-shadow shadow-sm active:scale-95"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReview(event.eventId, event.visitorId, 'clear'); }}
                            className="w-8 h-8 bg-[#1A1A1A] text-white rounded-lg flex items-center justify-center hover:bg-slate-800 transition-shadow shadow-sm active:scale-95"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={`text-[11px] font-mono truncate ${highlightedId === event.eventId ? 'text-amber-900 font-bold' : 'text-slate-900 font-medium'}`}>{event.visitorId}</span>
                        <div className="flex gap-1 flex-wrap">
                          {event.reasons.filter(r => r !== 'NORMAL').slice(0, 2).map((r, i) => (
                            <span key={i} className={`text-[8px] uppercase font-mono px-1.5 py-0.5 rounded-sm ${highlightedId === event.eventId ? 'bg-amber-200/50 text-amber-700' : 'bg-black/10 text-slate-600'}`}>
                              {r.split('_')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-[10px] text-slate-400 font-bold font-mono mb-4 uppercase tracking-widest">Global Controls</p>
            <div className="space-y-3">
              <button 
                onClick={() => handleSimulate('random')}
                disabled={isRefreshing}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-all text-[11px] font-mono group disabled:opacity-50 text-slate-600"
              >
                <div className="flex items-center gap-2">
                   <RotateCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                   <span>INJECT RANDOM FLOW</span>
                </div>
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleSimulate('bot')}
                  disabled={isRefreshing}
                  className="flex flex-col gap-2 items-center justify-center p-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition-all text-[10px] font-mono disabled:opacity-50"
                >
                  <AlertTriangle size={16} />
                  <span>BOT ATTACK</span>
                </button>
                <button 
                  onClick={() => handleSimulate('velocity')}
                  disabled={isRefreshing}
                  className="flex flex-col gap-2 items-center justify-center p-4 bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-100 rounded-xl transition-all text-[10px] font-mono disabled:opacity-50"
                >
                  <Shield size={16} />
                  <span>VELOCITY</span>
                </button>
              </div>
            </div>
          </section>
        </aside>

        {/* Right Column: Full Table */}
        <main className="flex-1 space-y-6">
          <header className="flex items-center justify-between px-2">
            <p className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">Consolidated Event Log</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Live Sensor Feed</span>
            </div>
          </header>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[600px]">
            <div className="grid grid-cols-[100px_1fr_120px_140px_100px] px-8 py-5 text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <div>Session</div>
              <div>Identifier & Indicators</div>
              <div>Score</div>
              <div>Verdict</div>
              <div>Latency</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 opacity-30 gap-6">
                  <Shield size={64} className="text-slate-400" />
                  <p className="font-mono text-sm uppercase tracking-widest text-slate-800 font-bold">Awaiting initial handshake...</p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.eventId}
                    id={`event-${event.eventId}`}
                    className={`grid grid-cols-[100px_1fr_120px_140px_100px] px-8 py-8 items-center transition-all border-l-4 ${highlightedId === event.eventId ? 'bg-amber-50/50 border-l-amber-500' : 'hover:bg-slate-50/50 border-l-transparent'} group`}
                  >
                    <div className="text-[11px] font-mono text-slate-400 font-bold">#{event.eventId.substring(0, 8)}</div>
                    <div className="flex flex-col gap-3">
                      <span className="text-[15px] font-mono text-slate-900 font-medium tracking-tight">{formatId(event.visitorId)}</span>
                      <div className="flex gap-2 flex-wrap">
                        {event.reasons.map(reason => (
                          <span key={reason} className="text-[10px] bg-white text-slate-600 px-3 py-1 rounded-md border border-slate-200 font-mono uppercase tracking-tighter shadow-sm flex items-center gap-2 border-l-2 border-l-slate-400">
                            {reason.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`font-mono text-xl ${getScoreColor(event.score)} font-black`}>
                      {event.score}.0
                    </div>
                    <div>
                      <span className={`text-[11px] px-5 py-2 rounded-full font-bold uppercase tracking-wider ${getBadgeStyles(event.decision)} shadow-sm border border-black/5`}>
                        {event.decision}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[12px] font-mono text-slate-900 font-bold">{event.latencyMs}ms</div>
                      <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">Response</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-slate-800' }: { label: string, value: number, color?: string }) {
  return (
    <div className="bg-white border border-slate-100 px-5 py-3 rounded-2xl shadow-sm text-center min-w-[120px]">
      <p className="text-[9px] text-slate-400 uppercase font-mono tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-serif italic ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

const getBadgeStyles = (decision: string) => {
  switch (decision) {
    case 'BLOCK': return 'bg-rose-50 text-rose-600 border border-rose-100';
    case 'GREYLIST': return 'bg-amber-50 text-amber-600 border border-amber-100';
    case 'PASS': return 'bg-teal-50 text-teal-600 border border-teal-100';
    default: return 'bg-slate-50 text-slate-400';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-rose-500';
  if (score >= 30) return 'text-amber-500';
  return 'text-teal-600';
};
