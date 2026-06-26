/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Award, 
  Calendar, 
  FileText,
  Smartphone,
  ChevronRight,
  Compass,
  AlertCircle,
  Camera,
  QrCode,
  Search,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Download
} from 'lucide-react';
import { SimulatedRecord, StudentAttendance } from '../types';
import { registeredMembers } from '../data/directory';
import QRCode from 'react-qr-code';
import QrScanner from './QrScanner';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface StudentPortalProps {
  records: SimulatedRecord[];
  onAddRecord: (type: 'murid' | 'guru', data: any) => void;
  selectedStudentId: string;
  onStudentIdChange: (id: string) => void;
}

export default function StudentPortal({ 
  records, 
  onAddRecord, 
  selectedStudentId, 
  onStudentIdChange 
}: StudentPortalProps) {
  const [status, setStatus] = useState<'Hadir' | 'Sakit' | 'Izin'>('Hadir');
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalTab, setPortalTab] = useState<'dashboard' | 'presence' | 'history'>('dashboard');
  const [antiCheatStatus, setAntiCheatStatus] = useState<'idle' | 'analyzing' | 'passed' | 'failed'>('idle');
  const [antiCheatLogs, setAntiCheatLogs] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(5); // Default to June (index 5)
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(15);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'All' | 'Hadir' | 'Sakit' | 'Izin'>('All');
  const [show30DaysHistory, setShow30DaysHistory] = useState(false);
  const [history30DaysFilter, setHistory30DaysFilter] = useState<'All' | 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>('All');

  const [simulateOutOfRadius, setSimulateOutOfRadius] = useState(false);
  const [outOfRadiusAlert, setOutOfRadiusAlert] = useState(false);
  const [lateAlert, setLateAlert] = useState(false);

  const [qrToken, setQrToken] = useState<string>('');
  const [qrTimeLeft, setQrTimeLeft] = useState<number>(30);

  useEffect(() => {
    const generateToken = () => {
      const randomPart = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      setQrToken(`${selectedStudentId}-${timestamp}-${randomPart}`);
      setQrTimeLeft(30);
    };

    generateToken();
    const interval = setInterval(() => {
      setQrTimeLeft((prev) => {
        if (prev <= 1) {
          generateToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedStudentId]);

  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserPos([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // Higher quality
        backgroundColor: null,
      });
      
      const link = document.createElement('a');
      link.download = `Kartu_Pelajar_${activeStudent?.id || 'Digital'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate card image', err);
    }
  };

  const handleQrScanSuccess = (data: any) => {
    setIsSubmitting(true);
    const distanceMeter = Math.floor(Math.random() * 5) + 1; // 1 to 5 meters since physically at QR poster

    let finalStatus: 'Hadir' | 'Terlambat' = 'Hadir';
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(7, 15, 0, 0);
    if (now.getTime() > targetTime.getTime()) {
      finalStatus = 'Terlambat';
      setLateAlert(true);
    }

    const checkInData = {
      timestamp: new Date().toISOString(),
      nis: activeStudent.id,
      nama: activeStudent.name,
      kelas: activeStudent.detail,
      status: finalStatus,
      keterangan: 'Hadir via Contactless QR Check-In',
      latitude: -6.8837,
      longitude: 107.5451,
      jarak: distanceMeter,
      isWithinRadius: true
    };

    setTimeout(() => {
      onAddRecord('murid', checkInData);
      setIsSubmitting(false);
      setCheckinMethod('gps'); // reset back to gps form
    }, 600);
  };

  const activeStudent = registeredMembers.find(m => m.id === selectedStudentId && m.role === 'murid');
  
  if (!activeStudent) return null;

  // Personal statistics
  const studentRecords = records.filter(r => r.type === 'murid' && (r.data as any).nis === selectedStudentId);
  const totalSubmissions = studentRecords.length;
  const hadirCount = studentRecords.filter(r => r.data.status === 'Hadir').length;
  const sakitCount = studentRecords.filter(r => r.data.status === 'Sakit').length;
  const izinCount = studentRecords.filter(r => r.data.status === 'Izin').length;
  
  const attendanceRate = totalSubmissions > 0 
    ? Math.round((hadirCount / totalSubmissions) * 100) 
    : 100;

  const filteredStudentRecords = studentRecords.filter(r => {
    if (historyStatusFilter !== 'All' && r.data.status !== historyStatusFilter) {
      return false;
    }
    if (historySearch.trim() !== '') {
      const q = historySearch.toLowerCase();
      const formatted = formatTimestamp(r.timestamp).toLowerCase();
      const statusText = r.data.status.toLowerCase();
      const noteText = (r.data.keterangan || '').toLowerCase();
      return formatted.includes(q) || statusText.includes(q) || noteText.includes(q);
    }
    return true;
  });

  const INDO_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Calendar variables
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // Sunday=0
  
  const calendarDays = [];
  const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      dayNum: prevMonthDaysCount - i,
      isCurrentMonth: false,
      monthOffset: -1
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      dayNum: i,
      isCurrentMonth: true,
      monthOffset: 0
    });
  }
  const totalCells = Math.ceil(calendarDays.length / 7) * 7;
  const nextMonthPadding = totalCells - calendarDays.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    calendarDays.push({
      dayNum: i,
      isCurrentMonth: false,
      monthOffset: 1
    });
  }

  const getDayRecord = (dayNum: number) => {
    return studentRecords.find(r => {
      const rDate = new Date(r.timestamp);
      return rDate.getDate() === dayNum && 
             rDate.getMonth() === currentMonth && 
             rDate.getFullYear() === currentYear;
    });
  };

  // 30 Days History Generation
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const history30DaysData = last30Days.map(date => {
    const dateStr = date.toDateString();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const record = studentRecords.find(r => new Date(r.timestamp).toDateString() === dateStr);
    
    let status = 'Alpa';
    if (record) {
      status = record.data.status;
    } else if (isWeekend) {
      status = 'Libur';
    }

    return {
      date,
      dateString: date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      status,
      keterangan: record?.data.keterangan || (isWeekend ? 'Akhir Pekan' : 'Tanpa Keterangan')
    };
  }).filter(item => {
    if (history30DaysFilter === 'All') return item.status !== 'Libur';
    return item.status === history30DaysFilter;
  });

  // Daily status checker
  const todayStr = new Date().toDateString();
  const todayRecord = studentRecords.find(r => new Date(r.timestamp).toDateString() === todayStr);

  const handleSelfCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await Swal.fire({
      title: 'Konfirmasi Kehadiran',
      text: `Apakah Anda yakin ingin mengirim data presensi dengan status: ${status}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Kirim Data',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsSubmitting(true);
    setAntiCheatStatus('analyzing');
    setAntiCheatLogs(['Memulai Secure Environment Check...']);
    
    // Anti-cheat simulation sequence
    setTimeout(() => {
      setAntiCheatLogs(prev => [...prev, '📍 Validasi provider GPS [OK]']);
    }, 400);

    setTimeout(() => {
      setAntiCheatLogs(prev => [...prev, '🛡️ Deteksi Root/Jailbreak bypass [Aman]']);
    }, 800);

    setTimeout(() => {
      setAntiCheatLogs(prev => [...prev, '⏱️ Sinkronisasi waktu jaringan [Cocok]']);
    }, 1200);

    setTimeout(() => {
      setAntiCheatStatus('passed');
      
      const withinSchoolRadius = !simulateOutOfRadius;
      
      if (!withinSchoolRadius && status === 'Hadir') {
        setAntiCheatLogs(prev => [...prev, '❌ Peringatan: Lokasi di luar radius sekolah']);
        setOutOfRadiusAlert(true);
        // Play notification sound
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.5);
          
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } catch (e) {
          console.error('Audio/vibration failed', e);
        }
        
        setTimeout(() => {
          setIsSubmitting(false);
          setAntiCheatStatus('idle');
          setOutOfRadiusAlert(false);
        }, 3000);
        return;
      }

      setAntiCheatLogs(prev => [...prev, '✅ Integritas perangkat tervalidasi']);
      
      const distanceMeter = simulateOutOfRadius ? Math.floor(Math.random() * 500) + 150 : Math.floor(Math.random() * 20) + 5; // 5 to 25 meters

      let finalStatus: any = status;
      if (status === 'Hadir') {
        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(7, 15, 0, 0);
        if (now.getTime() > targetTime.getTime()) {
          finalStatus = 'Terlambat';
          setLateAlert(true);
        }
      }

      const checkInData = {
        timestamp: new Date().toISOString(),
        nis: activeStudent.id,
        nama: activeStudent.name,
        kelas: activeStudent.detail,
        status: finalStatus,
        keterangan: status === 'Hadir' ? '-' : keterangan || 'Izin perorangan',
        latitude: -6.8837,
        longitude: 107.5451,
        jarak: distanceMeter,
        isWithinRadius: withinSchoolRadius
      };

      setTimeout(() => {
        onAddRecord('murid', checkInData);
        setKeterangan('');
        setIsSubmitting(false);
        setAntiCheatStatus('idle');
      }, 600);
      
    }, 1600);
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + 
        ' - ' + date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 30 DAYS HISTORY MODAL */}
      {show30DaysHistory && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Riwayat Presensi (30 Hari Terakhir)</h3>
                  <p className="text-[10px] font-semibold text-slate-500 font-mono mt-0.5">{activeStudent.name} - NIS: {activeStudent.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setShow30DaysHistory(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="flex gap-2 text-[10px] font-bold font-mono">
                {(['All', 'Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistory30DaysFilter(f)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors ${
                      history30DaysFilter === f 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-50">
              <div className="space-y-2">
                {history30DaysData.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.dateString}</h4>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">{item.keterangan}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      item.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'Sakit' ? 'bg-amber-100 text-amber-700' :
                      item.status === 'Izin' ? 'bg-sky-100 text-sky-700' :
                      item.status === 'Alpa' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
                {history30DaysData.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                    Tidak ada riwayat presensi yang sesuai dengan filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LATE NOTIFICATION POPUP MODAL */}
      {lateAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[6px] bg-amber-500" />
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <Clock size={24} className="animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Pemberitahuan Absensi</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Anda melakukan absensi setelah batas waktu aman yaitu pukul <span className="font-bold text-slate-900">07:15</span>. 
                </p>
                <div className="text-xs text-amber-800 bg-amber-50/50 p-3 rounded-xl border border-amber-100/60 font-semibold mt-3 leading-relaxed">
                  "Status kehadiran Anda secara otomatis diatur sebagai <span className="font-extrabold underline text-amber-900">Terlambat</span> di database spreadsheet SMK Tutwuri Handayani, Cimahi."
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button 
                type="button"
                onClick={() => setLateAlert(false)} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <User size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Switch Akun Siswa</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Uji coba akses mandiri untuk identitas siswa yang berbeda</p>
          </div>
        </div>
        <select
          value={selectedStudentId}
          onChange={(e) => onStudentIdChange(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 md:h-10 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 cursor-pointer font-sans w-full md:w-64"
        >
          {registeredMembers.filter(m => m.role === 'murid').map(student => (
            <option key={student.id} value={student.id}>
              {student.name} ({student.id}) - Rombel {student.detail}
            </option>
          ))}
        </select>
      </div>

      {/* Student Portal Tabs */}
      <div className="grid grid-cols-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto gap-1 self-start">
        <button
          type="button"
          className={`px-5 flex items-center justify-center gap-2 h-11 text-xs font-bold rounded-xl transition-all ${portalTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('dashboard')}
        >
          <Compass size={16} />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`px-5 flex items-center justify-center gap-2 h-11 text-xs font-bold rounded-xl transition-all ${portalTab === 'presence' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('presence')}
        >
          <Smartphone size={16} />
          <span>Presensi & Kartu</span>
        </button>
        <button
          type="button"
          className={`px-5 flex items-center justify-center gap-2 h-11 text-xs font-bold rounded-xl transition-all ${portalTab === 'history' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('history')}
        >
          <FileText size={16} />
          <span>Riwayat Kehadiran</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {portalTab === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="max-w-2xl mx-auto space-y-6">
              {/* ID Card section */}
              <div ref={cardRef} className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-700/50 group select-none transition-all duration-700 max-w-2xl mx-auto">
                {/* Holographic shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-purple-500/10 opacity-50 group-hover:opacity-80 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-10 relative z-10">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <Award className="text-slate-900" size={22} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black tracking-tighter leading-none">STUDENT IDENTITY</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest font-mono">SMK TUTWURI HANDAYANI</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
                    <div className="w-28 h-28 rounded-3xl bg-slate-800 border-2 border-slate-700/50 flex items-center justify-center text-4xl font-black shadow-inner overflow-hidden relative group/avatar">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent"></div>
                      <span className="relative z-10">{activeStudent.name.charAt(0)}</span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-black leading-tight tracking-tight">{activeStudent.name}</h3>
                      <p className="text-sm font-bold text-indigo-300">{activeStudent.detail}</p>
                      <p className="text-[11px] font-mono font-black text-slate-400 mt-2 tracking-widest bg-black/30 px-3 py-1 rounded-xl border border-white/5 inline-block">ID: {activeStudent.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center bg-white p-5 rounded-3xl shadow-2xl">
                    <QRCode value={qrToken} size={110} level="H" />
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-700/50 flex flex-wrap gap-4 justify-between items-center relative z-10">
                   <button onClick={handleDownloadCard} className="flex items-center gap-2.5 h-10 px-5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-[10px] font-black transition-all shadow-xl active:scale-95 group/btn">
                     <Download size={15} />
                     UNDUH KARTU
                   </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">HADIR</span>
                    <p className="text-2xl font-black text-emerald-600">{hadirCount}</p>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">IZIN</span>
                    <p className="text-2xl font-black text-amber-500">{sakitCount + izinCount}</p>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">RATE</span>
                    <p className="text-2xl font-black text-indigo-600">{attendanceRate}%</p>
                 </div>
              </div>
            </div>
          </motion.div>
        ) : portalTab === 'presence' ? (
          <motion.div
            key="presence"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left column: Digital ID Card & Quick Checkin */}
            <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Futuristic Holographic ID Card */}
          <div className="flex flex-col gap-3">
            <div ref={cardRef} className="overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-900 p-5 rounded-3xl text-white shadow-xl shadow-teal-950/20 relative border border-emerald-500/30">
              {/* Background elements */}
              <div className="absolute -right-16 -bottom-16 w-44 h-44 bg-teal-500/10 rounded-full blur-2xl"></div>
              <div className="absolute left-10 top-10 w-20 h-20 bg-emerald-400/10 rounded-full blur-xl"></div>
              <div className="absolute top-4 right-4 w-12 h-12 border border-emerald-400/10 rounded-full flex items-center justify-center font-black text-[20px] text-emerald-400 font-mono select-none">1</div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 font-mono">KARTU DIGITAL SISWA</p>
                  <h4 className="text-sm font-extrabold tracking-short mt-0.5">SMK TUTWURI HANDAYANI</h4>
                </div>
                <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[8.5px] rounded-md border border-emerald-500/30 font-mono">
                  SIAKAD ACTIVE
                </div>
              </div>

              {/* Student Info Section */}
              <div className="flex gap-4 items-center mb-6">
                {/* Profile dummy av */}
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xl text-emerald-200 shadow-md">
                  {activeStudent.name.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-base font-extrabold truncate leading-tight">{activeStudent.name}</h3>
                  <p className="text-xs text-emerald-250 mt-0.5 font-semibold font-mono">Kelas: Rombel {activeStudent.detail}</p>
                  <p className="text-[10px] text-emerald-300 font-bold font-mono tracking-wider mt-0.5">NISN: {activeStudent.id}</p>
                </div>
              </div>

              {/* Custom Interactive Mock QR code block */}
              <div className="bg-white/95 text-slate-800 p-3 rounded-2xl flex items-center justify-between border-t border-emerald-400/20">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    INTEGRATED QR CODE
                  </span>
                  <p className="text-[10px] text-slate-500 leading-tight font-semibold mt-1 max-w-[150px]">
                    Posisikan QR ini di scan kamera pengawas atau mesin absen instan
                  </p>
                </div>
                
                {/* Real QR Code */}
                <div className="bg-white p-1.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-col items-center gap-1" title="Student QR Code">
                  <QRCode value={qrToken} size={55} />
                  <div className="text-[7px] font-black text-indigo-600 font-mono tracking-tighter">
                    ROTATE: {qrTimeLeft}S
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleDownloadCard}
              className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-3 rounded-2xl font-bold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download size={16} className="text-emerald-600" /> Unduh Kartu Pelajar (PNG)
            </button>
          </div>

          {/* Attendance Action Portal */}
          {todayRecord ? (
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl text-center space-y-3">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Terdaftar Berhasil!</h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Anda sudah melakukan absensi harian SMK Tutwuri Handayani, Cimahi hari ini pukul <strong>{formatTimestamp(todayRecord.timestamp).split(' - ')[0]} WIB</strong>.
                </p>
              </div>
              
              <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-center gap-1.5 text-[10px] font-bold text-emerald-700 font-mono">
                <MapPin size={11} /> 
                <span>GPS: DI SEKOLAH ({todayRecord.data.jarak}m)</span>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              {/* Method Switcher Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCheckinMethod('gps')}
                  className={`flex-1 h-11 sm:h-9.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    checkinMethod === 'gps'
                      ? 'bg-white text-slate-900 shadow-sm font-black'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <MapPin size={13} />
                  <span>GPS Geofence</span>
                </button>
                <button
                  id="tour-scanner"
                  type="button"
                  onClick={() => setCheckinMethod('qr')}
                  className={`flex-1 h-11 sm:h-9.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    checkinMethod === 'qr'
                      ? 'bg-emerald-600 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-emerald-600'
                  }`}
                >
                  <QrCode size={13} />
                  <span>Contactless QR Scan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckinMethod('my_id')}
                  className={`flex-1 h-11 sm:h-9.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    checkinMethod === 'my_id'
                      ? 'bg-indigo-600 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-indigo-600'
                  }`}
                >
                  <Smartphone size={13} />
                  <span>ID Antrean Saya</span>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {checkinMethod === 'my_id' ? (
                  <motion.div
                    key="my_id"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 border border-slate-800 shadow-xl relative overflow-hidden my-2"
                  >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest font-black border border-indigo-500/30">
                    <QrCode size={12} className="animate-pulse" /> ID DIGITAL ANTREAN PRESENSI
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">{activeStudent.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">NIS: {activeStudent.id} • Kelas {activeStudent.detail}</p>
                  </div>
                  
                  {/* Big QR Code Container */}
                  <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-indigo-500/30 transition-all transform hover:scale-105">
                    <QRCode value={qrToken} size={180} />
                  </div>
                  
                  <div className="space-y-1 w-full max-w-[240px]">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                      <span>Diperbarui otomatis</span>
                      <span className="text-indigo-400">{qrTimeLeft} detik</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full transition-all duration-1000 ease-linear rounded-full" 
                        style={{ width: `${(qrTimeLeft / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 max-w-[280px] leading-relaxed">
                    Tunjukkan QR Code ini kepada guru piket atau tempelkan pada scanner antrean gerbang sekolah untuk absensi instan.
                  </p>
                  </motion.div>
                ) : checkinMethod === 'qr' ? (
                  <motion.div
                    key="qr"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                  <div className="flex gap-2">
                    <Camera className="text-emerald-600 mt-0.5 shrink-0" size={16} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Scan QR Code Sekolah</h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">Arahkan kamera ke barcode poster/layar presensi di sekolah untuk check-in instan</p>
                    </div>
                  </div>
                  
                  <QrScanner 
                    activeTab="murid" 
                    onScanSuccess={handleQrScanSuccess} 
                    onClose={() => setCheckinMethod('gps')} 
                  />
                  </motion.div>
                ) : (
                  <motion.div
                    key="gps"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                  <div className="flex gap-2 mb-3">
                    <Smartphone className="text-indigo-600 mt-0.5 shrink-0" size={16} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Form Mandiri Siswa (GPS-Fence)</h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">Sistem akan memancarkan verifikasi sensor koordinat sekolah otomatis</p>
                    </div>
                  </div>

                  <div id="tour-maps" className="h-[180px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative mb-4" style={{ zIndex: 0 }}>
                    <MapContainer center={[-6.8837, 107.5451]} zoom={17} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Circle center={[-6.8837, 107.5451]} radius={100} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 }} />
                      <Marker position={[-6.8837, 107.5451]}>
                        <Popup className="font-sans text-xs">
                          <strong>SMK Tutwuri Handayani</strong><br/>Titik Pusat Sekolah
                        </Popup>
                      </Marker>
                      {/* User Current Position */}
                      {userPos && (
                        <Marker position={userPos}>
                          <Popup className="font-sans text-xs">
                            <div className="font-bold text-emerald-600">Posisi Anda</div>
                            <div className="text-[10px] text-slate-500">Real-time GPS Tracking</div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>

                  <form onSubmit={handleSelfCheckin} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                        Status Kehadiran
                      </label>
                      <div className="grid grid-cols-3 gap-2 text-xs font-bold font-mono">
                        {(['Hadir', 'Sakit', 'Izin'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            className={`h-11 sm:h-9.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center ${
                              status === s 
                                ? 'bg-emerald-600 border-emerald-650 text-white font-extrabold shadow-sm'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                      <div className="flex items-center gap-2 mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <input
                          type="checkbox"
                          id="simRadius"
                          checked={simulateOutOfRadius}
                          onChange={(e) => setSimulateOutOfRadius(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <label htmlFor="simRadius" className="text-[10px] sm:text-xs font-semibold text-slate-600 cursor-pointer">
                          Override GPS (Untuk Presensi Remote/Tugas Luar)
                        </label>
                      </div>

                    {status !== 'Hadir' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                            Lampiran Keterangan {status === 'Sakit' ? 'Sakit' : 'Izin'}
                          </label>
                          <textarea
                            required
                            placeholder={`Contoh: ${status === 'Sakit' ? 'Sakit demam tinggi surat dokter disusul' : 'Keperluan pernikahan kakak kandung di luar kota'}`}
                            value={keterangan}
                            onChange={(e) => setKeterangan(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 min-h-[50px] font-medium placeholder:text-slate-400 resize-none"
                          />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                             Unggah Berkas Keterangan / Surat Sakit
                           </label>
                           <input type="file" className="text-xs w-full text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" accept="image/*,.pdf" />
                        </div>
                      </div>
                    )}

                    {userPos && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs font-mono shadow-sm group"
                      >
                        <span className="text-slate-500 font-semibold flex items-center gap-2 font-sans">
                          <MapPin size={15} className="text-indigo-600 animate-bounce" />
                          <span className="group-hover:text-indigo-600 transition-colors">Real-time Distance ke Sekolah:</span>
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-lg text-indigo-700 leading-none">
                            {Math.round(calculateDistance(-6.8837, 107.5451, userPos[0], userPos[1]))}
                            <span className="text-[10px] ml-0.5 uppercase tracking-tighter">m</span>
                          </span>
                          <span className="text-[8px] text-indigo-400 font-bold uppercase mt-0.5">Lokasi Terkini</span>
                        </div>
                      </motion.div>
                    )}

                    {antiCheatStatus === 'idle' ? (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={16} />
                        Submit Presensi Saya
                      </button>
                    ) : (
                      <div className="w-full bg-slate-900 rounded-xl p-3 shadow-inner border border-slate-800 overflow-hidden relative">
                        {/* Scanning beam effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 translate-y-[-100%] animate-[scan_1.5s_ease-in-out_infinite]" />
                        
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                          <Cpu size={20} className={`${antiCheatStatus === 'analyzing' ? 'text-indigo-400 animate-pulse' : outOfRadiusAlert ? 'text-rose-500' : 'text-emerald-400'}`} />
                          <div>
                            <h4 className={`text-xs font-bold uppercase tracking-wider font-mono ${outOfRadiusAlert ? 'text-rose-400' : 'text-white'}`}>
                              {antiCheatStatus === 'analyzing' ? 'System Integrity Check' : outOfRadiusAlert ? 'Lokasi Tidak Valid' : 'Validation Sequence Complete'}
                            </h4>
                          </div>
                        </div>
                        
                        <div className="space-y-1 mt-3 pl-10 relative z-10">
                          {antiCheatLogs.map((log, index) => (
                            <p key={index} className="text-[10px] text-slate-300 font-mono animate-fadeIn">
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

        </div>

        {/* Right column: Progress rate & Attendance Logs */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Attendance Stats Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 text-center flex flex-col justify-between min-h-[90px] sm:min-h-0 shadow-sm">
              <span className="text-[8px] min-[380px]:text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Rincian Hari</span>
              <p className="text-lg sm:text-xl font-black text-indigo-950 my-0.5 sm:mt-1 font-mono">{totalSubmissions}</p>
              <p className="text-[8px] min-[380px]:text-[8.5px] text-slate-400 font-semibold truncate">Pencatatan Aktif</p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 text-center flex flex-col justify-between min-h-[90px] sm:min-h-0 shadow-sm">
              <span className="text-[8px] min-[380px]:text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Rasio Hadir</span>
              <p className="text-lg sm:text-xl font-black text-emerald-600 my-0.5 sm:mt-1 font-mono">{attendanceRate}%</p>
              <p className="text-[8px] min-[380px]:text-[8.5px] text-emerald-500 font-bold truncate">Hadir: {hadirCount}x</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 text-center flex flex-col justify-between min-h-[90px] sm:min-h-0 shadow-sm">
              <span className="text-[8px] min-[380px]:text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Sakit / Izin</span>
              <p className="text-lg sm:text-xl font-black text-amber-600 my-0.5 sm:mt-1 font-mono">{sakitCount + izinCount}</p>
              <p className="text-[8px] min-[380px]:text-[8.5px] text-amber-500 font-medium truncate">S:{sakitCount}x | I:{izinCount}x</p>
            </div>
          </div>

          {/* Student Specific Timeline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <FileText size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Jurnal Historis Absensi Saya</h3>
                  <p className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Hanya menampilkan riwayat Anda untuk menjaga integritas data</p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-250/20 text-xs font-black self-start sm:self-auto gap-1">
                <button
                  type="button"
                  onClick={() => setShow30DaysHistory(true)}
                  className="px-4 h-11 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer text-slate-400 hover:text-indigo-600 font-black"
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-4 h-11 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-sm font-black'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 h-11 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    viewMode === 'calendar'
                      ? 'bg-white text-emerald-950 shadow-sm font-black'
                      : 'text-slate-400 hover:text-emerald-600'
                  }`}
                >
                  Kalender
                </button>
              </div>
            </div>

            {/* Filter & Search Bar - List View Only */}
            {viewMode === 'list' && (
              <div className="flex flex-col sm:flex-row gap-2.5 mb-4 items-center">
                <div className="relative w-full flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Cari absensi berdasarkan tanggal atau keterangan..."
                    className="w-full h-11 sm:h-9.5 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
                  />
                </div>
                <div className="w-full sm:w-auto shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline font-mono">Filter Status:</span>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                    className="w-full sm:w-40 h-11 sm:h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-705 focus:outline-none cursor-pointer transition-all"
                  >
                    <option value="All">Semua Status</option>
                    <option value="Hadir">Hadir</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                  </select>
                </div>
              </div>
            )}

            {viewMode === 'list' ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto w-full md:block hidden">
                  <table className="w-full text-left text-[10.5px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-200">
                      <tr>
                        <th className="px-3 py-2 w-8 text-center text-slate-300">#</th>
                        <th className="px-3 py-2">Waktu Catat</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2">Keterangan</th>
                        <th className="px-3 py-2 text-center">Jarak GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-600">
                      {studentRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                            Belum ada riwayat terekam untuk pelajar ini.
                          </td>
                        </tr>
                      ) : filteredStudentRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-450 italic font-semibold">
                            Tidak ada riwayat absensi yang cocok dengan filter pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        filteredStudentRecords.map((r, i) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 text-center font-bold font-mono">{i + 1}</td>
                            <td className="px-3 py-2 font-mono">{formatTimestamp(r.timestamp)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8.5px] ${
                                r.data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 font-extrabold' :
                                r.data.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-850'
                              }`}>
                                {r.data.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 truncate max-w-[150px] text-slate-500" title={r.data.keterangan}>
                              {r.data.keterangan}
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-slate-500">
                              {r.data.jarak !== undefined ? `${r.data.jarak}m` : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden max-h-[300px] overflow-y-auto bg-slate-50/50 p-2 space-y-2">
                  {studentRecords.length === 0 ? (
                     <div className="text-center py-6 text-[11px] text-slate-400 italic border border-slate-100 bg-white rounded-xl">
                       Belum ada riwayat terekam.
                     </div>
                  ) : filteredStudentRecords.length === 0 ? (
                     <div className="text-center py-6 text-[11px] text-slate-450 italic font-semibold border border-slate-100 bg-white rounded-xl">
                       Tidak ada riwayat yang cocok.
                     </div>
                  ) : (
                    filteredStudentRecords.map((r, i) => (
                      <div key={r.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-xs font-semibold text-slate-700">
                            {formatTimestamp(r.timestamp).split(',')[0]}
                            <span className="text-slate-400 font-normal ml-1 text-[10px]">{formatTimestamp(r.timestamp).split(',')[1]}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                            r.data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            r.data.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-850'
                          }`}>
                            {r.data.status}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] items-start pt-1.5 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Catatan</span>
                            <span className="text-slate-600 truncate max-w-[150px]">{r.data.keterangan || '-'}</span>
                          </div>
                          
                          {r.data.jarak !== undefined && (
                            <div className="flex flex-col ml-auto text-right">
                              <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Koordinat</span>
                              <span className="text-slate-500 font-mono">{r.data.jarak}m</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                {/* Month navigation header */}
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonth(currentMonth - 1);
                      }
                      setSelectedDay(null);
                    }}
                    className="p-1 px-3 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-705 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer font-bold font-mono text-xs"
                  >
                    &larr;
                  </button>
                  <span className="text-xs font-black text-slate-800 font-sans tracking-tight">
                    {INDO_MONTHS[currentMonth]} {currentYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonth(currentMonth + 1);
                      }
                      setSelectedDay(null);
                    }}
                    className="p-1 px-3 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-705 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer font-bold font-mono text-xs"
                  >
                    &rarr;
                  </button>
                </div>

                {/* Calendar days grid */}
                <div className="border border-slate-100 rounded-2xl p-3 bg-white shadow-sm shadow-slate-100/50">
                  {/* Days of week */}
                  <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-2">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(dayName => (
                      <div key={dayName} className="py-1">{dayName}</div>
                    ))}
                  </div>

                  {/* Day numbers */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((cell, idx) => {
                      const isSel = cell.isCurrentMonth && selectedDay === cell.dayNum;
                      let cellStatus: 'Hadir' | 'Sakit' | 'Izin' | 'Libur' | 'Kosong' | 'MasaDepan' = 'Kosong';
                      let rec: any = null;
                      
                      if (cell.isCurrentMonth) {
                        rec = getDayRecord(cell.dayNum);
                        const cellDate = new Date(currentYear, currentMonth, cell.dayNum);
                        const targetToday = new Date(2026, 5, 15); // June 15, 2026
                        const dayOfWeek = cellDate.getDay();
                        
                        if (rec) {
                          cellStatus = rec.data.status;
                        } else if (cellDate > targetToday) {
                          cellStatus = 'MasaDepan';
                        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                          cellStatus = 'Libur';
                        } else {
                          cellStatus = 'Kosong';
                        }
                      }

                      let bgClass = 'bg-slate-50/50 text-slate-300 cursor-not-allowed';
                      let borderClass = 'border-transparent';

                      if (cell.isCurrentMonth) {
                        if (cellStatus === 'Hadir') {
                          bgClass = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 cursor-pointer font-bold';
                          borderClass = 'border-emerald-250';
                        } else if (cellStatus === 'Sakit') {
                          bgClass = 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 cursor-pointer font-bold';
                          borderClass = 'border-amber-250';
                        } else if (cellStatus === 'Izin') {
                          bgClass = 'bg-sky-50 text-sky-700 hover:bg-sky-100/80 cursor-pointer font-bold';
                          borderClass = 'border-sky-250';
                        } else if (cellStatus === 'MasaDepan') {
                          bgClass = 'bg-slate-50/25 text-slate-300/70 cursor-not-allowed font-light';
                        } else if (cellStatus === 'Libur') {
                          bgClass = 'bg-rose-50/20 text-rose-505 hover:bg-rose-50/50 cursor-pointer font-semibold';
                          borderClass = 'border-dashed border-rose-100/60';
                        } else {
                          // Kosong (Alpa)
                          bgClass = 'bg-slate-50 text-slate-400 hover:bg-slate-100/80 cursor-pointer font-medium';
                          borderClass = 'border-slate-200/50';
                        }
                      }

                      const selectedClass = isSel
                        ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.05] z-10 shadow-sm'
                        : '';

                      return (
                        <button
                          key={`${cell.monthOffset}-${cell.dayNum}-${idx}`}
                          type="button"
                          disabled={!cell.isCurrentMonth || cellStatus === 'MasaDepan'}
                          onClick={() => {
                            if (cell.isCurrentMonth && cellStatus !== 'MasaDepan') {
                              setSelectedDay(cell.dayNum);
                            }
                          }}
                          className={`aspect-square sm:p-1.5 p-1 text-[10.5px] rounded-xl border flex flex-col items-center justify-center transition-all ${bgClass} ${borderClass} ${selectedClass}`}
                        >
                          <span className="font-mono">{cell.dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Legend explanation row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 mt-2 text-[9px] font-bold font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-250 inline-block"></span>
                    <span className="text-slate-500">Hadir</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-250 inline-block"></span>
                    <span className="text-slate-500">Sakit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-sky-50 border border-sky-250 inline-block"></span>
                    <span className="text-slate-500">Izin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-slate-50 border border-slate-200 inline-block"></span>
                    <span className="text-slate-500">Alpa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-100 inline-block"></span>
                    <span className="text-slate-500">Libur</span>
                  </div>
                </div>

                {/* Interactive Day Description Panel */}
                {selectedDay !== null && (() => {
                  const dayRec = getDayRecord(selectedDay);
                  const cellDate = new Date(currentYear, currentMonth, selectedDay);
                  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                  const formattedDate = cellDate.toLocaleDateString('id-ID', options);
                  const dayOfWeek = cellDate.getDay();
                  const targetToday = new Date(2026, 5, 15);
                  
                  let statusLabel = '';
                  let statusStyles = '';
                  let explanationText = '';
                  
                  if (dayRec) {
                    statusLabel = dayRec.data.status;
                    statusStyles = dayRec.data.status === 'Hadir' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                  dayRec.data.status === 'Sakit' ? 'text-amber-700 bg-amber-50 border-amber-200' : 
                                  'text-sky-700 bg-sky-50 border-sky-200';
                    explanationText = `Siswa tercatat hadir presensi harian pada jam ${new Date(dayRec.timestamp).toLocaleTimeString('id-ID')} WIB. Keterangan status: ${dayRec.data.keterangan || '-'}.`;
                  } else if (cellDate > targetToday) {
                    statusLabel = 'Masa Depan';
                    statusStyles = 'text-slate-400 bg-slate-50 border-slate-200';
                    explanationText = 'Kegiatan belajar mengajar belum dimulai. Kehadiran akan tercatat otomatis saat siswa check-in harian.';
                  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                    statusLabel = 'Akhir Pekan';
                    statusStyles = 'text-rose-500 bg-rose-50 border-rose-200';
                    explanationText = 'Hari libur akhir pekan resmi SMK Tutwuri Handayani, Cimahi (Sabtu / Minggu). Tidak ada kewajiban presensi.';
                  } else {
                    statusLabel = 'Alpa (Tanpa Keterangan)';
                    statusStyles = 'text-red-700 bg-red-50 border-red-150';
                    explanationText = 'Tidak terdeteksi adanya log check-in GPS ataupun verifikasi QR. Siswa diklasifikasikan Alpha pada hari aktif sekolah ini.';
                  }
                  
                  return (
                    <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-2xl animate-fadeIn text-[10.5px]">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="font-extrabold text-slate-705">{formattedDate}</span>
                            <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black ${statusStyles}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-slate-500 leading-relaxed font-semibold">
                            {explanationText}
                          </p>
                          {dayRec && (
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-slate-400 font-bold">
                              <div>Waktu: <span className="text-slate-600 font-black">{new Date(dayRec.timestamp).toLocaleTimeString('id-ID')} WIB</span></div>
                              <div>Keterangan: <span className="text-slate-600 font-black truncate block">{dayRec.data.keterangan || '-'}</span></div>
                              <div>GPS Jarak: <span className="text-slate-600 font-black">{dayRec.data.jarak !== undefined ? `${dayRec.data.jarak}m` : '-'}</span></div>
                              <div>Akurasi: <span className="text-slate-600 font-black">±7 meter</span></div>
                              <div className="col-span-2 mt-1 bg-slate-100 p-1 rounded border border-slate-200/50 text-[8.5px]">
                                LAT: <span className="text-slate-700 font-extrabold">{dayRec.data.latitude?.toFixed(6) || '-'}</span> | LNG: <span className="text-slate-700 font-extrabold">{dayRec.data.longitude?.toFixed(6) || '-'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Visual Geofence Map Snippet */}
                        {dayRec && dayRec.data.latitude && !isNaN(dayRec.data.latitude) ? (() => {
                          const isWithin = dayRec.data.isWithinRadius;
                          const distance = dayRec.data.jarak || 0;
                          
                          // Calculate check-in point coordinates in the 120x120 SVG space
                          // School center is at (60, 60)
                          // Radius circle of 100m geofence represented by radius = 35px in SVG
                          // Point offset depends on distance (e.g. 0m -> 0px, 100m -> 35px, 200m -> 70px)
                          const mapScale = 35 / 50; 
                          const offsetPx = Math.min(52, distance * mapScale);
                          // Angle based on timestamp to make different records have unique positions
                          const angleRad = (new Date(dayRec.timestamp).getMinutes() * 6) * (Math.PI / 180);
                          const userX = 60 + Math.cos(angleRad) * offsetPx;
                          const userY = 60 + Math.sin(angleRad) * offsetPx;

                          return (
                            <div className="w-full sm:w-[130px] shrink-0 flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-xl p-2 text-white relative overflow-hidden h-[155px] sm:h-[135px] shadow-inner select-none">
                              {/* Background grid representation */}
                              <div className="absolute inset-0 bg-slate-950 opacity-40 mix-blend-overlay pointer-events-none" style={{
                                backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
                                backgroundSize: '12px 12px'
                              }} />
                              
                              <svg className="w-[100px] h-[100px] relative z-[1]" viewBox="0 0 120 120">
                                {/* Soft radar sweep circle */}
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                                
                                {/* Geofence circle */}
                                <circle 
                                  cx="60" 
                                  cy="60" 
                                  r="35" 
                                  fill={isWithin ? "rgba(16, 185, 129, 0.05)" : "rgba(245, 158, 11, 0.03)"} 
                                  stroke={isWithin ? "#10b981" : "#f59e0b"} 
                                  strokeWidth="1.5" 
                                  strokeDasharray={isWithin ? "none" : "3 2"}
                                />
                                
                                <text x="60" y="20" textAnchor="middle" fill={isWithin ? "#a7f3d0" : "#fde68a"} fontSize="6.5" fontWeight="black" fontFamily="monospace">
                                  {isWithin ? "GEOFENCE IN" : "GEOFENCE OUT"}
                                </text>

                                {/* School Center Marker */}
                                <circle cx="60" cy="60" r="4.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1" />
                                <circle cx="60" cy="60" r="1.5" fill="#ffffff" />
                                
                                {/* Connector Line */}
                                <line 
                                  x1="60" 
                                  y1="60" 
                                  x2={userX} 
                                  y2={userY} 
                                  stroke={isWithin ? "#10b981" : "#ef4444"} 
                                  strokeWidth="1" 
                                  strokeDasharray="2 2" 
                                />
                                
                                {/* User Check-In Marker */}
                                <g className="animate-pulse">
                                  <circle 
                                    cx={userX} 
                                    cy={userY} 
                                    r="6.5" 
                                    fill={isWithin ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"} 
                                  />
                                </g>
                                <circle 
                                  cx={userX} 
                                  cy={userY} 
                                  r="3.5" 
                                  fill={isWithin ? "#10b981" : "#ef4444"} 
                                  stroke="#ffffff" 
                                  strokeWidth="0.75" 
                                />
                              </svg>

                              {/* Tiny descriptive labels */}
                              <div className="mt-1 relative z-10 w-full flex items-center justify-between text-[7px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-1">
                                <span className="truncate">SMK Tutwuri</span>
                                <span className={isWithin ? "text-emerald-400" : "text-amber-400"}>{distance}m</span>
                              </div>
                            </div>
                          );
                        })() : (
                          // Placeholder inside when check-in lacks GPS (e.g. excuse, manually logged, or weekend)
                          <div className="w-full sm:w-[130px] shrink-0 flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-center text-slate-350 h-[105px] sm:h-[135px] select-none">
                            <Compass size={22} className="text-slate-300 stroke-[1.5] mb-1.5 animate-spin-slow" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tanpa GPS</span>
                            <span className="text-[7px] font-semibold text-slate-400/80 mt-0.5 leading-tight block">Sakit, Izin, atau Libur</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
