/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  MapPin, 
  CheckCircle2, 
  FileText,
  Smartphone,
  Scan,
  Compass,
  AlertCircle,
  Clock,
  UserCheck,
  Camera,
  QrCode,
  Search,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Mic,
  MicOff,
  MessageCircle
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
import { SimulatedRecord, TeacherAttendance } from '../types';
import { registeredMembers } from '../data/directory';
import QrScanner from './QrScanner';
import QRCode from 'react-qr-code';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Swal from 'sweetalert2';

interface TeacherPortalProps {
  records: SimulatedRecord[];
  onAddRecord: (type: 'murid' | 'guru', data: any) => void;
  selectedTeacherId: string;
  onTeacherIdChange: (id: string) => void;
}

export default function TeacherPortal({ 
  records, 
  onAddRecord, 
  selectedTeacherId, 
  onTeacherIdChange 
}: TeacherPortalProps) {
  const [status, setStatus] = useState<'Hadir' | 'Sakit' | 'Izin'>('Hadir');
  const [keterangan, setKeterangan] = useState('');
  const [catatan, setCatatan] = useState('');
  
  // Voice-to-Text Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const startVoiceInput = () => {
    setSpeechError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechError("Browser Anda tidak mendukung perekaman suara.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID'; // Indonesian Language preset
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setSpeechError("Akses mikrofon ditolak. Mohon izinkan mikrofon.");
        } else {
          setSpeechError(`Error perekaman: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const formattedTranscript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
          setKeterangan(prev => prev ? `${prev} ${formattedTranscript}` : formattedTranscript);
        }
      };

      recognition.start();
    } catch (e: any) {
      console.error(e);
      setSpeechError("Gagal memulai perekaman.");
      setIsListening(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkinMethod, setCheckinMethod] = useState<'gps' | 'qr'>('gps');
  const [useCameraScanner, setUseCameraScanner] = useState(false);
  const [portalTab, setPortalTab] = useState<'dashboard' | 'presence' | 'scanner' | 'qr-display' | 'history'>('dashboard');
  const [dynamicQrSeed, setDynamicQrSeed] = useState(Date.now().toString());

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (portalTab === 'qr-display') {
      interval = setInterval(() => {
        setDynamicQrSeed(Date.now().toString());
      }, 15000); // refresh every 15s
    }
    return () => clearInterval(interval);
  }, [portalTab]);
  const [antiCheatStatus, setAntiCheatStatus] = useState<'idle' | 'analyzing' | 'passed' | 'failed'>('idle');
  const [antiCheatLogs, setAntiCheatLogs] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'walikelas'>('list');
  const [show30DaysHistory, setShow30DaysHistory] = useState(false);
  const [history30DaysFilter, setHistory30DaysFilter] = useState<'All' | 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>('All');
  const [currentMonth, setCurrentMonth] = useState(5); // Default to June (index 5)
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(15);
  const [walikelasFilter, setWalikelasFilter] = useState<'Semua' | 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>('Semua');

  const handleTeacherQrScanSuccess = (data: any) => {
    setIsSubmitting(true);
    const distanceMeter = Math.floor(Math.random() * 5) + 1; // 1 to 5 meters since physically at QR poster

    const checkInData = {
      timestamp: new Date().toISOString(),
      nip: activeTeacher.id,
      nama: activeTeacher.name,
      jabatan: activeTeacher.detail,
      status: 'Hadir',
      keterangan: 'Hadir via Contactless QR Check-In (GTK Lobby)',
      latitude: -6.168491,
      longitude: 106.833160,
      jarak: distanceMeter,
      isWithinRadius: true
    };

    setTimeout(() => {
      onAddRecord('guru', checkInData);
      setIsSubmitting(false);
      setCheckinMethod('gps'); // reset back to gps form
    }, 600);
  };

  const handleStudentQrScanSuccess = (data: {
    type?: 'murid' | 'guru';
    id: string;
    nama?: string;
    kelasOrJabatan?: string;
  }) => {
    setIsScanning(true);
    setScanNotice(null);

    // Let's find the student scanned
    const targetStudent = registeredMembers.find(m => m.id === data.id && m.role === 'murid');
    if (!targetStudent) {
      setIsScanning(false);
      setScanNotice(`Scan Gagal: Siswa dengan NISN "${data.id}" tidak terdaftar di sistem SMK Tutwuri Handayani.`);
      setTimeout(() => setScanNotice(null), 6000);
      return;
    }

    const studentCheckInData = {
      timestamp: new Date().toISOString(),
      nis: targetStudent.id,
      nama: targetStudent.name,
      kelas: targetStudent.detail,
      status: 'Hadir', // always default to 'Hadir' when scanned, or we can use scannedStatus
      keterangan: 'Hadir via Contactless Kamera Scanner Guru',
      latitude: -6.168495,
      longitude: 106.833152,
      jarak: 1, // very close because scanned by teacher physically
      isWithinRadius: true
    };

    setTimeout(() => {
      onAddRecord('murid', studentCheckInData);
      setIsScanning(false);
      setUseCameraScanner(false); // Close scanner after success scan!
      setScanNotice(`Berhasil memindai QR! Siswa "${targetStudent.name}" (${targetStudent.detail}) telah dicatat berstatus "Hadir" melalui scanner kamera.`);
      // Clear notice after 6 seconds
      setTimeout(() => setScanNotice(null), 6000);
    }, 800);
  };

  // Scanner Simulator State
  const [scannedStudentId, setScannedStudentId] = useState('12998374');
  const [scannedStatus, setScannedStatus] = useState<'Hadir' | 'Sakit' | 'Izin'>('Hadir');
  const [scannedKeterangan, setScannedKeterangan] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const activeTeacher = registeredMembers.find(m => m.id === selectedTeacherId && m.role === 'guru');
  
  if (!activeTeacher) return null;

  // Personal statistics
  const teacherRecords = records.filter(r => r.type === 'guru' && (r.data as any).nip === selectedTeacherId);
  const totalSubmissions = teacherRecords.length;
  const hadirCount = teacherRecords.filter(r => r.data.status === 'Hadir').length;
  const sakitCount = teacherRecords.filter(r => r.data.status === 'Sakit').length;
  const izinCount = teacherRecords.filter(r => r.data.status === 'Izin').length;
  
  const attendanceRate = totalSubmissions > 0 
    ? Math.round((hadirCount / totalSubmissions) * 100) 
    : 100;

  // Indonesian months definition
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
    return teacherRecords.find(r => {
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
    const record = teacherRecords.find(r => new Date(r.timestamp).toDateString() === dateStr);
    
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
  const todayRecord = teacherRecords.find(r => new Date(r.timestamp).toDateString() === todayStr);

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
      setAntiCheatLogs(prev => [...prev, '✅ Integritas perangkat tervalidasi']);
      
      const distanceMeter = Math.floor(Math.random() * 15) + 4; // 4 to 19 meters

      const checkInData = {
        timestamp: new Date().toISOString(),
        nip: activeTeacher.id,
        nama: activeTeacher.name,
        jabatan: activeTeacher.detail,
        status,
        keterangan: status === 'Hadir' ? '-' : keterangan || 'Izin dinas',
        catatan: catatan || '-',
        latitude: -6.168491,
        longitude: 106.833160,
        jarak: distanceMeter,
        isWithinRadius: true
      };

      setTimeout(() => {
        onAddRecord('guru', checkInData);
        setKeterangan('');
        setCatatan('');
        setIsSubmitting(false);
        setAntiCheatStatus('idle');
      }, 600);
      
    }, 1600);
  };

  const handleScanStudentId = (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setScanNotice(null);

    const targetStudent = registeredMembers.find(m => m.id === scannedStudentId && m.role === 'murid');
    if (!targetStudent) return;

    const studentCheckInData = {
      timestamp: new Date().toISOString(),
      nis: targetStudent.id,
      nama: targetStudent.name,
      kelas: targetStudent.detail,
      status: scannedStatus,
      keterangan: scannedStatus === 'Hadir' ? '-' : scannedKeterangan || 'Diinput oleh guru',
      latitude: -6.168495,
      longitude: 106.833152,
      jarak: 3, // very close because scanned by teacher
      isWithinRadius: true
    };

    setTimeout(() => {
      onAddRecord('murid', studentCheckInData);
      setScannedKeterangan('');
      setIsScanning(false);
      setScanNotice(`Berhasil memindai ID! Siswa "${targetStudent.name}" (${targetStudent.detail}) telah dicatat berstatus "${scannedStatus}" dalam spreadsheet siswa.`);
      setTimeout(() => setScanNotice(null), 6000);
    }, 800);
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
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Riwayat Presensi Pendidik (30 Hari)</h3>
                  <p className="text-[10px] font-semibold text-slate-500 font-mono mt-0.5">{activeTeacher.name} - {activeTeacher.detail}</p>
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

      {/* Account Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <GraduationCap size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Switch Akun Pendidik</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Pilih pendidik lain untuk mengisi presensi</p>
          </div>
        </div>
        <select
          value={selectedTeacherId}
          onChange={(e) => onTeacherIdChange(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 md:h-10 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-550/20 text-slate-700 cursor-pointer font-sans w-full md:w-64"
        >
          {registeredMembers.filter(m => m.role === 'guru').map(teacher => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name} ({teacher.detail})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full gap-1">
        <button
          type="button"
          className={`px-2 sm:px-5 flex items-center justify-center gap-1.5 h-11 text-[11px] sm:text-xs font-bold rounded-xl transition-all truncate ${portalTab === 'dashboard' ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/50 border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('dashboard')}
        >
          <LayoutDashboard size={16} className="shrink-0" />
          <span className="truncate">Dashboard</span>
        </button>
        <button
          type="button"
          className={`px-2 sm:px-5 flex items-center justify-center gap-1.5 h-11 text-[11px] sm:text-xs font-bold rounded-xl transition-all truncate ${portalTab === 'presence' ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/50 border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('presence')}
        >
          <UserCheck size={16} className="shrink-0" />
          <span className="truncate">Presensi</span>
        </button>
        <button
          type="button"
          className={`px-2 sm:px-5 flex items-center justify-center gap-1.5 h-11 text-[11px] sm:text-xs font-bold rounded-xl transition-all truncate ${portalTab === 'history' ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/50 border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('history')}
        >
          <FileText size={16} className="shrink-0" />
          <span className="truncate">Riwayat</span>
        </button>
        <button
          type="button"
          className={`px-2 sm:px-5 flex items-center justify-center gap-1.5 h-11 text-[11px] sm:text-xs font-bold rounded-xl transition-all truncate ${portalTab === 'scanner' ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/50 border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('scanner')}
        >
          <Camera size={16} className="shrink-0" />
          <span className="truncate">Scanner</span>
        </button>
        <button
          type="button"
          className={`px-2 sm:px-5 flex items-center justify-center gap-1.5 h-11 text-[11px] sm:text-xs font-bold rounded-xl transition-all truncate ${portalTab === 'qr-display' ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/50 border border-slate-200/40' : 'text-slate-500 hover:text-slate-700 cursor-pointer hover:bg-white/40'}`}
          onClick={() => setPortalTab('qr-display')}
        >
          <QrCode size={16} className="shrink-0" />
          <span className="truncate">QR Kode</span>
        </button>
      </div>

      {/* Portal Tabs Content Wrapper */}
      <AnimatePresence mode="wait">
        {portalTab === 'qr-display' ? (
          <motion.div
            key="qr-display"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center py-16"
          >
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <QrCode size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 font-sans tracking-tight">QR Absensi Dinamis Kelas</h2>
            <p className="text-slate-500 font-medium max-w-md mx-auto mb-8 leading-relaxed">
              Pancarkan layar ini ke proyektor kelas. Siswa dapat menggunakan fitur <strong>Scanner Mandiri</strong> di gawai mereka untuk melakukan presensi. Kode ini akan diperbarui otomatis setiap 15 detik untuk menghindari kecurangan rekam jarak jauh.
            </p>
            
            <div className="p-4 bg-white border-[8px] border-indigo-600 rounded-3xl shadow-xl shadow-indigo-600/20 relative mx-auto transform transition-all duration-500 hover:scale-105 inline-block">
              <QRCode value={`{"classId": "${activeTeacher.detail}", "seed": "${dynamicQrSeed}", "type": "dynamic-class-qr"}`} size={240} fgColor="#1e1b4b" />
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase font-black tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap shadow-md">
                Valid for SMK Tutwuri
              </div>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <Clock size={14} className="animate-spin-slow text-indigo-500" />
              Generating refresh token &lt; {dynamicQrSeed.slice(-4)} &gt;
            </div>
          </motion.div>
        ) : portalTab === 'history' ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Teacher Specific Logs Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                    <FileText size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Jurnal Kehadiran Pribadi Guru</h3>
                    <p className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Hanya memuat daftar masuk NIP Anda pribadi</p>
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
                        ? 'bg-white text-indigo-950 shadow-sm font-black'
                        : 'text-slate-400 hover:text-indigo-600'
                    }`}
                  >
                    Kalender
                  </button>
                  {activeTeacher.detail.includes('Wali Kelas') && (
                    <button
                      type="button"
                      onClick={() => setViewMode('walikelas')}
                      className={`px-4 h-11 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        viewMode === 'walikelas'
                          ? 'bg-rose-500 text-white shadow-sm font-black'
                          : 'text-slate-400 hover:text-rose-600'
                      }`}
                    >
                      Wali Kelas
                    </button>
                  )}
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto w-full">
                    <table className="w-full text-left text-[10.5px]">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-200">
                        <tr>
                          <th className="px-3 py-2 w-8 text-center text-slate-300">#</th>
                          <th className="px-3 py-2">Waktu Catat</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2">Catatan Dinas</th>
                          <th className="px-3 py-2 text-center">Jarak GPS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-600">
                        {teacherRecords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                              Belum ada riwayat terekam untuk pendidik ini.
                            </td>
                          </tr>
                        ) : (
                          teacherRecords.map((r, i) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-2 text-slate-400 text-center font-bold font-mono">{i + 1}</td>
                              <td className="px-3 py-2 font-mono">{formatTimestamp(r.timestamp)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8.5px] ${
                                  r.data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 font-extrabold' :
                                  r.data.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                                }`}>
                                  {r.data.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 truncate max-w-[150px] text-slate-500" title={r.data.keterangan}>
                                {r.data.keterangan}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-slate-400">{r.data.jarak}m</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : viewMode === 'calendar' ? (
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                  <div className="p-3 bg-indigo-900 text-white flex items-center justify-between">
                    <button onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">&lt;</button>
                    <h4 className="text-xs font-black uppercase tracking-widest">{INDO_MONTHS[currentMonth]} {currentYear}</h4>
                    <button onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">&gt;</button>
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-slate-200 border-b border-slate-200">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                      <div key={d} className="bg-slate-50 py-2 text-center text-[9px] font-bold text-slate-400 uppercase">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-slate-200">
                    {calendarDays.map((cell, idx) => {
                      const record = cell.isCurrentMonth ? getDayRecord(cell.dayNum) : null;
                      return (
                        <div 
                          key={idx} 
                          className={`min-h-[60px] bg-white p-1 relative flex flex-col items-center justify-start ${!cell.isCurrentMonth ? 'opacity-30 grayscale' : ''}`}
                        >
                          <span className={`text-[10px] font-bold ${cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                            {cell.dayNum}
                          </span>
                          {record && (
                            <div className={`mt-1 w-full p-1 rounded text-[8px] font-black text-center uppercase truncate ${
                              record.data.status === 'Hadir' ? 'bg-emerald-500 text-white' :
                              record.data.status === 'Sakit' ? 'bg-amber-500 text-white' : 'bg-sky-500 text-white'
                            }`}>
                              {record.data.status}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                   <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Wali Kelas: {activeTeacher.detail}</h4>
                    <div className="flex gap-2">
                      {['Semua', 'Hadir', 'Alpa'].map(f => (
                        <button 
                          key={f}
                          onClick={() => setWalikelasFilter(f as any)}
                          className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${walikelasFilter === f ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {registeredMembers
                        .filter(m => m.role === 'murid' && m.detail === activeTeacher.detail.split(' - ')[1])
                        .map(student => {
                          const record = records.find(r => r.type === 'murid' && (r.data as any).nis === student.id && new Date(r.timestamp).toDateString() === new Date().toDateString());
                          const status = record ? record.data.status : 'Alpa';
                          
                          if (walikelasFilter !== 'Semua' && status !== walikelasFilter) return null;

                          return (
                            <div key={student.id} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-400">
                                  {student.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-800 truncate max-w-[100px]">{student.name}</p>
                                  <p className="text-[8px] text-slate-400 font-mono">{student.id}</p>
                                </div>
                              </div>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${status === 'Hadir' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {status}
                              </span>
                            </div>
                          );
                        })}
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : portalTab === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Official GTK ID Card */}
              <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden border border-indigo-500/30 group select-none transition-all duration-700">
                <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-550/10 rounded-full blur-3xl"></div>
                <div className="absolute left-10 top-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                
                <div className="flex justify-between items-start mb-10 relative z-10">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <UserCheck className="text-indigo-900" size={22} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black tracking-tighter leading-none uppercase">Staff ID Card</h4>
                        <p className="text-[10px] font-bold text-indigo-300 mt-1 uppercase tracking-widest font-mono">SMK TUTWURI HANDAYANI</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-1.5 bg-indigo-500/20 text-indigo-200 font-black text-[10px] rounded-xl border border-indigo-500/30 font-mono backdrop-blur-sm uppercase tracking-widest">
                    Pegawai Aktif
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-center mb-8 relative z-10">
                  <div className="w-32 h-32 rounded-3xl bg-white/10 border-2 border-white/20 flex items-center justify-center font-black text-5xl text-indigo-200 shadow-2xl backdrop-blur-md">
                    {activeTeacher.name.replace(/(Drs\.|S\.Pd\.|M\.Pd\.|M\.Kom|S\.Si\.)/g, '').trim().charAt(0)}
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-2">
                    <h3 className="text-2xl font-black truncate leading-tight tracking-tight">{activeTeacher.name}</h3>
                    <p className="text-indigo-300 font-bold text-sm">{activeTeacher.detail}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-3">
                      <span className="px-3 py-1 bg-black/30 rounded-lg text-xs font-black font-mono border border-white/5 uppercase">NIP: {activeTeacher.id}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/95 text-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between border border-white/10 relative z-10 gap-6">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                      Official Access Token
                    </span>
                    <p className="text-xs text-slate-500 font-bold mt-1.5 leading-relaxed">
                      ID ini divalidasi resmi oleh sistem kepegawaian sekolah
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end justify-center font-sans opacity-80">
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-10 bg-slate-900"></div>
                      <div className="w-3 h-10 bg-slate-900"></div>
                      <div className="w-2 h-10 bg-slate-900"></div>
                      <div className="w-0.5 h-10 bg-slate-900"></div>
                      <div className="w-3.5 h-10 bg-slate-900"></div>
                      <div className="w-1 h-10 bg-slate-900"></div>
                    </div>
                    <span className="text-[8px] font-black font-mono tracking-[0.3em] text-slate-600">*{activeTeacher.id}*</span>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-4">
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">HADIR</span>
                    <p className="text-2xl font-black text-indigo-600">{teacherRecords.filter(r => r.data.status === 'Hadir').length}</p>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">DINAS</span>
                    <p className="text-2xl font-black text-emerald-600">{teacherRecords.filter(r => r.data.status === 'Izin').length}</p>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">RATE</span>
                    <p className="text-2xl font-black text-rose-600">98%</p>
                 </div>
              </div>
            </div>
          </motion.div>
        ) : portalTab === 'presence' ? (
          <motion.div
            key="presence"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="max-w-xl mx-auto space-y-6"
          >
            <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm space-y-8">
               <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-none">Presensi Mandiri GTK</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1.5 uppercase tracking-wider">Validasi Geofence Aktif</p>
                  </div>
               </div>

               {todayRecord ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-emerald-950">Berhasil Tercatat!</h4>
                      <p className="text-sm text-emerald-800 mt-2 font-bold leading-relaxed max-w-xs mx-auto">
                        Anda telah melakukan presensi hari ini pada pukul <strong>{new Date(todayRecord.timestamp).toLocaleTimeString('id-ID')} WIB</strong>.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-emerald-100/50 flex items-center justify-center gap-2 text-xs font-black text-emerald-700 font-mono">
                      <MapPin size={14} />
                      <span>DISTANCE: {todayRecord.data.jarak}m FROM CENTER</span>
                    </div>
                  </div>
               ) : (
                 <div className="space-y-6">
                    {/* Method Switcher Tabs */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setCheckinMethod('gps')}
                        className={`flex-1 h-11 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          checkinMethod === 'gps'
                            ? 'bg-white text-slate-900 shadow-sm font-black'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <MapPin size={14} />
                        <span>GPS Geofence</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckinMethod('qr')}
                        className={`flex-1 h-11 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          checkinMethod === 'qr'
                            ? 'bg-indigo-600 text-white shadow-sm font-black'
                            : 'text-slate-400 hover:text-indigo-600'
                        }`}
                      >
                        <QrCode size={14} />
                        <span>QR Scan</span>
                      </button>
                    </div>

                    {checkinMethod === 'qr' ? (
                      <div className="space-y-4 p-2">
                        <div className="flex gap-3">
                          <Camera className="text-indigo-600 mt-0.5 shrink-0" size={20} />
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">Scan QR Code Sekolah</h4>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">Arahkan kamera ke barcode dinas di area sekolah untuk check-in instan</p>
                          </div>
                        </div>
                        <div className="h-[300px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner">
                          <QrScanner 
                            activeTab="guru" 
                            onScanSuccess={handleTeacherQrScanSuccess} 
                            onClose={() => setCheckinMethod('gps')} 
                          />
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSelfCheckin} className="space-y-5">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5 font-mono">
                            Status Kehadiran
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['Hadir', 'Sakit', 'Izin'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setStatus(s)}
                                className={`h-12 rounded-2xl border text-sm transition-all cursor-pointer flex items-center justify-center font-bold ${
                                  status === s 
                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {status !== 'Hadir' && (
                          <div className="animate-fadeIn">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                                Catatan Dinas
                              </label>
                              <button
                                type="button"
                                onClick={startVoiceInput}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                  isListening 
                                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/20' 
                                    : 'bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600'
                                }`}
                              >
                                <Mic size={12} />
                                <span>{isListening ? 'Mendengarkan...' : 'Suara ke Teks'}</span>
                              </button>
                            </div>
                            <textarea
                              required
                              placeholder="Berikan alasan atau keterangan dinas Anda..."
                              value={keterangan}
                              onChange={(e) => setKeterangan(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700 min-h-[80px] font-medium resize-none transition-all"
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <RefreshCw size={20} className="animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 size={20} />
                              <span>Kirim Presensi Sekarang</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}
                 </div>
               )}
            </div>
          </motion.div>
        ) : portalTab === 'scanner' ? (

          {/* Teacher Self checkin status card */}
          {todayRecord ? (
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-3xl text-center space-y-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-indigo-950">Pegawai Sudah Absen</h4>
                <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                  Presensi kehadiran Anda telah dicatatkan hari ini pukul <strong>{formatTimestamp(todayRecord.timestamp).split(' - ')[0]} WIB</strong>.
                </p>
              </div>
              <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-750 font-mono">
                <MapPin size={11} /> 
                <span>GPS: LOKASI VALID DI SEKOLAH</span>
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
                  type="button"
                  onClick={() => setCheckinMethod('qr')}
                  className={`flex-1 h-11 sm:h-9.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    checkinMethod === 'qr'
                      ? 'bg-indigo-600 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-indigo-600'
                  }`}
                >
                  <QrCode size={13} />
                  <span>Contactless QR Scan</span>
                </button>
              </div>

              {checkinMethod === 'qr' ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Camera className="text-indigo-600 mt-0.5 shrink-0" size={16} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Scan QR Code SMK Tutwuri</h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">Arahkan kamera ke barcode dinas di meja piket atau lobby sekolah untuk check-in instan</p>
                    </div>
                  </div>
                  
                  <QrScanner 
                    activeTab="guru" 
                    onScanSuccess={handleTeacherQrScanSuccess} 
                    onClose={() => setCheckinMethod('gps')} 
                  />
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Smartphone className="text-indigo-605 mt-0.5 shrink-0 text-indigo-600" size={16} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Form Presensi Mandiri GTK</h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">Fakultas Geofence mendeteksi letak aman dari gedung guru</p>
                    </div>
                  </div>

                  <form onSubmit={handleSelfCheckin} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                        Status Presensi Hari Ini
                      </label>
                      <div className="grid grid-cols-3 gap-2 text-xs font-bold font-mono">
                        {(['Hadir', 'Sakit', 'Izin'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            className={`h-11 sm:h-9.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center ${
                              status === s 
                                ? 'bg-indigo-600 border-indigo-750 text-white font-extrabold shadow-sm'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {status !== 'Hadir' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                            Catatan Dinas / Dinas Luar
                          </label>
                          <button
                            type="button"
                            onClick={startVoiceInput}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isListening 
                                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20 font-black' 
                                : 'bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600'
                            }`}
                            title="Klik untuk merekam catatan menggunakan mikrofon device Anda"
                          >
                            {isListening ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                <span>Mendengarkan...</span>
                              </>
                            ) : (
                              <>
                                <Mic size={11} />
                                <span>Suara ke Teks</span>
                              </>
                            )}
                          </button>
                        </div>

                        {speechError && (
                          <div className="text-[9px] text-rose-500 font-semibold mb-1 text-right">
                            ⚠ {speechError}
                          </div>
                        )}

                        <div className="relative">
                          <textarea
                            required
                            placeholder={`Contoh: ${status === 'Sakit' ? 'Sakit asam lambung kambuh surat dokter terlampir' : 'Menghadiri pelantikan MGMP tingkat kota diawasi pengawas'}`}
                            value={keterangan}
                            onChange={(e) => setKeterangan(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 min-h-[50px] font-medium placeholder:text-slate-400 resize-none pr-10"
                          />
                          {isListening && (
                            <div className="absolute right-3.5 bottom-3.5 flex items-center gap-0.5 pointer-events-none">
                              <span className="w-1 h-3 bg-rose-500 rounded animate-[pulse_0.4s_infinite_alternate]" />
                              <span className="w-1 h-4 bg-rose-500 rounded animate-[pulse_0.4s_infinite_alternate_0.1s]" />
                              <span className="w-1 h-2 bg-rose-500 rounded animate-[pulse_0.4s_infinite_alternate_0.2s]" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                        Keterangan Tambahan (Opsional)
                      </label>
                      <input 
                        type="text"
                        placeholder="Contoh: Lupa bawa kartu, Bantuan khusus, dll"
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium placeholder:text-slate-400"
                      />
                    </div>

                    {antiCheatStatus === 'idle' ? (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center text-center gap-2"
                      >
                        <ShieldCheck size={16} />
                        Kirim Presensi Kehadiran GTK
                      </button>
                    ) : (
                      <div className="w-full bg-slate-900 rounded-xl p-3 shadow-inner border border-slate-800 overflow-hidden relative">
                        {/* Scanning beam effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 translate-y-[-100%] animate-[scan_1.5s_ease-in-out_infinite]" />
                        
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                          <Cpu size={20} className={`${antiCheatStatus === 'analyzing' ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}`} />
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                              {antiCheatStatus === 'analyzing' ? 'Integrity Check' : 'Validation Complete'}
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
                </>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Interactive Student ID Scanner Bar & Personal History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Jurnal Kehadiran moved up as the sole component in dashboard right column */}
          {/* Teacher Specific Logs Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <FileText size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Jurnal Kehadiran Pribadi Guru</h3>
                  <p className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Hanya memuat daftar masuk NIP Anda pribadi</p>
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
                      ? 'bg-white text-indigo-950 shadow-sm font-black'
                      : 'text-slate-400 hover:text-indigo-600'
                  }`}
                >
                  Kalender
                </button>
                {activeTeacher.detail.includes('Wali Kelas') && (
                  <button
                    type="button"
                    onClick={() => setViewMode('walikelas')}
                    className={`px-4 h-11 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                      viewMode === 'walikelas'
                        ? 'bg-rose-500 text-white shadow-sm font-black'
                        : 'text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    Wali Kelas
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto max-h-[160px] overflow-y-auto w-full md:block hidden">
                  <table className="w-full text-left text-[10.5px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-200">
                      <tr>
                        <th className="px-3 py-2 w-8 text-center text-slate-300">#</th>
                        <th className="px-3 py-2">Waktu Catat</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2">Catatan Dinas</th>
                        <th className="px-3 py-2 text-center">Jarak GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-600">
                      {teacherRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                            Belum ada riwayat terekam untuk pendidik ini.
                          </td>
                        </tr>
                      ) : (
                        teacherRecords.map((r, i) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 text-center font-bold font-mono">{i + 1}</td>
                            <td className="px-3 py-2 font-mono">{formatTimestamp(r.timestamp)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8.5px] ${
                                r.data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 font-extrabold' :
                                r.data.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
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
                  {teacherRecords.length === 0 ? (
                     <div className="text-center py-6 text-[11px] text-slate-400 italic border border-slate-100 bg-white rounded-xl">
                       Belum ada riwayat terekam.
                     </div>
                  ) : (
                    teacherRecords.map((r, i) => (
                      <div key={r.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-xs font-semibold text-slate-700">
                            {formatTimestamp(r.timestamp).split(',')[0]}
                            <span className="text-slate-400 font-normal ml-1 text-[10px]">{formatTimestamp(r.timestamp).split(',')[1]}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                            r.data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            r.data.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {r.data.status}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] items-start pt-1.5 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Catatan Dinas</span>
                            <span className="text-slate-600 truncate max-w-[150px]">{r.data.keterangan || '-'}</span>
                          </div>
                          
                          {r.data.jarak !== undefined && (
                            <div className="flex flex-col ml-auto text-right">
                              <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Kordinat</span>
                              <span className="text-slate-500 font-mono">{r.data.jarak}m</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : viewMode === 'calendar' ? (
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
                        ? 'ring-2 ring-indigo-655 ring-offset-1 scale-[1.05] z-10 shadow-sm'
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
                    <span className="text-slate-500 font-medium">Alpa</span>
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
                    explanationText = `Pendidik tercatat melakukan presensi sukses pada jam ${new Date(dayRec.timestamp).toLocaleTimeString('id-ID')} WIB dengan status: ${dayRec.data.keterangan || '-'}.`;
                  } else if (cellDate > targetToday) {
                    statusLabel = 'Masa Depan';
                    statusStyles = 'text-slate-400 bg-slate-50 border-slate-200';
                    explanationText = 'Pelayanan sekolah belum berjalan pada tanggal ini. Kewajiban dinas akan terekam setelah hari yang bersangkutan.';
                  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                    statusLabel = 'Akhir Pekan';
                    statusStyles = 'text-rose-500 bg-rose-50 border-rose-200';
                    explanationText = 'Hari libur akhir pekan resmi untuk seluruh GTK SMK Tutwuri Handayani, Cimahi (Sabtu / Minggu).';
                  } else {
                    statusLabel = 'Alpa (Tanpa Keterangan)';
                    statusStyles = 'text-red-700 bg-red-50 border-red-150';
                    explanationText = 'Tidak terdeteksi adanya log check-in harian dinas. Pendidik bersangkutan diklasifikasikan Alpha / Belum mengonfirmasi administrasi presensi.';
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
                              <div>Jam Masuk: <span className="text-slate-600 font-black">{new Date(dayRec.timestamp).toLocaleTimeString('id-ID')} WIB</span></div>
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
                          
                          const mapScale = 35 / 50; 
                          const offsetPx = Math.min(52, distance * mapScale);
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
                                  fill={isWithin ? "rgba(79, 70, 229, 0.05)" : "rgba(242, 158, 11, 0.03)"} 
                                  stroke={isWithin ? "#6366f1" : "#f59e0b"} 
                                  strokeWidth="1.5" 
                                  strokeDasharray={isWithin ? "none" : "3 2"}
                                />
                                
                                <text x="60" y="20" textAnchor="middle" fill={isWithin ? "#c7d2fe" : "#fde68a"} fontSize="6.5" fontWeight="black" fontFamily="monospace">
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
                                  stroke={isWithin ? "#6366f1" : "#ef4444"} 
                                  strokeWidth="1" 
                                  strokeDasharray="2 2" 
                                />
                                
                                {/* User Check-In Marker */}
                                <g className="animate-pulse">
                                  <circle 
                                    cx={userX} 
                                    cy={userY} 
                                    r="6.5" 
                                    fill={isWithin ? "rgba(99, 102, 241, 0.4)" : "rgba(239, 68, 68, 0.4)"} 
                                  />
                                </g>
                                <circle 
                                  cx={userX} 
                                  cy={userY} 
                                  r="3.5" 
                                  fill={isWithin ? "#6366f1" : "#ef4444"} 
                                  stroke="#ffffff" 
                                  strokeWidth="0.75" 
                                />
                              </svg>

                              {/* Tiny descriptive labels */}
                              <div className="mt-1 relative z-10 w-full flex items-center justify-between text-[7px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-1">
                                <span className="truncate">SMK Tutwuri</span>
                                <span className={isWithin ? "text-indigo-300" : "text-amber-400"}>{distance}m</span>
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
            ) : (
              <div className="animate-fadeIn space-y-4">
                {(() => {
                  const waliMatch = activeTeacher.detail.match(/Wali Kelas ([\w-]+)/);
                  const kelas = waliMatch ? waliMatch[1] : '-';
                  const myStudents = registeredMembers.filter(m => m.role === 'murid' && m.detail === kelas);
                  
                  // Mock history data for the semester chart
                  const semesterData = [
                    { name: 'Jan', Hadir: 95, Sakit: 2, Izin: 3, Alpa: 1 },
                    { name: 'Feb', Hadir: 92, Sakit: 4, Izin: 2, Alpa: 2 },
                    { name: 'Mar', Hadir: 97, Sakit: 1, Izin: 1, Alpa: 0 },
                    { name: 'Apr', Hadir: 90, Sakit: 5, Izin: 4, Alpa: 2 },
                    { name: 'Mei', Hadir: 88, Sakit: 6, Izin: 3, Alpa: 4 },
                    { name: 'Jun', Hadir: 96, Sakit: 1, Izin: 2, Alpa: 0 },
                  ];

                  const totalStudents = myStudents.length || 30; // default to 30 if empty for visual demo
                  
                  // Calculate mock summary based on total class size for current month
                  const todayStr = new Date().toDateString();
                  let alpaSakitToday = 0;
                  
                  myStudents.forEach(s => {
                    const studentRec = records.find(r => 
                      r.type === 'murid' && 
                      (r.data as any).nis === s.id && 
                      new Date(r.timestamp).toDateString() === todayStr
                    );
                    if (!studentRec || studentRec.data.status === 'Sakit' || studentRec.data.status === 'Alpa') {
                      alpaSakitToday++;
                    }
                  });

                  const averageAttendancePercent = 94.5;
                  const totalAlpaSakitBulanIni = 7;

                  return (
                    <>
                      {/* STATS CARDS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">Rata-rata Kehadiran</span>
                          <span className="text-3xl font-black text-emerald-600">{averageAttendancePercent}%</span>
                          <span className="text-[10px] text-slate-400 mt-1">Bulan Berjalan</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">Total Alpa/Sakit</span>
                          <span className="text-3xl font-black text-rose-600">{totalAlpaSakitBulanIni}</span>
                          <span className="text-[10px] text-slate-400 mt-1">Sakit/Alpa Bulan Ini</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-start">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 w-full text-center">Trend Semester Ini</span>
                          <div className="w-full h-12 pointer-events-none mt-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={semesterData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{fontSize: '10px', padding: '4px', borderRadius: '8px'}} />
                                <Bar dataKey="Hadir" stackId="a" fill="#10b981" />
                                <Bar dataKey="Sakit" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="Izin" stackId="a" fill="#0ea5e9" />
                                <Bar dataKey="Alpa" stackId="a" fill="#e11d48" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center mt-2 gap-3">
                        <div>
                          <h4 className="font-bold text-indigo-900 text-sm">Rekap Absensi Kelas {kelas}</h4>
                          <p className="text-xs text-indigo-700 mt-1">Status hari ini ({new Date().toLocaleDateString('id-ID')})</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Filter:</label>
                            <select 
                              value={walikelasFilter}
                              onChange={(e) => setWalikelasFilter(e.target.value as any)}
                              className="text-xs font-bold text-indigo-900 bg-white border border-indigo-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                            >
                              <option value="Semua">Semua ({myStudents.length})</option>
                              <option value="Hadir">Hadir</option>
                              <option value="Sakit">Sakit</option>
                              <option value="Izin">Izin</option>
                              <option value="Alpa">Alpa</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-4 w-full">
                        <div className="overflow-x-auto max-h-[350px] overflow-y-auto hidden md:block w-full">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 w-full transition-colors duration-200">
                              <tr>
                                <th className="px-4 py-3 w-8 text-center text-slate-300">#</th>
                                <th className="px-4 py-3">Nama Siswa</th>
                                <th className="px-4 py-3 text-center">Status Hari Ini</th>
                                <th className="px-4 py-3 text-center">Bulan Ini (H / Absen)</th>
                                <th className="px-4 py-3 text-center">Semester (H / Absen)</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-600">
                              {(() => {
                                const enrichedStudents = myStudents.map((s) => {
                                  const studentRec = records.find(r => 
                                    r.type === 'murid' && 
                                    (r.data as any).nis === s.id && 
                                    new Date(r.timestamp).toDateString() === todayStr
                                  );
                                  let st = 'Alpa';
                                  if (studentRec) {
                                    st = studentRec.data.status;
                                  }

                                  // Calculate mock monthly data based on records
                                  const monthRecords = records.filter(r => 
                                    r.type === 'murid' && 
                                    (r.data as any).nis === s.id
                                  );
                                  
                                  const monthHadir = monthRecords.filter(r => (r.data as any).status === 'Hadir').length;
                                  const monthSakit = monthRecords.filter(r => (r.data as any).status === 'Sakit').length;
                                  const monthIzin = monthRecords.filter(r => (r.data as any).status === 'Izin').length;
                                  const monthAlpa = Math.max(0, 20 - (monthHadir + monthSakit + monthIzin)); // assume 20 days/month
                                  const monthAbsen = monthSakit + monthIzin + monthAlpa;

                                  // Fake semester data maintaining consistency with student ID
                                  const idNum = parseInt(s.id.replace(/\D/g, '')) || 0;
                                  const semHadir = monthHadir * 5 + (idNum % 8);
                                  const semAbsen = monthAbsen * 5 + (idNum % 4);

                                  return { ...s, st, studentRec, monthHadir, monthAbsen, semHadir, semAbsen };
                                });

                                const filteredStudents = walikelasFilter === 'Semua' 
                                  ? enrichedStudents 
                                  : enrichedStudents.filter(s => s.st === walikelasFilter);

                                if (filteredStudents.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                                        Tidak ada siswa yang sesuai dengan filter.
                                      </td>
                                    </tr>
                                  );
                                }

                                return filteredStudents.map((s, i) => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3 text-slate-400 text-center font-bold font-mono">{i + 1}</td>
                                      <td className="px-4 py-3">
                                        <div className="font-bold text-slate-800">{s.name}</div>
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.id}</div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {s.st === 'Hadir' ? (
                                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">Hadir</span>
                                        ) : s.st === 'Sakit' ? (
                                          <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-[10px]">Sakit</span>
                                        ) : s.st === 'Izin' ? (
                                          <span className="px-2 py-1 rounded bg-sky-100 text-sky-800 text-[10px]">Izin</span>
                                        ) : (
                                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-bold text-[10px]">Alpa</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <span className="text-emerald-600 font-bold">{s.monthHadir}</span>
                                          <span className="text-slate-300">/</span>
                                          <span className="text-rose-600 font-bold">{s.monthAbsen}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <span className="text-emerald-600 font-bold">{s.semHadir}</span>
                                          <span className="text-slate-300">/</span>
                                          <span className="text-rose-600 font-bold">{s.semAbsen}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {(s.st === 'Alpa' || s.st === 'Sakit') ? (
                                          <button
                                            onClick={() => {
                                              const msg = s.st === 'Alpa' 
                                                ? `Halo, kami dari SMK Tutwuri Handayani memberitahukan bahwa siswa atas nama ${s.name} hari ini tercatat ALPA. Mohon konfirmasinya.` 
                                                : `Halo, kami dari SMK Tutwuri Handayani. Siswa atas nama ${s.name} hari ini tercatat SAKIT. Semoga lekas sembuh.`;
                                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200/50 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                            title="Kirim Pesan WhatsApp ke Orang Tua"
                                          >
                                            <MessageCircle size={12} strokeWidth={2.5} />
                                            Kirim WA
                                          </button>
                                        ) : (
                                          <span className="text-slate-300 text-[10px]">-</span>
                                        )}
                                      </td>
                                    </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Mobile Cards View */}
                        <div className="md:hidden max-h-[400px] overflow-y-auto bg-slate-50/50 p-2 space-y-2">
                          {(() => {
                                const enrichedStudents = myStudents.map((s) => {
                                  const studentRec = records.find(r => 
                                    r.type === 'murid' && 
                                    (r.data as any).nis === s.id && 
                                    new Date(r.timestamp).toDateString() === todayStr
                                  );
                                  let st = 'Alpa';
                                  if (studentRec) {
                                    st = studentRec.data.status;
                                  }

                                  const monthRecords = records.filter(r => 
                                    r.type === 'murid' && 
                                    (r.data as any).nis === s.id
                                  );
                                  
                                  const monthHadir = monthRecords.filter(r => (r.data as any).status === 'Hadir').length;
                                  const monthSakit = monthRecords.filter(r => (r.data as any).status === 'Sakit').length;
                                  const monthIzin = monthRecords.filter(r => (r.data as any).status === 'Izin').length;
                                  const monthAlpa = Math.max(0, 20 - (monthHadir + monthSakit + monthIzin)); 
                                  const monthAbsen = monthSakit + monthIzin + monthAlpa;

                                  const idNum = parseInt(s.id.replace(/\D/g, '')) || 0;
                                  const semHadir = monthHadir * 5 + (idNum % 8);
                                  const semAbsen = monthAbsen * 5 + (idNum % 4);

                                  return { ...s, st, studentRec, monthHadir, monthAbsen, semHadir, semAbsen };
                                });

                                const filteredStudents = walikelasFilter === 'Semua' 
                                  ? enrichedStudents 
                                  : enrichedStudents.filter(s => s.st === walikelasFilter);

                                if (filteredStudents.length === 0) {
                                  return (
                                     <div className="text-center py-6 text-[11px] text-slate-400 italic border border-slate-100 bg-white rounded-xl">
                                       Tidak ada siswa yang sesuai dengan filter.
                                     </div>
                                  );
                                }

                                return filteredStudents.map((s, i) => (
                                  <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                     <div className="flex justify-between items-start">
                                       <div>
                                          <div className="font-bold text-slate-700 text-xs">{s.name}</div>
                                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.id}</div>
                                       </div>
                                       {s.st === 'Hadir' ? (
                                         <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">Hadir</span>
                                       ) : s.st === 'Sakit' ? (
                                         <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Sakit</span>
                                       ) : s.st === 'Izin' ? (
                                         <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">Izin</span>
                                       ) : (
                                         <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[10px]">Alpa</span>
                                       )}
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50 text-[10px]">
                                        <div className="flex flex-col">
                                           <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-1">Bulan Ini (H/A)</span>
                                           <div className="font-mono flex items-center gap-1">
                                             <span className="text-emerald-600 font-bold">{s.monthHadir}</span>
                                             <span className="text-slate-300">/</span>
                                             <span className="text-rose-500 font-bold">{s.monthAbsen}</span>
                                           </div>
                                        </div>
                                        <div className="flex flex-col">
                                           <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-1">Semester (H/A)</span>
                                           <div className="font-mono flex items-center gap-1">
                                             <span className="text-emerald-600 font-bold">{s.semHadir}</span>
                                             <span className="text-slate-300">/</span>
                                             <span className="text-rose-500 font-bold">{s.semAbsen}</span>
                                           </div>
                                        </div>
                                     </div>
                                     {(s.st === 'Alpa' || s.st === 'Sakit') && (
                                       <div className="mt-2 pt-2 border-t border-slate-50 flex justify-end">
                                          <button
                                            onClick={() => {
                                              const msg = s.st === 'Alpa' 
                                                ? `Halo, kami dari SMK Tutwuri Handayani memberitahukan bahwa siswa atas nama ${s.name} hari ini tercatat ALPA. Mohon konfirmasinya.` 
                                                : `Halo, kami dari SMK Tutwuri Handayani. Siswa atas nama ${s.name} hari ini tercatat SAKIT. Semoga lekas sembuh.`;
                                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                            }}
                                            className="w-full justify-center flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200/50 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                                          >
                                            <MessageCircle size={14} strokeWidth={2.5} />
                                            Kirim WA ke Orang Tua
                                          </button>
                                       </div>
                                     )}
                                  </div>
                                ));
                              })()}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <motion.div
        key="scanner"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm py-16"
      >
        <div className="max-w-md mx-auto text-center mb-8">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2 mb-2">
            <Scan className="text-indigo-600" /> Mesin Scanner ID Siswa
          </h2>
          <p className="text-slate-500 text-sm">
            Arahkan kamera ke QR Code kartu pelajar siswa untuk memverifikasi absensi contactless rombel secara otomatis.
          </p>
        </div>
        
        {scanNotice && (
          <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-950 p-4 rounded-2xl flex gap-3 text-sm items-center shadow-sm animate-fadeIn">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
            <p className="font-semibold">{scanNotice}</p>
          </div>
        )}
        
        <div className="h-[500px]">
          <QrScanner
            activeTab="murid"
            onScanSuccess={(data) => {
              handleStudentQrScanSuccess(data);
              setPortalTab('dashboard'); 
            }}
            onClose={() => setPortalTab('dashboard')}
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
);
}
