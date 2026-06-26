import React, { useState, useEffect, useMemo } from 'react';
import { SimulatedRecord, StudentAttendance, TeacherAttendance } from '../types';
import { loadAllRecordsFromSheet } from '../lib/sheetsService';
import { Activity, Users, UserCheck, Search, Filter, RefreshCw } from 'lucide-react';

interface LiveSheetsDashboardProps {
  spreadsheetId: string | null;
  googleToken: string | null;
}

export default function LiveSheetsDashboard({ spreadsheetId, googleToken }: LiveSheetsDashboardProps) {
  const [liveRecords, setLiveRecords] = useState<SimulatedRecord[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Filters
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [classFilter, setClassFilter] = useState<string>('Semua');
  const [positionFilter, setPositionFilter] = useState<string>('Semua');
  const [typeFilter, setTypeFilter] = useState<'semua' | 'murid' | 'guru'>('semua');

  // Fetch data
  const fetchData = async () => {
    if (!spreadsheetId || !googleToken) return;
    setIsFetching(true);
    try {
      const records = await loadAllRecordsFromSheet(spreadsheetId, googleToken);
      setLiveRecords(records);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch live data:', error);
    } finally {
      setIsFetching(false);
    }
  };

  // Polling every 15 seconds
  useEffect(() => {
    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [spreadsheetId, googleToken]);

  // Derived data
  const filteredRecords = useMemo(() => {
    return liveRecords.filter(record => {
      // Date filter
      const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
      if (dateFilter && recordDate !== dateFilter) return false;

      // Type filter
      if (typeFilter !== 'semua' && record.type !== typeFilter) return false;

      // Type-specific filters
      if (record.type === 'murid') {
        const studentData = record.data as StudentAttendance;
        if (classFilter !== 'Semua' && studentData.kelas !== classFilter) return false;
      } else if (record.type === 'guru') {
        const teacherData = record.data as TeacherAttendance;
        if (positionFilter !== 'Semua' && teacherData.jabatan !== positionFilter) return false;
      }

      return true;
    });
  }, [liveRecords, dateFilter, classFilter, positionFilter, typeFilter]);

  const studentCount = liveRecords.filter(r => 
    r.type === 'murid' && new Date(r.timestamp).toISOString().split('T')[0] === dateFilter
  ).length;
  
  const staffCount = liveRecords.filter(r => 
    r.type === 'guru' && new Date(r.timestamp).toISOString().split('T')[0] === dateFilter
  ).length;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100/60 w-full animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Activity className="text-emerald-500" size={28} />
            Real-Time Attendance
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-2">
            Terhubung dengan Google Sheets <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Pembaruan Terakhir</div>
            <div className="text-xs font-bold text-slate-700 font-mono">
              {lastUpdated.toLocaleTimeString('id-ID')}
            </div>
          </div>
          <button 
            onClick={fetchData}
            disabled={isFetching}
            className={`p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors ${isFetching ? 'animate-spin text-indigo-400' : ''}`}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100/50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
            <Users size={28} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-widest font-mono mb-1">Kehadiran Siswa Hari Ini</div>
            <div className="text-3xl font-black text-emerald-800 font-mono">{studentCount}</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100/50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
            <UserCheck size={28} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-600/70 uppercase tracking-widest font-mono mb-1">Kehadiran Staff Hari Ini</div>
            <div className="text-3xl font-black text-indigo-800 font-mono">{staffCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Search size={12} /> Filter Tipe
          </label>
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="semua">Semua (Murid & Guru)</option>
            <option value="murid">Hanya Murid</option>
            <option value="guru">Hanya Guru/Staff</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Filter size={12} /> Tanggal
          </label>
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {(typeFilter === 'semua' || typeFilter === 'murid') && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kelas (Murid)</label>
            <select 
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="Semua">Semua Kelas</option>
              <option value="10-TP 1">10-TP 1</option>
              <option value="11-TKR 1">11-TKR 1</option>
              <option value="12-RPL 1">12-RPL 1</option>
            </select>
          </div>
        )}

        {(typeFilter === 'semua' || typeFilter === 'guru') && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jabatan (Staff)</label>
            <select 
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="Semua">Semua Jabatan</option>
              <option value="Guru Honorer">Guru Honorer</option>
              <option value="Staff TU">Staff TU</option>
              <option value="Kepala Sekolah">Kepala Sekolah</option>
              <option value="Guru Kimia / Kepala TU">Guru Kimia / Kepala TU</option>
            </select>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-500 tracking-wider">
              <th className="p-4 whitespace-nowrap">Waktu</th>
              <th className="p-4 whitespace-nowrap">Nama / Identitas</th>
              <th className="p-4 whitespace-nowrap">Tipe / Info</th>
              <th className="p-4 whitespace-nowrap text-center">Status</th>
            </tr>
          </thead>
          <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-50">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => {
                const timeStr = new Date(record.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isStudent = record.type === 'murid';
                const data = record.data as any;
                
                return (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">{timeStr}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{data.nama}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{isStudent ? data.nis : data.nip}</div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {isStudent ? `Siswa • ${data.kelas}` : `Guru/Staff • ${data.jabatan}`}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
                        ${data.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' : 
                          data.status === 'Sakit' ? 'bg-amber-100 text-amber-700' : 
                          data.status === 'Izin' ? 'bg-blue-100 text-blue-700' : 
                          'bg-rose-100 text-rose-700'}`}>
                        {data.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 font-medium text-sm">
                  Tidak ada data kehadiran yang sesuai filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
