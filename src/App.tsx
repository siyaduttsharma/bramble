/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Activity, Shield, Users, Server, HardDrive, BarChart3, AlertCircle, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SignupForm from './components/SignupForm';
import AnalystDashboard from './components/AnalystDashboard';

type Page = 'signup' | 'dashboard';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('signup');
  const [health, setHealth] = useState({ ingestion: 'UP', brain: 'UP', redis: 'UP' });

  return (
    <div className="flex h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A] selection:text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-[#FAFAFA] flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#1A1A1A] rounded-full"></div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A] italic lowercase">bramble</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2">Navigation</p>
            <div className="space-y-1">
              <button 
                onClick={() => setCurrentPage('signup')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${currentPage === 'signup' ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Users size={14} />
                Signup Form
              </button>
              <button 
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${currentPage === 'dashboard' ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <BarChart3 size={14} />
                Analyst Dashboard
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <div className="animate-pulse w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
            LIVE SENSOR FEED
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white overflow-y-auto">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_-20%,#000_0%,transparent_50%)]"></div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col h-full relative z-10"
          >
            {currentPage === 'signup' ? <SignupForm /> : <AnalystDashboard />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function ServiceItem({ name, port, status }: { name: string, port: string, status: string }) {
  return (
    <li className="flex items-center justify-between p-2 text-xs text-slate-500">
      <span className="flex items-center gap-2">
        <div className="w-1 h-1 bg-teal-500 rounded-full"></div>
        {name}
      </span>
      <span className="font-mono opacity-60">{port}</span>
    </li>
  );
}
