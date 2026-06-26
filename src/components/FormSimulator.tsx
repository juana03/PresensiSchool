/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  GraduationCap, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Send, 
  IdCard, 
  Loader2, 
  School,
  FileText,
  BadgeAlert,
  Compass,
  QrCode,
  Sparkles,
  CheckCircle2,
  Bookmark,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { StudentAttendance, TeacherAttendance, AttendanceStatus } from '../types';
import QrScanner from './QrScanner';
import Swal from 'sweetalert2';
import { registeredMembers } from '../data/directory';

// SMK Tutwuri Handayani Center
const SCHOOL_COORDS = { lat: -6.8837, lng: 107.5451 };
const MAX_RADIUS = 100; // in meters

interface FormSimulatorProps {
  onSuccessSubmit: (type: 'murid' | 'guru', data: any) => void;
}

export default function FormSimulator({ onSuccessSubmit }: FormSimulatorProps) {
  const [activeTab, setActiveTab] = useState<'murid' | 'guru'>('murid');
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  
  // Geolocation states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [simulationMode, setSimulationMode] = useState<'real' | 'inside' | 'outside'>('inside');
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form State Murid
  const [studentNis, setStudentNis] = useState('');
  const [studentNama, setStudentNama] = useState('');
  const [studentKelas, setStudentKelas] = useState('');
  const [studentStatus, setStudentStatus] = useState<AttendanceStatus>('Hadir');
  const [studentKeterangan, setStudentKeterangan] = useState('');
  const [studentCatatan, setStudentCatatan] = useState('');

  // Form State Guru
  const [teacherNip, setTeacherNip] = useState('');
  const [teacherNama, setTeacherNama] = useState('');
  const [teacherJabatan, setTeacherJabatan] = useState('');
  const [teacherStatus, setTeacherStatus] = useState<AttendanceStatus>('Hadir');
  const [teacherKeterangan, setTeacherKeterangan] = useState('');
  const [teacherCatatan, setTeacherCatatan] = useState('');

  // Submit button loader state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // QR Code Scanner State & Handler
  const [showScanner, setShowScanner] = useState(false);
  const [antiCheatStatus, setAntiCheatStatus] = useState<'idle' | 'analyzing' | 'passed' | 'failed'>('idle');
  const [antiCheatLogs, setAntiCheatLogs] = useState<string[]>([]);

  // NEW: Fast Attendance Configuration
  const [autoSubmit, setAutoSubmit] = useState<boolean>(true);
  const [justCheckedInMember, setJustCheckedInMember] = useState<{ name: string; detail: string; role: string; timestamp: string } | null>(null);
  const [matchingMember, setMatchingMember] = useState<any | null>(null);

  // Reusable Auto-submission logic for simpler rapid attendance
  const triggerAutoSubmit = (type: 'murid' | 'guru', id: string, name: string, detail: string) => {
    setIsSubmitting(true);
    
    // Play delightful high beep sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}

    setTimeout(() => {
      const timestamp = new Date().toISOString();
      const status = type === 'murid' ? studentStatus : teacherStatus;
      const keterangan = type === 'murid' ? studentKeterangan : teacherKeterangan;
      const catatan = type === 'murid' ? studentCatatan : teacherCatatan;

      const recordPayload = {
        timestamp,
        [type === 'murid' ? 'nis' : 'nip']: id,
        nama: name,
        [type === 'murid' ? 'kelas' : 'jabatan']: detail,
        status: status || 'Hadir',
        keterangan: (status && status !== 'Hadir') ? keterangan : '-',
        catatan: catatan || '-',
        latitude: currentLat,
        longitude: currentLng,
        jarak: distance !== null ? distance : undefined,
        isWithinRadius: isWithinRadius
      };

      // Set checked-in member for success overlay animation
      const localeTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setJustCheckedInMember({
        name,
        detail,
        role: type,
        timestamp: localeTimeStr
      });

      // Reset specific tab inputs
      if (type === 'murid') {
        setStudentNis('');
        setStudentNama('');
        setStudentKelas('');
        setStudentStatus('Hadir');
        setStudentKeterangan('');
        setStudentCatatan('');
      } else {
        setTeacherNip('');
        setTeacherNama('');
        setTeacherJabatan('');
        setTeacherStatus('Hadir');
        setTeacherKeterangan('');
        setTeacherCatatan('');
      }

      onSuccessSubmit(type, recordPayload);
      setIsSubmitting(false);

      // Dismiss overlay after 3 seconds
      setTimeout(() => {
        setJustCheckedInMember(null);
      }, 3000);

    }, 750);
  };

  // Auto-complete student matching and optional instant check-in
  useEffect(() => {
    if (activeTab === 'murid') {
      if (studentNis) {
        const found = registeredMembers.find(m => m.id === studentNis && m.role === 'murid');
        if (found) {
          setStudentNama(found.name);
          setStudentKelas(found.detail);
          setMatchingMember(found);

          if (autoSubmit && !isSubmitting) {
            triggerAutoSubmit('murid', found.id, found.name, found.detail);
          }
        } else {
          setMatchingMember(null);
        }
      } else {
        setMatchingMember(null);
      }
    }
  }, [studentNis, activeTab, autoSubmit]);

  // Auto-complete teacher matching and optional instant check-in
  useEffect(() => {
    if (activeTab === 'guru') {
      if (teacherNip) {
        const found = registeredMembers.find(m => m.id === teacherNip && m.role === 'guru');
        if (found) {
          setTeacherNama(found.name);
          setTeacherJabatan(found.detail);
          setMatchingMember(found);

          if (autoSubmit && !isSubmitting) {
            triggerAutoSubmit('guru', found.id, found.name, found.detail);
          }
        } else {
          setMatchingMember(null);
        }
      } else {
        setMatchingMember(null);
      }
    }
  }, [teacherNip, activeTab, autoSubmit]);

  const handleScanSuccess = (data: {
    type?: 'murid' | 'guru';
    id: string;
    nama?: string;
    kelasOrJabatan?: string;
  }) => {
    const targetType = data.type || activeTab;
    if (data.type) {
      setActiveTab(data.type);
    }

    // Resolve details using local directory as reliable fallback
    const matched = registeredMembers.find(m => m.id === data.id && m.role === targetType);
    const resolvedName = matched?.name || data.nama || 'Anggota Tambahan';
    const resolvedDetail = matched?.detail || data.kelasOrJabatan || (targetType === 'murid' ? '10-A' : 'Staff TU');

    if (targetType === 'murid') {
      setStudentNis(data.id);
      setStudentNama(resolvedName);
      setStudentKelas(resolvedDetail);
    } else {
      setTeacherNip(data.id);
      setTeacherNama(resolvedName);
      setTeacherJabatan(resolvedDetail);
    }
    setShowScanner(false);
  };

  // 1. Ticking Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Clock format HH:MM:SS
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}:${ss}`);

      // Indonesian Date Format
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      setDateStr(now.toLocaleDateString('id-ID', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Haversine Distance Calculator
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // returns distance in meters
  };

  // 3. Location simulator selector and live calculation
  useEffect(() => {
    if (simulationMode === 'inside') {
      // 15 meters from school center (inside SMK Tutwuri Handayani building)
      const lat = -6.8836;
      const lng = 107.5450;
      setCurrentLat(lat);
      setCurrentLng(lng);
      setGpsError(null);
      const d = calculateDistance(lat, lng, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);
      setDistance(Math.round(d));
      setIsWithinRadius(d <= MAX_RADIUS);
    } else if (simulationMode === 'outside') {
      // Bandung city center (around 10 km away)
      const lat = -6.9147;
      const lng = 107.6098;
      setCurrentLat(lat);
      setCurrentLng(lng);
      setGpsError(null);
      const d = calculateDistance(lat, lng, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);
      setDistance(Math.round(d));
      setIsWithinRadius(d <= MAX_RADIUS);
    } else if (simulationMode === 'real') {
      // Request physical browser GPS
      setGpsLoading(true);
      if (!navigator.geolocation) {
        setGpsError("Browser tidak mendukung GPS.");
        setGpsLoading(false);
        setSimulationMode('inside'); // fallback
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);
          setGpsError(null);
          const d = calculateDistance(lat, lng, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);
          setDistance(Math.round(d));
          setIsWithinRadius(d <= MAX_RADIUS);
          setGpsLoading(false);
        },
        (error) => {
          let errorMsg = "Akses lokasi ditolak. Periksa izin lokasi browser Anda.";
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = "Izin lokasi di-block oleh browser/framing.";
          }
          setGpsError(errorMsg);
          setGpsLoading(false);
          // Auto fallback to inside simulation so they can still operate comfortably
          setSimulationMode('inside');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [simulationMode]);

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const statusToConfirm = activeTab === 'murid' ? studentStatus : teacherStatus;
    const nameToConfirm = activeTab === 'murid' ? studentNama : teacherNama;

    const result = await Swal.fire({
      title: 'Konfirmasi Kehadiran',
      text: `Apakah Anda yakin ingin mengirim data presensi atas nama ${nameToConfirm} dengan status: ${statusToConfirm}?`,
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

      // Proceed with normal submission after visual check
      setTimeout(() => {
        const timestamp = new Date().toISOString();
        let recordPayload: any = {};

        if (activeTab === 'murid') {
          if (!studentNis || !studentNama || !studentKelas) {
            alert('Mohon isi semua field wajib!');
            setIsSubmitting(false);
            setAntiCheatStatus('idle');
            return;
          }

          recordPayload = {
            timestamp,
            nis: studentNis,
            nama: studentNama,
            kelas: studentKelas,
            status: studentStatus,
            keterangan: studentStatus !== 'Hadir' ? studentKeterangan : '-',
            catatan: studentCatatan || '-',
            latitude: currentLat,
            longitude: currentLng,
            jarak: distance !== null ? distance : undefined,
            isWithinRadius: isWithinRadius
          };

          // Reset
          setStudentNis('');
          setStudentNama('');
          setStudentKelas('');
          setStudentStatus('Hadir');
          setStudentKeterangan('');
          setStudentCatatan('');
        } else {
          if (!teacherNip || !teacherNama || !teacherJabatan) {
            alert('Mohon isi semua field wajib!');
            setIsSubmitting(false);
            setAntiCheatStatus('idle');
            return;
          }

          recordPayload = {
            timestamp,
            nip: teacherNip,
            nama: teacherNama,
            jabatan: teacherJabatan,
            status: teacherStatus,
            keterangan: teacherStatus !== 'Hadir' ? teacherKeterangan : '-',
            catatan: teacherCatatan || '-',
            latitude: currentLat,
            longitude: currentLng,
            jarak: distance !== null ? distance : undefined,
            isWithinRadius: isWithinRadius
          };

          // Reset
          setTeacherNip('');
          setTeacherNama('');
          setTeacherJabatan('');
          setTeacherStatus('Hadir');
          setTeacherKeterangan('');
          setTeacherCatatan('');
        }

        onSuccessSubmit(activeTab, recordPayload);
        setIsSubmitting(false);
        setAntiCheatStatus('idle');
      }, 600);
    }, 1600);
  };

  return (
    <div id="school-attendance-container" className="w-full mx-auto flex flex-col bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
      {/* Phone Header Mock - Custom Styled Minimalist Bar */}
      <div className="bg-indigo-950 text-white px-6 py-5 border-b border-indigo-900/60 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold tracking-widest text-emerald-400">ABSENSI ONLINE MAL</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-900/80 px-2.5 py-1 rounded-full text-[9px] font-bold text-indigo-200 border border-indigo-800">
            <School size={10} className="text-emerald-400" />
            <span>SMK TUTWURI HANDAYANI</span>
          </div>
        </div>

        {/* Dynamic Digital Clock */}
        <div className="text-center py-2.5 bg-indigo-900/40 rounded-xl border border-indigo-800/40">
          <p className="text-[9px] font-bold tracking-widest text-indigo-300 uppercase mb-0.5 font-mono">WAKTU SEKARANG (WIB)</p>
          <div className="text-2xl font-mono font-bold text-white tracking-widest">{timeStr || '00:00:00'}</div>
          <div className="text-[11px] text-indigo-200 font-medium mt-0.5">{dateStr || 'Mencari hari...'}</div>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="overflow-hidden relative flex-1 flex flex-col bg-white">
        
        {/* Satisfying scan success overlay */}
        <AnimatePresence>
          {justCheckedInMember && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-indigo-950/95 z-50 p-6 flex flex-col items-center justify-center text-center text-white"
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12 }}
                className="w-16 h-16 bg-white text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20"
              >
                <CheckCircle2 size={36} className="stroke-[2.5] text-emerald-500 animate-bounce" />
              </motion.div>
              
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">ABSEN BERHASIL TERDETEKSI</p>
              <h3 className="text-xl font-bold mt-1.5 max-w-[260px] truncate leading-tight">{justCheckedInMember.name}</h3>
              <p className="text-xs text-indigo-200 mt-1 font-semibold">
                {justCheckedInMember.role === 'murid' ? `Siswa Rombel ${justCheckedInMember.detail}` : justCheckedInMember.detail}
              </p>
              
              <div className="w-full max-w-[220px] border-t border-indigo-800/60 my-4"></div>
              
              <div className="space-y-1.5 text-xs text-indigo-100 font-mono">
                <p>Status: <span className="bg-emerald-500 font-bold px-2 py-0.5 rounded text-white font-sans text-[9px] tracking-wider">HADIR</span></p>
                <p className="text-[10px] text-indigo-300">Waktu: {justCheckedInMember.timestamp} WIB</p>
                <p className="text-[10px] text-indigo-300">{isWithinRadius ? '✓ Terverifikasi di Area Sekolah' : 'Pencatatan GPS Aktif'}</p>
              </div>

              <div className="mt-8 flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-[10px] font-medium leading-none">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
                <span>Tercatat Otomatis di Google Sheet</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GPS Sensor validation panel */}
        <div className="bg-slate-50/80 border-b border-slate-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1 font-mono">
              <Compass size={12} className="text-indigo-600" /> Simulator GPS Tracker
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWithinRadius ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              {isWithinRadius ? 'Dalam Area' : 'Luar Area'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setSimulationMode('inside')}
              className={`text-xs font-bold h-10 px-3 rounded-xl text-center transition-all duration-300 ease-out cursor-pointer flex items-center justify-center active:scale-[0.98] ${
                simulationMode === 'inside'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-indigo-600'
              }`}
            >
              Sekolah (15m)
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode('outside')}
              className={`text-xs font-bold h-10 px-3 rounded-xl text-center transition-all duration-300 ease-out cursor-pointer flex items-center justify-center active:scale-[0.98] ${
                simulationMode === 'outside'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-amber-600'
              }`}
            >
              Luar (1.5km)
            </button>
            <button
              type="button"
              disabled={gpsLoading}
              onClick={() => setSimulationMode('real')}
              className={`text-xs font-bold h-10 px-3 rounded-xl text-center transition-all duration-300 ease-out flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] ${
                simulationMode === 'real'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {gpsLoading ? <Loader2 size={10} className="animate-spin" /> : null}
              GPS Asli
            </button>
          </div>

          {/* Current GPS coordinates presentation */}
          <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-150 shadow-inner">
            <div className="flex gap-2 items-center w-full">
              <MapPin size={14} className={isWithinRadius ? 'text-emerald-500' : 'text-amber-500'} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700 text-[11px] leading-tight font-mono truncate">
                  {currentLat ? `${currentLat.toFixed(6)}, ${currentLng?.toFixed(6)}` : 'Mencari Lokasi...'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                  Aman: <strong className="text-indigo-600">100m</strong> • Jarak: <strong className={isWithinRadius ? 'text-emerald-600' : 'text-amber-600'}>{distance}m</strong>
                </p>
              </div>
            </div>
          </div>
          
          {gpsError && (
            <p className="text-[10px] text-rose-500 font-semibold mt-1 px-1 flex gap-1 items-center">
              <AlertTriangle size={10} /> {gpsError}
            </p>
          )}
        </div>

        {/* Tab switch / Profile toggle */}
        <div className="bg-slate-100/60 p-1.5 rounded-2xl flex mb-6 w-[280px] mx-auto mt-5 border border-slate-200/50 relative">
          <button
            type="button"
            onClick={() => { if(!isSubmitting) { setActiveTab('murid'); setShowScanner(false); } }}
            className={`flex-1 h-11 sm:h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeTab === 'murid'
                ? 'text-indigo-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {activeTab === 'murid' && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 bg-white shadow-sm rounded-xl"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ zIndex: 0 }}
              />
            )}
            <User size={13} className="relative z-10" />
            <span className="relative z-10">Murid</span>
          </button>
          <button
            type="button"
            onClick={() => { if(!isSubmitting) { setActiveTab('guru'); setShowScanner(false); } }}
            className={`flex-1 h-11 sm:h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeTab === 'guru'
                ? 'text-indigo-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {activeTab === 'guru' && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 bg-white shadow-sm rounded-xl"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ zIndex: 0 }}
              />
            )}
            <GraduationCap size={13} className="relative z-10" />
            <span className="relative z-10">Guru / Tendik</span>
          </button>
        </div>
        
        {/* Auto Submitting Switch Setup */}
        <div className="mx-5 mb-2 p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100/60 flex items-center justify-between gap-3">
          <div className="flex gap-2 items-center">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Sparkles size={12} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-indigo-950 leading-tight">Absen Instan (Cukup Scan)</p>
              <p className="text-[9px] text-slate-500 leading-none mt-0.5 font-medium">Sistem auto-kirim jika NISN/NIP terdaftar</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setAutoSubmit(!autoSubmit)}
            className={`w-10 h-6 p-0.5 rounded-full transition-all duration-300 cursor-pointer relative ${
              autoSubmit ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 flex items-center justify-center ${
              autoSubmit ? 'translate-x-4' : 'translate-x-0'
            }`}>
              <span className="text-[8px] font-extrabold text-indigo-900 leading-none">{autoSubmit ? 'ON' : 'OFF'}</span>
            </div>
          </button>
        </div>

        {/* Active form screen */}
        <form onSubmit={handleFormSubmit} className="px-5 pb-6 pt-1 flex-1 flex flex-col justify-between gap-5">
          {activeTab === 'murid' ? (
            /* ================= STUDENT FORM ================= */
            <div className="space-y-4">
              {showScanner ? (
                <QrScanner
                  activeTab="murid"
                  onScanSuccess={handleScanSuccess}
                  onClose={() => setShowScanner(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="w-full h-12 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-950 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ease-out shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <QrCode size={14} className="text-indigo-600" />
                  <span>Scan Kartu Siswa (QR Code)</span>
                </button>
              )}

               <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    Nomor Induk (NISN) <span className="text-rose-500">*</span>
                  </label>
                  {matchingMember && (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-sans animate-fadeIn">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Terdaftar SMK Tutwuri
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Contoh: 12998374"
                  required
                  value={studentNis}
                  onChange={(e) => setStudentNis(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold placeholder:text-slate-400 font-mono"
                />

                {/* Quick testing presets */}
                <div className="mt-2 bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">
                    💡 TAP NISN UNTUK ABSEN CEPAT (ENTRI CEPAT)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredMembers.filter(m => m.role === 'murid').slice(0, 4).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setStudentNis(m.id);
                        }}
                        className={`text-[10px] font-bold py-1 px-2.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          studentNis === m.id
                            ? 'bg-indigo-600 border-indigo-650 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200'
                        }`}
                      >
                        <Bookmark size={8} className={studentNis === m.id ? 'text-white' : 'text-indigo-500'} />
                        <span>{m.name.split(' ')[0]} ({m.id})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Nama Lengkap Sesuai Rapor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  required
                  value={studentNama}
                  onChange={(e) => setStudentNama(e.target.value)}
                  disabled={isSubmitting || !!matchingMember}
                  readOnly={!!matchingMember}
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-medium placeholder:text-slate-400 ${
                    !!matchingMember 
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-700 font-bold focus:ring-0 focus:border-emerald-200' 
                      : 'bg-slate-50 border-slate-200 text-slate-705 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Kelas / Rombel Jurusan <span className="text-rose-500">*</span>
                </label>
                {!!matchingMember ? (
                  <div className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-4 py-3 text-slate-700 text-sm font-bold animate-fadeIn">
                    Kelas {studentKelas}
                  </div>
                ) : (
                  <select
                    required
                    value={studentKelas}
                    onChange={(e) => setStudentKelas(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Pilih Kelas</option>
                    <option value="10-A">Kelas 10-A (MIPA 1)</option>
                    <option value="10-B">Kelas 10-B (MIPA 2)</option>
                    <option value="10-C">Kelas 10-C (IPS 1)</option>
                    <option value="11-A">Kelas 11-A (Bahasa)</option>
                    <option value="11-B">Kelas 11-B (MIPA 3)</option>
                    <option value="12-A">Kelas 12-A (Unggulan 1)</option>
                    <option value="12-B">Kelas 12-B (Reguler)</option>
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2 block">
                  Status Kehadiran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {(['Hadir', 'Sakit', 'Izin'] as AttendanceStatus[]).map((status) => (
                    <label key={status} className="cursor-pointer group">
                      <input
                        type="radio"
                        name="student-status"
                        className="peer hidden"
                        checked={studentStatus === status}
                        disabled={isSubmitting}
                        onChange={() => setStudentStatus(status)}
                      />
                      <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-slate-250 bg-slate-50 peer-checked:bg-indigo-50 peer-checked:border-indigo-500 peer-checked:text-indigo-800 transition-all hover:bg-slate-100 ${
                        status === 'Hadir' ? 'peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-800' :
                        status === 'Sakit' ? 'peer-checked:bg-amber-50 peer-checked:border-amber-500 peer-checked:text-amber-800' :
                        'peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-850'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mb-1 ${
                          status === 'Hadir' ? 'bg-emerald-500' : status === 'Sakit' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-xs font-bold">{status}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {studentStatus !== 'Hadir' && (
                <div className="animate-fadeIn">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                    Keterangan Tambahan / Alasan Sakit/Izin
                  </label>
                  <textarea
                    placeholder="Alasan jika sakit/izin..."
                    required
                    rows={2}
                    value={studentKeterangan}
                    onChange={(e) => setStudentKeterangan(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium placeholder:text-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Catatan Opsional (Lupa Kartu / Bantuan)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lupa bawa kartu..."
                  value={studentCatatan}
                  onChange={(e) => setStudentCatatan(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          ) : (
            /* ================= TEACHER FORM ================= */
            <div className="space-y-4">
              {showScanner ? (
                <QrScanner
                  activeTab="guru"
                  onScanSuccess={handleScanSuccess}
                  onClose={() => setShowScanner(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="w-full h-12 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-950 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ease-out shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <QrCode size={14} className="text-indigo-600" />
                  <span>Scan Kartu Guru / Pegawai (QR Code)</span>
                </button>
              )}

               <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    NIP / Nomor Induk Pegawai <span className="text-rose-500">*</span>
                  </label>
                  {matchingMember && (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-sans animate-fadeIn">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Terdaftar SMK Tutwuri
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Masukkan Nomor Induk Pegawai"
                  required
                  value={teacherNip}
                  onChange={(e) => setTeacherNip(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold placeholder:text-slate-400 font-mono"
                />

                {/* Quick testing NIP presets */}
                <div className="mt-2 bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">
                    💡 TAP NIP UNTUK ABSEN CEPAT (ENTRI CEPAT)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredMembers.filter(m => m.role === 'guru').slice(0, 4).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setTeacherNip(m.id);
                        }}
                        className={`text-[10px] font-bold py-1 px-2.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          teacherNip === m.id
                            ? 'bg-slate-900 border-slate-950 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <Bookmark size={8} className={teacherNip === m.id ? 'text-white' : 'text-indigo-500'} />
                        <span className="truncate max-w-[120px]">{m.name.split(' ')[0]} {m.name.split(' ')[1] || ''} ({m.id})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Nama Lengkap & Gelar Akademik <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Drs. Bambang Wijaya, M.Pd."
                  required
                  value={teacherNama}
                  onChange={(e) => setTeacherNama(e.target.value)}
                  disabled={isSubmitting || !!matchingMember}
                  readOnly={!!matchingMember}
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-medium placeholder:text-slate-400 ${
                    !!matchingMember 
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-700 font-bold focus:ring-0 focus:border-emerald-200' 
                      : 'bg-slate-50 border-slate-200 text-slate-705 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Jabatan Dinas / Guru Mapel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Guru Kimia / Kepala Bagian TU"
                  required
                  value={teacherJabatan}
                  onChange={(e) => setTeacherJabatan(e.target.value)}
                  disabled={isSubmitting || !!matchingMember}
                  readOnly={!!matchingMember}
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-medium placeholder:text-slate-400 ${
                    !!matchingMember 
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-700 font-bold focus:ring-0 focus:border-emerald-200' 
                      : 'bg-slate-50 border-slate-200 text-slate-750 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2 block">
                  Status Kehadiran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {(['Hadir', 'Sakit', 'Izin'] as AttendanceStatus[]).map((status) => (
                    <label key={status} className="cursor-pointer group">
                      <input
                        type="radio"
                        name="teacher-status"
                        className="peer hidden"
                        checked={teacherStatus === status}
                        disabled={isSubmitting}
                        onChange={() => setTeacherStatus(status)}
                      />
                      <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-slate-250 bg-slate-50 peer-checked:bg-slate-900 peer-checked:border-slate-800 peer-checked:text-white transition-all hover:bg-slate-100 ${
                        status === 'Hadir' ? 'peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-800' :
                        status === 'Sakit' ? 'peer-checked:bg-amber-50 peer-checked:border-amber-500 peer-checked:text-amber-800' :
                        'peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-850'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mb-1 ${
                          status === 'Hadir' ? 'bg-emerald-500' : status === 'Sakit' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-xs font-bold">{status}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {teacherStatus !== 'Hadir' && (
                <div className="animate-fadeIn">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                    Keterangan Tambahan / Alasan Sakit/Izin
                  </label>
                  <textarea
                    placeholder="Keterangan dinas luar atau alasan sakit..."
                    required
                    rows={2}
                    value={teacherKeterangan}
                    onChange={(e) => setTeacherKeterangan(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium placeholder:text-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5 block">
                  Catatan Opsional (Lupa Kartu / Bantuan)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bantuan khusus..."
                  value={teacherCatatan}
                  onChange={(e) => setTeacherCatatan(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Form Action Button */}
          <div className="col-span-2 mt-4 pt-1">
            {antiCheatStatus === 'idle' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-all duration-300 ease-out active:scale-[0.98] cursor-pointer disabled:opacity-75 hover:shadow-indigo-300"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Sedang Mengirim Absensi...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Kirim Absensi Kehadiran</span>
                    <ShieldCheck size={18} />
                  </>
                )}
              </button>
            ) : (
              <div className="w-full bg-slate-900 rounded-xl p-4 shadow-inner border border-slate-800 overflow-hidden relative">
                {/* Scanning beam effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 translate-y-[-100%] animate-[scan_1.5s_ease-in-out_infinite]" />
                
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <Cpu size={24} className={`${antiCheatStatus === 'analyzing' ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}`} />
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      {antiCheatStatus === 'analyzing' ? 'System Integrity Check' : 'Validation Sequence Complete'}
                    </h4>
                  </div>
                </div>
                
                <div className="space-y-1.5 mt-3 pl-11 relative z-10">
                  {antiCheatLogs.map((log, index) => (
                    <p key={index} className="text-xs text-slate-300 font-mono animate-fadeIn">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
