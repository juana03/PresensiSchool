import React from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  User, 
  LogIn, 
  Edit3, 
  CheckCircle2, 
  Clock,
  ExternalLink
} from 'lucide-react';

interface ActivityLogProps {
  logs: any[];
}

export default function ActivityLog({ logs }: ActivityLogProps) {
  const getIcon = (action: string) => {
    if (action.includes('Login')) return <LogIn size={12} className="text-indigo-500" />;
    if (action.includes('Absensi')) return <CheckCircle2 size={12} className="text-emerald-500" />;
    if (action.includes('Google')) return <ExternalLink size={12} className="text-amber-500" />;
    return <Edit3 size={12} className="text-slate-400" />;
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
            <History size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Log Aktivitas Terbaru</h3>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Pantau interaksi sistem secara real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-200">
              <Clock size={24} />
            </div>
            <p className="text-xs text-slate-400 font-medium">Belum ada aktivitas tercatat.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={log.id}
                className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {getIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-black text-slate-800 truncate leading-none">
                      {log.action}
                    </p>
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock size={8} /> {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-1 leading-tight line-clamp-1">
                    {log.detail}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center">
                      <User size={8} className="text-slate-400" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      {log.user}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50/30 border-t border-slate-100 text-center">
        <button className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest">
          Lihat Semua Riwayat
        </button>
      </div>
    </div>
  );
}
