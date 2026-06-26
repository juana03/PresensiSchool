/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Trash2, 
  Search, 
  Filter, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  FileCheck,
  Users,
  Compass,
  ArrowDownToLine,
  RefreshCw,
  CloudLightning,
  CloudOff,
  Calendar,
  ArrowUpDown,
  MessageCircle
} from 'lucide-react';
import { SimulatedRecord, StudentAttendance, TeacherAttendance } from '../types';

interface LocalDatabaseProps {
  records: SimulatedRecord[];
  onClearRecords: () => void;
  onResetDailyHadir: () => void;
  onDeleteRecord: (id: string) => void;
}

export default function LocalDatabase({ 
  records, 
  onClearRecords, 
  onResetDailyHadir, 
  onDeleteRecord 
}: LocalDatabaseProps) {
  const [activeSheet, setActiveSheet] = useState<'murid' | 'guru'>('murid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [kelasFilter, setKelasFilter] = useState<string>('All');
  const [verificationFilter, setVerificationFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<'daily' | 'all' | null>(null);
  
  const availableClasses = Array.from(new Set(
    records.filter(r => r.type === 'murid' && (r.data as any).kelas)
           .map(r => (r.data as any).kelas)
  )).sort() as string[];
  
  // Helper to parse timestamp robustly
  const parseTimestampHelper = (raw?: string) => {
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Filter based on selected sheet and criteria
  const combinedFilteredAll = records.filter(record => {
    if (record.type !== activeSheet) return false;
    
    // Search query matching
    const query = searchQuery.trim().toLowerCase();
    let matchesSearch = true;
    if (query) {
      if (activeSheet === 'murid') {
        const d = record.data as StudentAttendance;
        const namaMatch = (d.nama || '').toLowerCase().includes(query);
        const nisMatch = (d.nis || '').toLowerCase().includes(query);
        const kelasMatch = (d.kelas || '').toLowerCase().includes(query);
        matchesSearch = namaMatch || nisMatch || kelasMatch;
      } else {
        const d = record.data as TeacherAttendance;
        const namaMatch = (d.nama || '').toLowerCase().includes(query);
        const nipMatch = (d.nip || '').toLowerCase().includes(query);
        const jabatanMatch = (d.jabatan || '').toLowerCase().includes(query);
        matchesSearch = namaMatch || nipMatch || jabatanMatch;
      }
    }

    // Status filter matching
    const matchesStatus = statusFilter === 'All' ? true : record.data.status === statusFilter;
    const matchesKelas = kelasFilter === 'All' ? true : (record.data as any).kelas === kelasFilter;

    // Verification filter matching
    let matchesVerification = true;
    if (verificationFilter !== 'All') {
      const isWithinRadius = record.data.isWithinRadius;
      const hasGps = record.data.latitude !== null && record.data.latitude !== undefined && !isNaN(record.data.latitude);

      if (verificationFilter === 'Inside') {
        matchesVerification = !!isWithinRadius;
      } else if (verificationFilter === 'Outside') {
        matchesVerification = hasGps && !isWithinRadius;
      } else if (verificationFilter === 'NoGPS') {
        matchesVerification = !hasGps;
      }
    }
    
    // Date filter matching
    let matchesDate = true;
    if (dateFilter !== 'All') {
      const recordDate = new Date(record.timestamp || record.data?.timestamp || '');
      const today = new Date();
      if (dateFilter === 'Today') {
        matchesDate = recordDate.toDateString() === today.toDateString();
      } else if (dateFilter === '7Days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        matchesDate = recordDate >= sevenDaysAgo;
      } else if (dateFilter === 'ThisMonth') {
        matchesDate = recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
      }
    }

    return matchesSearch && matchesStatus && matchesKelas && matchesVerification && matchesDate;
  });

  // Automatically sort by newest timestamp at top
  const sortedAndFilteredRecords = [...combinedFilteredAll].sort((a, b) => {
    const timeA = parseTimestampHelper(a.timestamp || a.data?.timestamp);
    const timeB = parseTimestampHelper(b.timestamp || b.data?.timestamp);
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Calculate live stats for the widgets
  const sheetRecords = records.filter(r => r.type === activeSheet);
  const totalSubmissions = sheetRecords.length;
  const hadirCount = sheetRecords.filter(r => r.data.status === 'Hadir').length;
  const sakitCount = sheetRecords.filter(r => r.data.status === 'Sakit').length;
  const izinCount = sheetRecords.filter(r => r.data.status === 'Izin').length;

  const presentPercentage = totalSubmissions > 0 
    ? Math.round((hadirCount / totalSubmissions) * 100) 
    : 0;

  const insideGeofenceCount = sheetRecords.filter(r => {
    if (activeSheet === 'murid') {
      const d = r.data as StudentAttendance;
      return d.latitude && d.isWithinRadius;
    } else {
      const d = r.data as TeacherAttendance;
      return d.latitude && d.isWithinRadius;
    }
  }).length;

  const geofenceCompliance = totalSubmissions > 0
    ? Math.round((insideGeofenceCount / totalSubmissions) * 100)
    : 0;

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        ' - ' + date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return isoString;
    }
  };

  const handleConfirmReset = () => {
    if (resetTarget === 'daily') {
      onResetDailyHadir();
    } else if (resetTarget === 'all') {
      onClearRecords();
    }
    setShowResetModal(false);
    setResetTarget(null);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-5 sm:p-6 h-full flex flex-col justify-between relative">
      
      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm rounded-3xl flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fadeIn">
            <div className="flex items-start gap-3 text-amber-600 mb-4">
              <AlertCircle size={28} className="shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">Konfirmasi Reset</h3>
                <p className="text-slate-500 text-sm font-medium mt-1 leading-relaxed">
                  {resetTarget === 'daily' 
                    ? 'Apakah Anda yakin ingin mereset seluruh data kehadiran hari ini? Tindakan ini tidak dapat dibatalkan.' 
                    : 'Apakah Anda yakin ingin menghapus seluruh data di database (termasuk riwayat)? Tindakan ini akan mengosongkan seluruh histori sistem.'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowResetModal(false); setResetTarget(null); }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition-all"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Database size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">Database Spreadsheet Virtual</h2>
              <span className="text-[11px] text-slate-400 font-semibold mt-1.5 flex items-center gap-1.5">
                Mencatat data absensi real-time dari formulir 
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
            <button
              onClick={() => { setResetTarget('daily'); setShowResetModal(true); }}
              disabled={records.length === 0}
              className="text-[11px] py-1.5 px-3 bg-slate-50 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-amber-50 hover:text-amber-600 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
              title="Reset Semua Kehadiran Hari Ini"
            >
              <RefreshCw size={12} />
              Reset Kehadiran Hari Ini
            </button>          
            <button
              onClick={() => { setResetTarget('all'); setShowResetModal(true); }}
              disabled={records.length === 0}
              className="text-[11px] py-1.5 px-3 bg-slate-50 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-rose-50 hover:text-rose-600 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 size={12} />
              Reset Database
            </button>
          </div>
        </div>

        {/* Dynamic Analytics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Submisi</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{totalSubmissions}</p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">Entri dalam basis data</p>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-50 text-center">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest leading-none">Rasio Hadir</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">{presentPercentage}%</p>
            <p className="text-[9px] text-emerald-600 font-medium mt-0.5">{hadirCount} Hadir, {sakitCount + izinCount} Sakit/Izin</p>
          </div>
          <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-50 text-center">
            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest leading-none">Kepatuhan GPS</p>
            <p className="text-lg font-bold text-indigo-700 mt-1">{geofenceCompliance}%</p>
            <p className="text-[9px] text-indigo-600 font-medium mt-0.5">{insideGeofenceCount} Dalam Area radius</p>
          </div>
        </div>

        {/* Tab Sheet Buttons */}
        <div className="flex border-b border-slate-200 mb-4 text-xs font-bold font-mono">
          <button
            onClick={() => { setActiveSheet('murid'); setStatusFilter('All'); setKelasFilter('All'); setVerificationFilter('All'); }}
            className={`px-4 h-11 flex items-center border-b-2 transition-all cursor-pointer ${
              activeSheet === 'murid'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/20'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            📁 Data_Murid ({records.filter(r => r.type === 'murid').length})
          </button>
          <button
            onClick={() => { setActiveSheet('guru'); setStatusFilter('All'); setKelasFilter('All'); setVerificationFilter('All'); }}
            className={`px-4 h-11 flex items-center border-b-2 transition-all cursor-pointer ${
              activeSheet === 'guru'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/20'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            📁 Data_Guru ({records.filter(r => r.type === 'guru').length})
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col xl:flex-row gap-2 justify-between items-stretch xl:items-center">
            <div className="flex-1 relative min-w-[220px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={activeSheet === 'murid' ? 'Cari nama, NIS, atau kelas...' : 'Cari nama, NIP, atau jabatan...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-700 font-medium placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Filter */}
              <div className="relative min-w-[120px] flex-1 sm:flex-initial">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                  <Calendar size={12} className="text-indigo-500/60" />
                </span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-600 font-bold"
                >
                  <option value="All">Semua Waktu</option>
                  <option value="Today">Hari Ini</option>
                  <option value="7Days">7 Hari Terakhir</option>
                  <option value="ThisMonth">Bulan Ini</option>
                </select>
              </div>

              {/* Kelas Filter (Only for Murid) */}
              {activeSheet === 'murid' && (
                <div className="relative min-w-[100px] flex-1 sm:flex-initial">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                    <Filter size={12} className="text-indigo-500/60" />
                  </span>
                  <select
                    value={kelasFilter}
                    onChange={(e) => setKelasFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-600 font-bold"
                  >
                    <option value="All">Semua Kelas</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>Kelas {cls}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Verification Filter */}
              <div className="relative min-w-[145px] flex-1 sm:flex-initial">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                  <MapPin size={12} className="text-indigo-500/60" />
                </span>
                <select
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-600 font-bold"
                >
                  <option value="All">Semua Verifikasi</option>
                  <option value="Inside">📍 Di Sekolah</option>
                  <option value="Outside">🔴 Di Luar Area</option>
                  <option value="NoGPS">🚫 Tanpa GPS</option>
                </select>
              </div>

              {/* Sort by Timestamp Button */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer flex-1 sm:flex-initial justify-center"
                title="Urutkan berdasarkan Tanggal & Waktu"
              >
                <ArrowUpDown size={12} className="text-indigo-500" />
                <span>Waktu: {sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Row for Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/60 self-start">
            {[
              { label: 'Semua Status', val: 'All' },
              { label: 'Hadir', val: 'Hadir' },
              { label: 'Sakit', val: 'Sakit' },
              { label: 'Izin', val: 'Izin' },
              { label: 'Alpa', val: 'Alpa' },
            ].map((tab) => {
              const isActive = statusFilter === tab.val;
              return (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => setStatusFilter(tab.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-indigo-950 shadow-xs font-black border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gsheet Table Visual container */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-[320px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-[11px] transition-colors duration-200">
            <thead className="bg-[#f8fafc] dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 font-mono select-none transition-colors duration-200">
              {activeSheet === 'murid' ? (
                <tr>
                  <th className="px-3 py-2.5 text-slate-400 text-center w-8">#</th>
                  <th 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="px-3 py-2.5 min-w-[120px] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    title="Klik untuk megubah urutan waktu"
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp</span>
                      <ArrowUpDown size={10} className="text-indigo-500" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">NIS</th>
                  <th className="px-3 py-2.5 min-w-[110px]">Nama</th>
                  <th className="px-3 py-2.5">Kelas</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5">Keterangan</th>
                  <th className="px-3 py-2.5">Catatan</th>
                  <th className="px-3 py-2.5 min-w-[90px]">Lokasi (GPS)</th>
                  <th className="px-3 py-2.5 text-center">Jarak</th>
                  <th className="px-3 py-2.5 text-center">Verifikasi</th>
                  <th className="px-3 py-2.5 text-center w-8">Aksi</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2.5 text-slate-400 text-center w-8">#</th>
                  <th 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="px-3 py-2.5 min-w-[120px] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    title="Klik untuk megubah urutan waktu"
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp</span>
                      <ArrowUpDown size={10} className="text-indigo-500" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">NIP</th>
                  <th className="px-3 py-2.5 min-w-[110px]">Nama</th>
                  <th className="px-3 py-2.5">Jabatan</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5">Keterangan</th>
                  <th className="px-3 py-2.5">Catatan</th>
                  <th className="px-3 py-2.5 min-w-[90px]">Lokasi (GPS)</th>
                  <th className="px-3 py-2.5 text-center">Jarak</th>
                  <th className="px-3 py-2.5 text-center">Verifikasi</th>
                  <th className="px-3 py-2.5 text-center w-8">Aksi</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
              {sortedAndFilteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 px-4 text-slate-400 bg-slate-50/30">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <FileCheck size={32} className="text-slate-300 stroke-[1.5]" />
                      <div>
                        <p className="font-bold text-slate-500 text-xs text-center">Belum Ada Data Terkirim</p>
                        <p className="text-[10px] text-slate-400 max-w-[240px] text-center mt-0.5">Isi dan submit form absensi di sebelah kiri untuk me-nyimulasikan masukan baris database Google Sheets.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {/* Normal Live Records */}
                  {sortedAndFilteredRecords.map((record, index) => {
                    const num = index + 1;
                  if (record.type === 'murid') {
                    const data = record.data as StudentAttendance;
                    return (
                      <motion.tr 
                        key={record.id} 
                        layout
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-3 py-2 text-slate-400 text-center font-bold font-mono">{num}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{formatTimestamp(record.timestamp)}</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">'{data.nis}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          <div className="flex flex-col">
                            <span>{data.nama}</span>
                            {(() => {
                              if (!record.timestamp) return null;
                              const hrs = new Date(record.timestamp).getHours();
                              const isTimeAnomaly = hrs < 6 || hrs >= 18;
                              const isLocAnomaly = data.latitude && !data.isWithinRadius && data.status === 'Hadir';
                              
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {isTimeAnomaly && (
                                    <span className="inline-flex items-center gap-1 text-[8px] text-purple-700 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 font-bold w-fit tracking-wide animate-pulse uppercase">
                                      ⚠️ Jam Tidak Wajar
                                    </span>
                                  )}
                                  {isLocAnomaly && (
                                    <span className="inline-flex items-center gap-1 text-[8px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 font-bold w-fit tracking-wide animate-pulse uppercase">
                                      🚩 Lokasi Mencurigakan
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono">{data.kelas}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            data.status === 'Alpa' ? 'bg-rose-100 text-rose-800' :
                            data.status === 'Izin' ? 'bg-orange-100 text-orange-800' :
                            data.status === 'Sakit' ? 'bg-sky-100 text-sky-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {data.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate text-slate-500" title={data.keterangan}>{data.keterangan}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate text-indigo-500 font-medium" title={data.catatan}>{data.catatan || '-'}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[10px]" title={`${data.latitude}, ${data.longitude}`}>
                          {data.latitude ? `${data.latitude.toFixed(5)}, ${data.longitude?.toFixed(5)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-500">{data.jarak !== undefined ? `${data.jarak}m` : '-'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            data.isWithinRadius ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                            data.latitude ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}>
                            {data.isWithinRadius ? 'DI SEKOLAH' : (data.latitude ? 'DI LUAR AREA' : 'TANPA GPS')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {data.status === 'Alpa' && (
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Pemberitahuan Sekolah: Berhubung ananda ${data.nama} (Kelas ${data.kelas}) pada hari ini berstatus ALPA (Tanpa Keterangan), mohon kerjasamanya untuk memberikan konfirmasi kepada kami. Terima kasih.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-green-100 text-slate-400 hover:text-green-600 rounded-lg active:scale-95 transition-all cursor-pointer"
                                title="Kirim Pengingat WA"
                              >
                                <MessageCircle size={12} />
                              </a>
                            )}
                            <button
                              onClick={() => onDeleteRecord(record.id)}
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg active:scale-95 transition-all cursor-pointer"
                              title="Hapus baris ini"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  } else {
                    const data = record.data as TeacherAttendance;
                    return (
                      <motion.tr 
                        key={record.id} 
                        layout
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-3 py-2 text-slate-400 text-center font-bold font-mono">{num}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{formatTimestamp(record.timestamp)}</td>
                        <td className="px-3 py-2 font-mono text-indigo-700">'{data.nip}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          <div className="flex flex-col">
                            <span>{data.nama}</span>
                            {(() => {
                              if (!record.timestamp) return null;
                              const hrs = new Date(record.timestamp).getHours();
                              if (hrs < 6 || hrs >= 18) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[8px] text-purple-700 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 mt-1 font-bold w-fit tracking-wide animate-pulse uppercase">
                                    ⚠️ Jam Tidak Wajar
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="px-3 py-2">{data.jabatan}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            data.status === 'Alpa' ? 'bg-rose-100 text-rose-800' :
                            data.status === 'Izin' ? 'bg-orange-100 text-orange-800' :
                            data.status === 'Sakit' ? 'bg-sky-100 text-sky-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {data.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate text-slate-500" title={data.keterangan}>{data.keterangan}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[10px]" title={`${data.latitude}, ${data.longitude}`}>
                          {data.latitude ? `${data.latitude.toFixed(5)}, ${data.longitude?.toFixed(5)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-500">{data.jarak !== undefined ? `${data.jarak}m` : '-'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            data.isWithinRadius ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                            data.latitude ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}>
                            {data.isWithinRadius ? 'DI SEKOLAH' : (data.latitude ? 'DI LUAR AREA' : 'TANPA GPS')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => onDeleteRecord(record.id)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg active:scale-95 transition-all cursor-pointer"
                            title="Hapus baris ini"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  }
                })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
