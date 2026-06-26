/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { SimulatedRecord, AttendanceStatus, StudentAttendance, TeacherAttendance } from '../types';
import { jsPDF } from 'jspdf';
import { registeredMembers } from '../data/directory';
import schoolLogo from '../assets/images/smk_tutwuri_handayani_logo_1782261943532.jpg';
import AttendanceHeatmap from './AttendanceHeatmap';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  BarChart3,
  TrendingUp,
  HelpCircle,
  Calendar,
  Database,
  Award,
  FileDown,
  Printer,
  Filter,
  School,
  X,
} from 'lucide-react';

interface SummaryDashboardProps {
  records: SimulatedRecord[];
  onSeedHistorical?: () => void;
}

type DashboardFilter = 'semua' | 'murid' | 'guru';

const indonesianMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function SummaryDashboard({ records, onSeedHistorical }: SummaryDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('semua');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  
  // State dinamis untuk filter jurusan, kelas dan kop surat penandatangan PDF
  const [selectedJurusan, setSelectedJurusan] = useState<string>('Semua Jurusan');
  const [selectedKelas, setSelectedKelas] = useState<string>('Semua Kelas');
  const [rekapPeriod, setRekapPeriod] = useState<'harian' | 'mingguan' | 'bulanan'>('bulanan');
  const [signatoryName, setSignatoryName] = useState<string>('Dhani Rahadian, S.Pd.');
  const [signatoryNuptk, setSignatoryNuptk] = useState<string>('3938762662200002');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'pdf'|'csv', title: string, onConfirm: () => void } | null>(null);

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Role,Nama,Status,Tanggal\n";
    
    // Use filteredRecords to respect date range and active filter
    filteredRecords.forEach(r => {
      const type = r.type === 'murid' ? 'Siswa' : 'Guru';
      const name = r.data.nama || '-';
      const status = r.data.status || '-';
      const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('id-ID') : '-';
      
      const row = `${r.id},${type},"${name}",${status},${date}`;
      csvContent += row + "\\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Absensi_Bulanan_Digital.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cetakRekapBulananJurusanPDF = async (tipeJudul: string) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let currentY = 75; // Default start point for table if fallback is used

    // --- KOP SURAT RESMI SMK TUTWURI HANDAYANI (kop surat.png) ---
    try {
      const kopUrl = '/kop surat.png';
      const img = new Image();
      img.src = kopUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        // Fit to A4 width with margins (A4 width = 210mm, margins = 27mm each side -> 156mm width)
        const imgRatio = img.height / img.width;
        const printHeight = 156 * imgRatio;
        doc.addImage(dataUrl, 'PNG', 27, 27, 156, printHeight);
        
        // --- JUDUL DOKUMEN ---
        const startYAfterKop = 27 + printHeight + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(30, 27, 75);
        let judulFinal = selectedJurusan === 'Semua Jurusan' ? tipeJudul : `${tipeJudul} - JURUSAN ${selectedJurusan.toUpperCase()}`;
        if (selectedKelas !== 'Semua Kelas') {
          judulFinal += ` (${selectedKelas})`;
        }
        doc.text(judulFinal, 105, startYAfterKop, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Tahun Ajaran: 2025/2026  |  Rekapitulasi 12 Bulan (Januari s.d. Desember)', 105, startYAfterKop + 5, { align: 'center' });
        
        currentY = startYAfterKop + 15;
      }
    } catch(e) {
      // Fallback
      try {
        const logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Tut_Wuri_Handayani.png/240px-Tut_Wuri_Handayani.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          doc.addImage(dataUrl, 'PNG', 27, 27, 25, 25);
        }
      } catch (err) {
        // Skip logo if failed
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('YAYASAN TUTWURI HANDAYANI', 105, 30, { align: 'center' });
      doc.setFontSize(16);
      doc.text('SMK TUTWURI HANDAYANI', 105, 37, { align: 'center' });
      doc.setFontSize(9.5);
      doc.text('Terakreditasi "A"', 105, 42, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('NPSN : 20224102   |   NDS : 32.2.02.08.01.001   |   NSS : 4202290004', 105, 47, { align: 'center' });
      doc.text('Teknologi dan Rekayasa : Teknik Pemesinan, Teknik Kendaraan Ringan  |  TIK : Rekayasa Perangkat Lunak', 105, 51, { align: 'center' });
      doc.text('Izin Kanwil Depdikbud Prov. Jawa Barat No. 614/102/Kep.E.1994 Tanggal 29 Agustus 1999', 105, 55, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('JL. Encep Kartawiria No. 93 Telp. (022) 6628821 Citeureup Cimahi Utara - Kota Cimahi 40512 | Email : smktwh1994@gmail.com', 105, 59, { align: 'center' });
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.8);
      doc.line(27, 62, 183, 62);
      doc.setLineWidth(0.2);
      doc.line(27, 63.2, 183, 63.2);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(30, 27, 75);
      let judulFinal = selectedJurusan === 'Semua Jurusan' ? tipeJudul : `${tipeJudul} - JURUSAN ${selectedJurusan.toUpperCase()}`;
      if (selectedKelas !== 'Semua Kelas') {
        judulFinal += ` (${selectedKelas})`;
      }
      doc.text(judulFinal, 105, 70, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Tahun Ajaran: 2025/2026  |  Rekapitulasi 12 Bulan (Januari s.d. Desember)', 105, 75, { align: 'center' });
      
      currentY = 84;
    }


    // --- TABEL 2: DAFTAR NAMA SISWA & REKAP KEHADIRAN ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 27, 75);
    let tbl2Title = selectedJurusan === 'Semua Jurusan'
      ? 'Daftar Nama Siswa & Akumulasi Kehadiran Bulanan (Semua Jurusan)'
      : `Daftar Nama Siswa & Akumulasi Kehadiran - ${selectedJurusan}`;
    if (selectedKelas !== 'Semua Kelas') {
      tbl2Title += ` - Kelas ${selectedKelas}`;
    }
    doc.text(tbl2Title, 27, currentY);

    currentY += 3.5;
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(27, currentY, 156, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('No', 31, currentY + 4.8, { align: 'center' });
    doc.text('NISN', 40, currentY + 4.8);
    doc.text('Nama Siswa', 65, currentY + 4.8);
    doc.text('Jurusan / Kelas', 107, currentY + 4.8);
    doc.text('Bulan', 142, currentY + 4.8);
    doc.text('Hadir', 162, currentY + 4.8, { align: 'center' });
    doc.text('Target(%)', 177, currentY + 4.8, { align: 'center' });

    const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long' });

    const dataSiswaLengkapPDF = [
      { nis: '12998374', nama: 'Muhammad Fadli', jur: 'Rekayasa Perangkat Lunak', kls: '12-RPL 1', bln: currentMonth, h: '24 Hari', p: '96%' },
      { nis: '12998375', nama: 'Siti Rahmawati', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 2', bln: currentMonth, h: '25 Hari', p: '100%' },
      { nis: '12998500', nama: 'Rian Hidayat', jur: 'Rekayasa Perangkat Lunak', kls: '11-RPL 1', bln: currentMonth, h: '23 Hari', p: '92%' },
      { nis: '12998501', nama: 'Zaskia Putri Amanda', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 1', bln: currentMonth, h: '24 Hari', p: '96%' },
      { nis: '12998502', nama: 'Andi Wijaya Pratama', jur: 'Teknik Pemesinan', kls: '11-TP 1', bln: currentMonth, h: '24 Hari', p: '96%' },
      { nis: '12998503', nama: 'Dewi Lestari Kusuma', jur: 'Teknik Pemesinan', kls: '12-TP 2', bln: currentMonth, h: '25 Hari', p: '100%' },
      { nis: '12998504', nama: 'Budi Santoso Purba', jur: 'Teknik Pemesinan', kls: '10-TP 1', bln: currentMonth, h: '22 Hari', p: '88%' },
      { nis: '12998505', nama: 'Lia Ananda Saputri', jur: 'Teknik Kendaraan Ringan', kls: '11-TKR 1', bln: currentMonth, h: '24 Hari', p: '96%' },
      { nis: '12998506', nama: 'Fajar Ramadhan', jur: 'Teknik Kendaraan Ringan', kls: '12-TKR 1', bln: currentMonth, h: '25 Hari', p: '100%' },
      { nis: '12998507', nama: 'Nabila Syakieb', jur: 'Teknik Kendaraan Ringan', kls: '10-TKR 2', bln: currentMonth, h: '23 Hari', p: '92%' },
    ];

    const siswaPDFFiltered = dataSiswaLengkapPDF.filter(s => 
      (selectedJurusan === 'Semua Jurusan' || s.jur === selectedJurusan) && 
      (selectedKelas === 'Semua Kelas' || s.kls === selectedKelas)
    );

    currentY += 7;
    const sRowHPDF = 6.5;

    siswaPDFFiltered.forEach((s, idx) => {
      if (currentY + sRowHPDF > 260) {
        doc.addPage();
        currentY = 27;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(27, currentY, 156, sRowHPDF, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(27, currentY + sRowHPDF, 183, currentY + sRowHPDF);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      doc.text(`${idx + 1}`, 31, currentY + 4.2, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(s.nis, 40, currentY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.text(s.nama, 65, currentY + 4.2);
      doc.text(s.kls, 107, currentY + 4.2);
      doc.text(s.bln, 142, currentY + 4.2);
      doc.text(s.h, 162, currentY + 4.2, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(s.p, 177, currentY + 4.2, { align: 'center' });

      currentY += sRowHPDF;
    });

    // --- BLOK TANDA TANGAN KEPALA SEKOLAH ---
    if (currentY + 45 > 270) {
      doc.addPage();
      currentY = 27;
    }
    const ttdY = currentY + 12;
    const ttdDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cimahi, ${ttdDateStr}`, 161, ttdY, { align: 'center' });
    doc.text('Mengetahui,', 161, ttdY + 4.5, { align: 'center' });
    doc.text('Kepala SMK Tutwuri Handayani', 161, ttdY + 9, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(signatoryName, 161, ttdY + 32, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`NUPTK : ${signatoryNuptk}`, 161, ttdY + 36.5, { align: 'center' });

    // Footer Info
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Dokumen sah rekapitulasi kehadiran siswa SMK Tutwuri Handayani', 105, 285, { align: 'center' });

    const cleanJurusanName = selectedJurusan === 'Semua Jurusan' ? 'SEMUA_JURUSAN' : selectedJurusan.replace(/\s+/g, '_').toUpperCase();
    const filename = tipeJudul.includes('STATISTIK') ? `REKAP_STATISTIK_${cleanJurusanName}.pdf` : `REKAP_BULANAN_${cleanJurusanName}.pdf`;
    doc.save(filename);
  };

  const handleCetakLaporan = () => {
    setConfirmDialog({
      type: 'pdf',
      title: 'mencetak LAPORAN REKAPITULASI (PDF)',
      onConfirm: () => cetakRekapBulananJurusanPDF('LAPORAN REKAPITULASI BULANAN KEHADIRAN SISWA PER JURUSAN')
    });
  };

  const handleExportStatsPDF = () => {
    setConfirmDialog({
      type: 'pdf',
      title: 'mencetak STATISTIK KEHADIRAN (PDF)',
      onConfirm: () => cetakRekapBulananJurusanPDF('STATISTIK KEHADIRAN BULANAN SISWA PER JURUSAN')
    });
  };

  // Calculate dynamic weekly trends comparison
  const { 
    trends, 
    totalCurHadir, 
    totalPrevHadir, 
    peakCurDay, 
    peakCurCount, 
    peakPrevDay, 
    peakPrevCount,
    currentRange, 
    previousRange 
  } = useMemo(() => {
    const todayRef = new Date();
    
    // Find Monday of the current week (Sunday is 0, Monday is 1, etc.)
    const currentDay = todayRef.getDay();
    const dayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    
    const curMonday = new Date(todayRef);
    curMonday.setDate(todayRef.getDate() + dayOffset);
    curMonday.setHours(0, 0, 0, 0);

    // Monday of previous week
    const prevMonday = new Date(curMonday);
    prevMonday.setDate(curMonday.getDate() - 7);

    const indonesianDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    
    const trendsList = indonesianDays.map((name, index) => {
      const curDate = new Date(curMonday);
      curDate.setDate(curMonday.getDate() + index);
      const startOfCurDay = new Date(curDate);
      startOfCurDay.setHours(0, 0, 0, 0);
      const endOfCurDay = new Date(curDate);
      endOfCurDay.setHours(23, 59, 59, 999);

      const prevDate = new Date(prevMonday);
      prevDate.setDate(prevMonday.getDate() + index);
      const startOfPrevDay = new Date(prevDate);
      startOfPrevDay.setHours(0, 0, 0, 0);
      const endOfPrevDay = new Date(prevDate);
      endOfPrevDay.setHours(23, 59, 59, 999);

      const getHadirCount = (start: Date, end: Date) => {
        return records.filter(r => {
          if (!r.timestamp) return false;
          if (activeFilter !== 'semua' && r.type !== activeFilter) return false;
          
          const rDate = new Date(r.timestamp);
          return rDate >= start && rDate <= end && r.data.status === 'Hadir';
        }).length;
      };

      const currentHadir = getHadirCount(startOfCurDay, endOfCurDay);
      const previousHadir = getHadirCount(startOfPrevDay, endOfPrevDay);

      return {
        day: name,
        current: currentHadir,
        previous: previousHadir,
        curDateStr: curDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        prevDateStr: prevDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      };
    });

    const totalCurH = trendsList.reduce((sum, item) => sum + item.current, 0);
    const totalPrevH = trendsList.reduce((sum, item) => sum + item.previous, 0);

    let peakCurD = '-';
    let peakCurC = -1;
    let peakPrevD = '-';
    let peakPrevC = -1;

    trendsList.forEach(item => {
      if (item.current > peakCurC) {
        peakCurC = item.current;
        peakCurD = item.day;
      }
      if (item.previous > peakPrevC) {
        peakPrevC = item.previous;
        peakPrevD = item.day;
      }
    });

    const curSundayVal = new Date(curMonday);
    curSundayVal.setDate(curMonday.getDate() + 6);
    const curMondayStr = curMonday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const curSundayStr = curSundayVal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const prevSundayVal = new Date(prevMonday);
    prevSundayVal.setDate(prevMonday.getDate() + 6);
    const prevMondayStr = prevMonday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const prevSundayStr = prevSundayVal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    return {
      trends: trendsList,
      totalCurHadir: totalCurH,
      totalPrevHadir: totalPrevH,
      peakCurDay: peakCurD,
      peakCurCount: peakCurC,
      peakPrevDay: peakPrevD,
      peakPrevCount: peakPrevC,
      currentRange: `${curMondayStr} - ${curSundayStr}`,
      previousRange: `${prevMondayStr} - ${prevSundayStr}`
    };
  }, [records, activeFilter]);

  // Optimize filtered and grouped states with useMemo
  const { filteredRecords, total, statusCounts, stats, monthlyRecap, heatmapData, jurusanStats } = useMemo(() => {
    const filtered = records.filter(r => {
      // type filter
      if (activeFilter !== 'semua' && r.type !== activeFilter) return false;
      
      // date range filter
      if (dateRange.startDate && r.timestamp) {
        const rowDate = new Date(r.timestamp).setHours(0,0,0,0);
        const start = new Date(dateRange.startDate).setHours(0,0,0,0);
        if (rowDate < start) return false;
      }
      if (dateRange.endDate && r.timestamp) {
        const rowDate = new Date(r.timestamp).setHours(0,0,0,0);
        const end = new Date(dateRange.endDate).setHours(23,59,59,999);
        if (rowDate > end) return false;
      }
      
      return true;
    });

    const tot = filtered.length;
    const sCounts = filtered.reduce((acc, r) => {
      const status = r.data.status || 'Hadir';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<AttendanceStatus, number>);

    const st = {
      Hadir: sCounts['Hadir'] || 0,
      Sakit: sCounts['Sakit'] || 0,
      Izin: sCounts['Izin'] || 0,
    };

    const monthlyData: Record<number, { total: number; hadir: number; sakit: number; izin: number }> = {};
    
    const jStats: Record<string, number> = {
      'TP': 0,
      'TKR': 0,
      'RPL': 0
    };

    filtered.forEach(r => {
      if (!r.timestamp) return;
      const date = new Date(r.timestamp);
      const m = date.getMonth();
      
      if (r.type === 'murid' && r.data.status === 'Hadir' && 'kelas' in r.data) {
        const kls = r.data.kelas || '';
        if (kls.includes('TP')) jStats['TP'] += 1;
        else if (kls.includes('TKR')) jStats['TKR'] += 1;
        else if (kls.includes('RPL')) jStats['RPL'] += 1;
      }

      if (!monthlyData[m]) {
        monthlyData[m] = { total: 0, hadir: 0, sakit: 0, izin: 0 };
      }
      monthlyData[m].total += 1;
      if (r.data.status === 'Hadir') {
        monthlyData[m].hadir += 1;
      } else if (r.data.status === 'Sakit') {
        monthlyData[m].sakit += 1;
      } else if (r.data.status === 'Izin') {
        monthlyData[m].izin += 1;
      }
    });

    const activeMonths = Object.entries(monthlyData).map(([mStr, val]) => {
      const mNum = parseInt(mStr);
      const percentage = Math.round((val.hadir / val.total) * 100);
      return {
        monthIndex: mNum,
        monthName: indonesianMonths[mNum],
        monthShort: indonesianMonths[mNum].substring(0, 3) + '.',
        total: val.total,
        hadir: val.hadir,
        sakit: val.sakit,
        izin: val.izin,
        percentage,
        grade: percentage >= 95 ? 'Hadir 95%+' : percentage >= 90 ? 'Hadir 90%+' : 'Di bawah 90%',
        colorClass: percentage >= 95 ? 'text-emerald-700 bg-emerald-55/70 border-emerald-100' : percentage >= 90 ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-amber-700 bg-amber-50 border-amber-100',
        barColor: percentage >= 95 ? 'bg-emerald-500' : percentage >= 90 ? 'bg-indigo-600' : 'bg-amber-500'
      };
    }).sort((a, b) => a.monthIndex - b.monthIndex);

    return {
      filteredRecords: filtered,
      total: tot,
      statusCounts: sCounts,
      stats: st,
      monthlyRecap: activeMonths.slice(-6),
      heatmapData: Array.from({ length: 35 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (34 - i));
        const dateStr = d.toISOString().split('T')[0];
        const count = records.filter(r => 
          r.timestamp.startsWith(dateStr) && 
          r.data.status === 'Hadir' &&
          (activeFilter === 'semua' || r.type === activeFilter)
        ).length;
        return { date: dateStr, count };
      }),
      jurusanStats: [
        { name: 'Teknik Pemesinan', short: 'TP', count: jStats['TP'] },
        { name: 'Kendaraan Ringan', short: 'TKR', count: jStats['TKR'] },
        { name: 'Rekayasa PL', short: 'RPL', count: jStats['RPL'] },
      ]
    };
  }, [records, activeFilter, dateRange]);

  // Percentages helper
  const getPercentage = (count: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const dataSlices = [
    { label: 'Hadir', count: stats.Hadir, color: '#10b981', hoverColor: '#059669', bgClass: 'bg-emerald-500' },
    { label: 'Sakit', count: stats.Sakit, color: '#f59e0b', hoverColor: '#d97706', bgClass: 'bg-amber-500' },
    { label: 'Izin', count: stats.Izin, color: '#3b82f6', hoverColor: '#2563eb', bgClass: 'bg-blue-500' }
  ].filter(s => s.count > 0); // Only render slices with actual data

  // Math helper for drawing SVG arc segments
  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const getArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', cx, cy,
      'L', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ');
  };

  // Accumulated angles for slices
  let accumulatedAngle = 0;
  const svgSlices = dataSlices.map((slice) => {
    const angle = (slice.count / total) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle = endAngle;

    return {
      ...slice,
      startAngle,
      endAngle,
      path: getArcPath(100, 100, 75, startAngle, endAngle),
      donutPath: getArcPath(100, 100, 80, startAngle, endAngle) // optional wider path
    };
  });

  // Calculate classes with > 10 Alpa
  const alpaClasses: Record<string, number> = {};
  records.forEach(r => {
    if (r.type === 'murid' && r.data.status === 'Alpa' && 'kelas' in r.data) {
      if (r.data.kelas) {
        alpaClasses[r.data.kelas] = (alpaClasses[r.data.kelas] || 0) + 1;
      }
    }
  });

  const highAlpaClasses = Object.entries(alpaClasses)
    .filter(([_, count]) => count > 10);

  return (
    <div id="summary-dashboard-section" className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-5 sm:p-6 mb-8 select-none animate-fadeIn">
      {highAlpaClasses.length > 0 && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3 shadow-sm animate-fadeIn">
          <AlertCircle size={24} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-900 mb-1">
              Peringatan: Tingkat Ketidakhadiran (Alpa) Tinggi
            </h3>
            <p className="text-xs text-rose-700 font-semibold mb-2">
              Sistem mendeteksi ada kelas dengan lebih dari 10 siswa berstatus Alpa hari ini. Harap segera hubungi wali kelas terkait.
            </p>
            <div className="flex flex-wrap gap-2">
              {highAlpaClasses.map(([kelas, count], idx) => (
                <div key={idx} className="bg-white px-2.5 py-1 rounded-lg border border-rose-200 shadow-sm flex items-center gap-1.5 font-bold">
                  <span className="text-rose-800 text-xs">Kelas {kelas}:</span>
                  <span className="bg-rose-100 text-rose-900 px-1.5 rounded-md text-xs">{count} Siswa</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Section Header */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
            <BarChart3 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
              Summary Dashboard
              <span className="bg-emerald-100 border border-emerald-300/40 text-emerald-800 text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md font-mono tracking-normal">
                Live Data
              </span>
            </h2>
            <span className="text-xs text-slate-400 font-semibold mt-1.5 block leading-normal">
              Ringkasan kehadiran digital real-time & analisis administratif
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto">
          <button
             onClick={() => setConfirmDialog({ type: 'csv', title: 'mengunduh data (CSV)', onConfirm: handleDownloadCSV })}
             className="h-10 sm:h-9 px-3 bg-slate-50 border border-slate-200/80 text-emerald-700 rounded-xl text-[11px] font-extrabold uppercase hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all truncate cursor-pointer"
             title="Unduh Laporan Bulanan (CSV/Excel)"
          >
            <FileDown size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">Excel (CSV)</span>
          </button>
          <button
             onClick={handleExportStatsPDF}
             className="h-10 sm:h-9 px-3 bg-indigo-600 border border-indigo-700 text-white rounded-xl text-[11px] font-extrabold uppercase hover:bg-indigo-700 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 truncate cursor-pointer"
             title="Ekspor Statistik Harian (PDF)"
          >
            <FileDown size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">Expor Stats</span>
          </button>
          <button
             onClick={handleCetakLaporan}
             className="h-10 sm:h-9 px-3 bg-slate-50 border border-slate-200/80 text-rose-700 rounded-xl text-[11px] font-extrabold uppercase hover:bg-rose-50 hover:border-rose-200 hover:text-rose-800 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all truncate cursor-pointer"
             title="Cetak Laporan Bulanan (PDF)"
          >
            <Printer size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-3 sm:flex gap-1.5 w-full sm:w-auto">
          {(['semua', 'murid', 'guru'] as DashboardFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 sm:px-6 h-10 sm:h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center ${
                activeFilter === tab
                  ? 'bg-white shadow-sm text-indigo-950 border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              {tab === 'semua' ? 'Semua' : tab === 'murid' ? 'Murid' : 'Guru'}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 text-xs text-slate-500 font-semibold">
          <span>Total Data Warga Terfilter: <strong className="text-indigo-950 font-mono font-bold">{total}</strong></span>
        </div>
      </div>

      {/* Main Stats and Visualization Grid */}
      {total === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-12 px-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl"
        >
          <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3 animate-pulse" />
          <p className="text-xs font-bold uppercase tracking-wider">Belum Ada Data</p>
          <p className="text-[11px] mt-1 text-slate-400">
            Isi formulir kehadiran di ponsel simulator terlebih dahulu untuk memuat analisa grafik.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
          
          {/* Column 1: SVG Pie Chart Visualizer */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-5 flex flex-col items-center justify-center relative"
          >
            <div className="w-48 h-48 relative">
              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                {svgSlices.map((slice, index) => {
                  const isHovered = hoveredSlice === slice.label;
                  return (
                    <path
                      key={index}
                      d={slice.path}
                      fill={isHovered ? slice.hoverColor : slice.color}
                      className="transition-all duration-300 cursor-pointer origin-center"
                      style={{
                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: '100px 100px'
                      }}
                      onMouseEnter={() => setHoveredSlice(slice.label)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
                {/* Center hole for donut aesthetic & readability */}
                <circle cx="100" cy="100" r="42" fill="#ffffff" />
              </svg>

              {/* Informative Label inside the Donut Hole */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                {hoveredSlice ? (
                  <>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none font-mono">
                      {hoveredSlice}
                    </span>
                    <span className="text-2xl font-black text-slate-800 leading-none mt-1">
                      {getPercentage(stats[hoveredSlice as AttendanceStatus])}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none font-mono">
                      TOTAL ABSEN
                    </span>
                    <span className="text-3xl font-extrabold text-indigo-950 leading-none mt-1.5 font-mono">
                      {total}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 font-semibold italic">
              <HelpCircle size={12} /> Hover grafik untuk persentase detail
            </div>
          </motion.div>

          {/* Column 2: Stat breakdown & progress list */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-7 space-y-4"
          >
            
            {/* Standard Metrics Rows */}
            <div className="space-y-3.5">
              {/* HADIR */}
              <div 
                className={`p-3 rounded-2xl border transition-all duration-400 ease-out hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/10 hover:z-10 cursor-pointer ${
                  hoveredSlice === 'Hadir' 
                    ? 'border-emerald-250 bg-emerald-50/50 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/30'
                }`}
                onMouseEnter={() => setHoveredSlice('Hadir')}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-slate-800">HADIR (SELESAI)</span>
                  </div>
                  <div className="text-right flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{stats.Hadir}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({getPercentage(stats.Hadir)}%)</span>
                  </div>
                </div>
                {/* Minimal Progress Bar preview */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${getPercentage(stats.Hadir)}%` }}
                  ></div>
                </div>
              </div>

              {/* SAKIT */}
              <div 
                className={`p-3 rounded-2xl border transition-all duration-400 ease-out hover:scale-105 hover:shadow-xl hover:shadow-amber-500/10 hover:z-10 cursor-pointer ${
                  hoveredSlice === 'Sakit' 
                    ? 'border-amber-250 bg-amber-50/50 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/30'
                }`}
                onMouseEnter={() => setHoveredSlice('Sakit')}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-xs font-bold text-slate-800">SAKIT / MEDIS</span>
                  </div>
                  <div className="text-right flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{stats.Sakit}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({getPercentage(stats.Sakit)}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${getPercentage(stats.Sakit)}%` }}
                  ></div>
                </div>
              </div>

              {/* IZIN */}
              <div 
                className={`p-3 rounded-2xl border transition-all duration-400 ease-out hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 hover:z-10 cursor-pointer ${
                  hoveredSlice === 'Izin' 
                    ? 'border-blue-250 bg-blue-50/50 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/30'
                }`}
                onMouseEnter={() => setHoveredSlice('Izin')}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-bold text-slate-800">IZIN / KEPERLUAN</span>
                  </div>
                  <div className="text-right flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{stats.Izin}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({getPercentage(stats.Izin)}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${getPercentage(stats.Izin)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Quick Mini Fact widget box */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-indigo-50 p-4 rounded-2xl border border-indigo-800 shadow-sm flex items-start gap-3 w-full">
              <TrendingUp className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-300 font-mono font-medium">Analisa Kehadiran</p>
                <p className="text-[11px] mt-1 text-indigo-100 leading-normal">
                  Rasio Kehadiran aktif yang terdata di sistem saat ini adalah{' '}
                  <strong className="text-white font-bold text-xs">
                    {getPercentage(stats.Hadir)}%
                  </strong>
                  . Semua data tervalidasi siap diekspor ke Google Sheets real-time.
                </p>
              </div>
            </div>

          </motion.div>

        </div>
      )}

      {/* Weekly Trend Comparison Bento-Section */}
      {total > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                <TrendingUp size={15} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Analisis Tren Kehadiran Mingguan</h3>
                <p className="text-[10px] text-slate-400 font-semibold font-sans">Komparasi jumlah kehadiran harian minggu ini dengan minggu lalu</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 text-[10px] font-bold font-mono">
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200/40 text-slate-600 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Lalu: {previousRange}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Kini: {currentRange}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Live Chart Container */}
            <div className="lg:col-span-8 bg-slate-50/40 border border-slate-200/50 p-4 rounded-3xl flex flex-col justify-between relative min-h-[250px]">
              
              {/* Responsive Recharts Grid */}
              <div className="w-full h-[220px] text-[10px] font-mono leading-none mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#94a3b8" 
                      style={{ fontSize: 10, fontWeight: 700 }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#94a3b8" 
                      style={{ fontSize: 10, fontWeight: 700 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl text-[10px] font-sans border border-slate-800/80 backdrop-blur-sm animate-fadeIn leading-relaxed min-w-[170px] z-10">
                              <div className="font-extrabold uppercase tracking-wider text-indigo-300 mb-1 font-mono flex justify-between items-center">
                                <span>{data.day}</span>
                                <span className="text-[8.5px] bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-400/20 text-indigo-200 font-semibold">
                                  {data.curDateStr}
                                </span>
                              </div>
                              <div className="space-y-1 mt-1.5 pt-1.5 border-t border-slate-800/50">
                                <div className="flex justify-between items-center gap-4">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    Minggu Lalu ({data.prevDateStr}):
                                  </span>
                                  <span className="font-bold text-slate-100 font-mono">{data.previous} Hadir</span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="flex items-center gap-1 text-indigo-350">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                    Minggu Ini ({data.curDateStr}):
                                  </span>
                                  <span className="font-bold font-mono text-emerald-400 flex items-center gap-0.5">
                                    {data.current} Hadir
                                    {data.current > data.previous ? (
                                      <span className="text-emerald-400 text-[8px]">▲</span>
                                    ) : data.current < data.previous ? (
                                      <span className="text-rose-400 text-[8px]">▼</span>
                                    ) : null}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle" 
                      wrapperStyle={{ fontSize: 9, fontWeight: 700, paddingBottom: 10 }} 
                    />
                    <Line 
                      name="Minggu Lalu"
                      type="monotone" 
                      dataKey="previous" 
                      stroke="#94a3b8" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={{ r: 3, fill: '#94a3b8', strokeWidth: 1 }} 
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line 
                      name="Minggu Ini"
                      type="monotone" 
                      dataKey="current" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-2 border-t border-slate-100 pt-2 float-left italic">
                <HelpCircle size={11} className="text-slate-400" /> Arahkan kursor / hover batang grafik untuk melihat komparasi detail angka kehadiran harian
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <AttendanceHeatmap data={heatmapData} />
              
              {/* Comparative Growth Stat Box */}
              <div className="bg-slate-50/50 border border-slate-200/50 p-4 rounded-3xl flex flex-col justify-between h-full hover:bg-white transition-all shadow-sm">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    Total Minggu Ini vs Minggu Lalu
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-black text-indigo-950 font-mono leading-none">
                      {totalCurHadir}
                    </span>
                    <span className="text-xs text-slate-400 font-bold font-mono">
                      Hadir (vs {totalPrevHadir} Lalu)
                    </span>
                  </div>

                  {/* Growth delta card */}
                  {(() => {
                    const diff = totalCurHadir - totalPrevHadir;
                    if (totalPrevHadir === 0) {
                      if (totalCurHadir > 0) {
                        return (
                          <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10.5px] font-bold px-2.5 py-1 rounded-xl mt-3.5 shadow-sm">
                            <span className="text-emerald-500 font-extrabold">▲</span>
                            <span>Baru Dimulai (Minggu Pertama)</span>
                          </div>
                        );
                      }
                      return (
                        <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200/40 text-[10.5px] font-bold px-2.5 py-1 rounded-xl mt-3.5 shadow-sm">
                          <span>Menunggu data dipopulasikan</span>
                        </div>
                      );
                    }

                    const pctChange = Math.round((diff / totalPrevHadir) * 100);
                    const isPositive = diff >= 0;

                    return (
                      <div className={`inline-flex items-center gap-1.5 text-[10.5px] font-black px-2.5 py-1 rounded-xl mt-3.5 border shadow-sm ${
                        isPositive 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                          : 'bg-rose-50 border-rose-100 text-rose-700'
                      }`}>
                        <span>{isPositive ? '▲' : '▼'}</span>
                        <span>{isPositive ? '+' : ''}{pctChange}%</span>
                        <span className="opacity-80 font-semibold font-sans">b/m lalu ({isPositive ? 'Naik' : 'Turun'} {Math.abs(diff)} Hadir)</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="border-t border-slate-100 pt-3.5 mt-4">
                  <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed">
                    Aktivitas check-in contactless meningkat dikarenakan siswa dan guru portal dapat memindai camera-based QR code dengan integrasi instan.
                  </p>
                </div>
              </div>

              {/* Peak Attendance Days Box */}
              <div className="bg-slate-50/50 border border-slate-200/50 p-4 rounded-3xl flex flex-col justify-between h-full hover:bg-white transition-all shadow-sm">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    Hari Puncak (Peak Days)
                  </span>
                  
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        Minggu Lalu:
                      </span>
                      <span className="font-extrabold text-slate-700 font-mono">
                        {peakPrevCount > 0 ? `${peakPrevDay} (${peakPrevCount} Hadir)` : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-indigo-600 font-extrabold">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Minggu Ini:
                      </span>
                      <span className="font-black text-indigo-950 font-mono">
                        {peakCurCount > 0 ? `${peakCurDay} (${peakCurCount} Hadir)` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <CheckCircle size={13} />
                  </div>
                  <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wide">
                    SISTEM VALID INTEGRASI QR
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Perbandingan Hadir per Jurusan */}
      {total > 0 && activeFilter === 'semua' && (
        <div className="mt-8 pt-6 border-t border-slate-100 animate-fadeIn">
          <div className="flex flex-col mb-4">
            <h3 className="text-sm font-bold text-slate-800 leading-tight">Perbandingan Hadir per Jurusan</h3>
            <p className="text-[10px] text-slate-400 font-semibold font-sans">Komparasi jumlah kehadiran siswa hari ini berdasarkan jurusan (TP, TKR, RPL)</p>
          </div>
          <div className="bg-slate-50/40 border border-slate-200/50 p-4 rounded-3xl min-h-[250px]">
            <div className="w-full h-[220px] text-[10px] font-mono leading-none mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jurusanStats} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="short" 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94a3b8" 
                    style={{ fontSize: 10, fontWeight: 700 }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94a3b8" 
                    style={{ fontSize: 10, fontWeight: 700 }} 
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl text-[10px] font-sans border border-slate-800/80 backdrop-blur-sm animate-fadeIn leading-relaxed min-w-[150px] z-10">
                            <div className="font-extrabold uppercase tracking-wider text-indigo-300 mb-1 font-mono">
                              {data.name}
                            </div>
                            <div className="font-bold text-emerald-400 text-lg flex items-center gap-1 font-mono">
                              {data.count} <span className="text-xs text-slate-400 font-sans font-medium">Siswa Hadir</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Monthly percentage recap visualization */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-55 text-indigo-700 bg-indigo-50 rounded-lg">
              <Calendar size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Rekap Persentase Kehadiran Bulanan</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Bulan-ke-bulan analisis persentase kehadiran aktif berdasarkan Sheet & Log database</p>
            </div>
          </div>
          
          {onSeedHistorical && (
            <button
              onClick={onSeedHistorical}
              className="text-[10px] font-bold bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Database size={11} />
              <span>Muat Riwayat 6 Bulan</span>
            </button>
          )}
        </div>

        {/* Modul Filter Jurusan & Kop Penandatangan Dinamis */}
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-indigo-100/80 p-4 sm:p-5 rounded-3xl mb-6 shadow-2xs">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-indigo-950 shrink-0">
                    <Filter size={16} className="text-indigo-600" />
                    <span>Filter Jurusan:</span>
                  </div>
                  <select
                    value={selectedJurusan}
                    onChange={(e) => { setSelectedJurusan(e.target.value); setSelectedKelas('Semua Kelas'); }}
                    className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[210px] hover:border-indigo-300 transition-colors"
                  >
                    <option value="Semua Jurusan">Semua Jurusan (TP, TKR, RPL)</option>
                    <option value="Teknik Pemesinan">Teknik Pemesinan (TP)</option>
                    <option value="Teknik Kendaraan Ringan">Teknik Kendaraan Ringan (TKR)</option>
                    <option value="Rekayasa Perangkat Lunak">Rekayasa Perangkat Lunak (RPL)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-indigo-950 shrink-0">
                    <Filter size={16} className="text-indigo-600" />
                    <span>Filter Kelas:</span>
                  </div>
                  <select
                    value={selectedKelas}
                    onChange={(e) => setSelectedKelas(e.target.value)}
                    className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[140px] hover:border-indigo-300 transition-colors"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {selectedJurusan === 'Teknik Pemesinan' && (
                      <>
                        <option value="10-TP 1">10-TP 1</option>
                        <option value="11-TP 1">11-TP 1</option>
                        <option value="12-TP 2">12-TP 2</option>
                      </>
                    )}
                    {selectedJurusan === 'Teknik Kendaraan Ringan' && (
                      <>
                        <option value="10-TKR 2">10-TKR 2</option>
                        <option value="11-TKR 1">11-TKR 1</option>
                        <option value="12-TKR 1">12-TKR 1</option>
                      </>
                    )}
                    {selectedJurusan === 'Rekayasa Perangkat Lunak' && (
                      <>
                        <option value="10-RPL 1">10-RPL 1</option>
                        <option value="10-RPL 2">10-RPL 2</option>
                        <option value="11-RPL 1">11-RPL 1</option>
                        <option value="12-RPL 1">12-RPL 1</option>
                      </>
                    )}
                    {selectedJurusan === 'Semua Jurusan' && (
                      <>
                        <option value="10-TP 1">10-TP 1</option>
                        <option value="10-TKR 2">10-TKR 2</option>
                        <option value="10-RPL 1">10-RPL 1</option>
                        <option value="10-RPL 2">10-RPL 2</option>
                        <option value="11-TP 1">11-TP 1</option>
                        <option value="11-TKR 1">11-TKR 1</option>
                        <option value="11-RPL 1">11-RPL 1</option>
                        <option value="12-TP 2">12-TP 2</option>
                        <option value="12-TKR 1">12-TKR 1</option>
                        <option value="12-RPL 1">12-RPL 1</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-indigo-950 shrink-0">
                    <Calendar size={16} className="text-indigo-600" />
                    <span>Rentang Tanggal:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[135px] hover:border-indigo-300 transition-colors"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[135px] hover:border-indigo-300 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Piket Portal Buttons Group */}
              <div className="piket-portal-buttons flex flex-row items-center justify-start gap-4 mt-4 lg:mt-0">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-black text-[10px] text-indigo-950/60 uppercase tracking-wider shrink-0 px-1">
                    <span>Periode Rekap:</span>
                  </div>
                  <select
                    value={rekapPeriod}
                    onChange={(e) => setRekapPeriod(e.target.value as any)}
                    className="bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-bold text-indigo-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[110px] hover:bg-indigo-50 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <option value="harian">Harian</option>
                    <option value="mingguan">Mingguan</option>
                    <option value="bulanan">Bulanan</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="invisible text-[10px] px-1 select-none">Action:</div>
                  <button
                    onClick={() => {
                      const periodLabel = rekapPeriod.charAt(0).toUpperCase() + rekapPeriod.slice(1);
                      const titleStr = selectedJurusan === 'Semua Jurusan'
                        ? `LAPORAN REKAPITULASI ${rekapPeriod.toUpperCase()} KEHADIRAN SISWA PER JURUSAN`
                        : `LAPORAN REKAPITULASI ${rekapPeriod.toUpperCase()} KEHADIRAN SISWA - JURUSAN ${selectedJurusan.toUpperCase()}`;
                      setConfirmDialog({
                        type: 'pdf',
                        title: `mencetak ${titleStr} (PDF)`,
                        onConfirm: () => cetakRekapBulananJurusanPDF(titleStr)
                      });
                    }}
                    className="h-[42px] px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-300 transition-all duration-300 ease-out hover:scale-[1.05] active:scale-95 cursor-pointer shrink-0"
                  >
                    <Printer size={16} />
                    <span>Cetak Rekap {rekapPeriod.charAt(0).toUpperCase() + rekapPeriod.slice(1)} (PDF)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t pt-5 border-indigo-100/60">
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <span className="text-xs font-bold text-slate-500 shrink-0">Penandatangan:</span>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="Nama Kepala Sekolah"
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 w-52 shadow-2xs focus:outline-none focus:border-indigo-400"
                  title="Nama Dinamis Penandatangan"
                />
                <input
                  type="text"
                  value={signatoryNuptk}
                  onChange={(e) => setSignatoryNuptk(e.target.value)}
                  placeholder="NUPTK"
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-semibold text-slate-700 w-48 shadow-2xs focus:outline-none focus:border-indigo-400"
                  title="NUPTK Dinamis Penandatangan"
                />
              </div>
            </div>
          </div>
          <div className="piket-print-footer text-center text-[10px] text-slate-500 italic font-italic py-4 border-t border-indigo-100/50 mt-3">
            Dokumen sah rekapitulasi kehadiran siswa SMK Tutwuri Handayani
          </div>
        </div>

        {/* Tabel Rekap Nama Siswa per Jurusan di UI */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 mb-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 font-mono">
                <School size={15} className="text-indigo-600" />
                <span>Daftar Nama Siswa & Rekap Kehadiran ({selectedJurusan}{selectedKelas !== 'Semua Kelas' ? ` - ${selectedKelas}` : ''})</span>
              </h4>
              <p className="text-[10.5px] text-slate-400 font-semibold mt-0.5">Daftar presensi siswa aktif tiap jurusan tersinkronisasi dengan cetakan PDF laporan rekap bulanan</p>
            </div>
            <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100/80 shrink-0 self-start sm:self-auto">
              {(() => {
                const filtered = [
                  { nis: '12998374', nama: 'Muhammad Fadli', jur: 'Rekayasa Perangkat Lunak', kls: '12-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                  { nis: '12998375', nama: 'Siti Rahmawati', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                  { nis: '12998500', nama: 'Rian Hidayat', jur: 'Rekayasa Perangkat Lunak', kls: '11-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '23 Hari', p: '92.0%' },
                  { nis: '12998501', nama: 'Zaskia Putri Amanda', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                  { nis: '12998502', nama: 'Andi Wijaya Pratama', jur: 'Teknik Pemesinan', kls: '11-TP 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                  { nis: '12998503', nama: 'Dewi Lestari Kusuma', jur: 'Teknik Pemesinan', kls: '12-TP 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                  { nis: '12998504', nama: 'Budi Santoso Purba', jur: 'Teknik Pemesinan', kls: '10-TP 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '22 Hari', p: '88.0%' },
                  { nis: '12998505', nama: 'Lia Ananda Saputri', jur: 'Teknik Kendaraan Ringan', kls: '11-TKR 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                  { nis: '12998506', nama: 'Fajar Ramadhan', jur: 'Teknik Kendaraan Ringan', kls: '12-TKR 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                  { nis: '12998507', nama: 'Nabila Syakieb', jur: 'Teknik Kendaraan Ringan', kls: '10-TKR 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '23 Hari', p: '92.0%' },
                ].filter(s => (selectedJurusan === 'Semua Jurusan' || s.jur === selectedJurusan) && (selectedKelas === 'Semua Kelas' || s.kls === selectedKelas));
                return `${filtered.length} Siswa Terdaftar`;
              })()}
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider whitespace-nowrap">
                  <th className="py-2.5 px-3 w-12 text-center rounded-l-xl">No</th>
                  <th className="py-2.5 px-3">NISN</th>
                  <th className="py-2.5 px-3">Nama Lengkap Siswa</th>
                  <th className="py-2.5 px-3">Jurusan / Kelas</th>
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-center">Hadir</th>
                  <th className="py-2.5 px-3 text-center rounded-r-xl">Status Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {(() => {
                  const filtered = [
                    { nis: '12998374', nama: 'Muhammad Fadli', jur: 'Rekayasa Perangkat Lunak', kls: '12-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                    { nis: '12998375', nama: 'Siti Rahmawati', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                    { nis: '12998500', nama: 'Rian Hidayat', jur: 'Rekayasa Perangkat Lunak', kls: '11-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '23 Hari', p: '92.0%' },
                    { nis: '12998501', nama: 'Zaskia Putri Amanda', jur: 'Rekayasa Perangkat Lunak', kls: '10-RPL 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                    { nis: '12998502', nama: 'Andi Wijaya Pratama', jur: 'Teknik Pemesinan', kls: '11-TP 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                    { nis: '12998503', nama: 'Dewi Lestari Kusuma', jur: 'Teknik Pemesinan', kls: '12-TP 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                    { nis: '12998504', nama: 'Budi Santoso Purba', jur: 'Teknik Pemesinan', kls: '10-TP 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '22 Hari', p: '88.0%' },
                    { nis: '12998505', nama: 'Lia Ananda Saputri', jur: 'Teknik Kendaraan Ringan', kls: '11-TKR 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '24 Hari', p: '96.0%' },
                    { nis: '12998506', nama: 'Fajar Ramadhan', jur: 'Teknik Kendaraan Ringan', kls: '12-TKR 1', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '25 Hari', p: '100%' },
                    { nis: '12998507', nama: 'Nabila Syakieb', jur: 'Teknik Kendaraan Ringan', kls: '10-TKR 2', bln: new Date().toLocaleDateString('id-ID', { month: 'long' }), h: '23 Hari', p: '92.0%' },
                  ].filter(s => (selectedJurusan === 'Semua Jurusan' || s.jur === selectedJurusan) && (selectedKelas === 'Semua Kelas' || s.kls === selectedKelas));
                  
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                          Tidak ada siswa di kelas ini.
                        </td>
                      </tr>
                    )
                  }

                  return filtered.map((s, idx) => (
                    <tr 
                      key={s.nis} 
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer whitespace-nowrap"
                      onClick={() => setSelectedStudent(s)}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-indigo-950">{s.nis}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold border border-slate-200/80">
                          {s.kls}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">{s.bln}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">{s.h}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs">
                          Tercapai ({s.p})
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {monthlyRecap.length === 0 ? (
          <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
            <p className="text-xs text-slate-500 font-semibold mb-1">Riwayat Multi-Bulan Belum Termuat</p>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto mb-3">Tekan tombol "Muat Riwayat 6 Bulan" di atas untuk memuat riwayat data presensi agar rekap persen bulanan dapat dikalkukasi otomatis.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual Recharts Bar Chart Comparting 6 Months Attendance Volume */}
            <div className="bg-slate-50/40 border border-slate-200/50 p-4 sm:p-5 rounded-3xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Volume Kehadiran 6 Bulan Terakhir</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Komparasi kuantitatif sebaran status kehadiran murid & guru tiap bulan</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] font-bold font-mono bg-white px-3 py-1.5 border border-slate-200/40 rounded-xl self-start sm:self-auto">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Hadir</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Sakit</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Izin</span>
                </div>
              </div>

              <div className="w-full h-[240px] text-[10px] font-mono leading-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRecap} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="monthShort" 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#94a3b8" 
                      style={{ fontSize: 10, fontWeight: 700 }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#94a3b8" 
                      style={{ fontSize: 10, fontWeight: 700 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(79, 70, 229, 0.03)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const activeMonthObj = monthlyRecap.find(m => m.monthShort === label);
                          return (
                            <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl text-[10px] border border-slate-800 backdrop-blur-sm z-30">
                              <p className="font-extrabold uppercase tracking-wider text-indigo-300 font-mono border-b border-slate-800 pb-1.5 mb-2.5 flex justify-between items-center gap-10">
                                <span>{activeMonthObj ? activeMonthObj.monthName : label}</span>
                                <span className="bg-indigo-55 bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200">
                                  {activeMonthObj ? `${activeMonthObj.percentage}%` : ''}
                                </span>
                              </p>
                              <div className="space-y-1.5 font-semibold font-sans">
                                <div className="flex justify-between items-center gap-6">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Hadir:
                                  </span>
                                  <span className="font-extrabold font-mono text-slate-100">{payload[0].value} Absen</span>
                                </div>
                                <div className="flex justify-between items-center gap-6">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Sakit:
                                  </span>
                                  <span className="font-extrabold font-mono text-slate-100">{payload[1].value} Absen</span>
                                </div>
                                <div className="flex justify-between items-center gap-6">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                    Izin:
                                  </span>
                                  <span className="font-extrabold font-mono text-slate-100">{payload[2].value} Absen</span>
                                </div>
                                <div className="flex justify-between items-center gap-6 border-t border-slate-800/60 pt-2 mt-2 text-indigo-200/90 font-extrabold font-mono">
                                  <span>Total Absensi:</span>
                                  <span className="text-white">{activeMonthObj ? activeMonthObj.total : 0} Log</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="hadir" name="Hadir" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="sakit" name="Sakit" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="izin" name="Izin" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Individual monthly percentage highlight cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {monthlyRecap.map((item, index) => (
                <motion.div 
                  key={item.monthIndex} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-slate-50/50 border border-slate-200/50 p-3 rounded-2xl flex flex-col justify-between hover:bg-white transition-all shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{item.monthName}</p>
                      <Award size={11} className={item.percentage >= 95 ? 'text-emerald-500' : 'text-indigo-400'} />
                    </div>
                    <p className="text-lg font-black text-slate-800 leading-none">{item.percentage}%</p>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border mt-2 inline-block ${item.colorClass}`}>
                      {item.grade}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.barColor}`} style={{ width: `${item.percentage}%` }}></div>
                    </div>
                    <p className="text-[8px] font-mono font-bold text-slate-400 mt-1">{item.hadir}/{item.total} Absen Hadir</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg font-mono">
                  {selectedStudent.nama.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedStudent.nama}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono font-semibold text-slate-500">
                    <span>{selectedStudent.nis}</span>
                    <span>•</span>
                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">{selectedStudent.kls}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-500" />
                  Grafik Kehadiran 6 Bulan Terakhir
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold mb-4">Analisis tren riwayat presensi siswa bulan per bulan</p>
                
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { bulan: 'Jan', hadir: 22 },
                      { bulan: 'Feb', hadir: 20 },
                      { bulan: 'Mar', hadir: 24 },
                      { bulan: 'Apr', hadir: 21 },
                      { bulan: 'Mei', hadir: 25 },
                      { bulan: 'Jun', hadir: parseInt(selectedStudent.h) || 24 }
                    ]} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="bulan" tickLine={false} axisLine={false} stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 700 }} />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl text-[10px] font-sans border border-slate-800/80">
                                <div className="font-extrabold uppercase text-indigo-300 mb-1 font-mono">{payload[0].payload.bulan}</div>
                                <div className="font-bold text-emerald-400 text-sm">{payload[0].value} <span className="text-[9px] text-slate-400">Hari Hadir</span></div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line type="monotone" dataKey="hadir" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono block mb-1">Total Kehadiran Bulan Ini</span>
                  <span className="text-2xl font-black text-emerald-700">{selectedStudent.h}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono block mb-1">Capaian Kehadiran</span>
                  <span className="text-2xl font-black text-indigo-700">{selectedStudent.p}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmDialog(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
          >
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Printer size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 mb-2">Konfirmasi Tindakan</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Apakah Anda yakin ingin {confirmDialog.title}?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
