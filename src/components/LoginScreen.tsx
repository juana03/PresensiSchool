import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  KeyRound,
  User as UserIcon,
  Lock,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Database
} from 'lucide-react';
import schoolLogo from '../assets/images/smk_tutwuri_handayani_logo_1782261943532.jpg';

interface LoginScreenProps {
  onLogin: (username: string, pass: string) => void;
  isLoggingIn: boolean;
  errorMsg: string | null;
  isSheetLinked: boolean;
  onLinkSheet: () => void;
}

export default function LoginScreen({ onLogin, isLoggingIn, errorMsg, isSheetLinked, onLinkSheet }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username, password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/50 text-slate-800 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Premium Minimal Decorative Background Shapes */}
      <div className={`absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none transition-all duration-700`} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />
      
      {/* Subtle Pattern Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm z-10"
      >
        {/* Modern Clean Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center bg-white border border-slate-200 p-2 rounded-2xl mb-3 shadow-sm overflow-hidden w-20 h-20">
            <img src={schoolLogo} alt="Logo SMK Tutwuri Handayani Cimahi" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans sm:text-3xl">
            SIAKAD PRESENSI
          </h1>
          <p className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase mt-1">
            SMK TUTWURI HANDAYANI, CIMAHI
          </p>
          <div className="mt-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
             <p className="text-[10px] font-bold text-indigo-700 leading-relaxed uppercase tracking-wider">
               Real-time Google Sheets Cloud Sync Active
             </p>
          </div>
        </div>

        {/* Clean Bright Form Card */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
          <div className={`absolute top-0 left-0 w-full h-[4px] ${isSheetLinked ? 'bg-indigo-500' : 'bg-amber-500'}`} />
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Selamat Datang Kembali
                </h2>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Masukkan kredensial portal Anda untuk melanjutkan
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-[10px] font-bold w-full mb-2"
              >
                ⚠ {errorMsg}
              </motion.div>
            )}

            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <UserIcon size={14} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username / ID"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={14} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata Sandi"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full text-white font-black text-[11px] tracking-widest uppercase py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 active:scale-95"
            >
              {isLoggingIn ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Mengecek Kredensial...</span>
                </div>
              ) : (
                <>
                  <span>Masuk ke Portal</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center mt-5 text-slate-400 text-xs">
          <p>© 2026 SIGAP SMK Tutwuri Handayani, Cimahi.</p>
          <div className="flex items-center justify-center gap-1.5 mt-1 font-mono text-[9px] text-slate-400">
            <KeyRound size={9} />
            <span>SECURE ENCRYPTED TRANSIT</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

