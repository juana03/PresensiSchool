/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  ChevronRight, 
  BookOpen, 
  Info,
  ExternalLink,
  PlusSquare,
  Sparkles,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  FileSpreadsheet,
  Users2,
  Calendar
} from 'lucide-react';
import { SPREADSHEET_GUIDE, CODE_GS_CONTENT, INDEX_HTML_CONTENT } from '../codeSnippets';
import { SimulatedRecord } from '../types';
import { registeredMembers } from '../data/directory';
import { jsPDF } from 'jspdf';

interface ExporterProps {
  records: SimulatedRecord[];
}

export default function Exporter({ records }: ExporterProps) {
  const [activeTab, setActiveTab] = useState<'sheets' | 'backend' | 'frontend' | 'deploy' | 'reports'>('sheets');
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});

  const [reportRole, setReportRole] = useState<'murid' | 'guru'>('murid');
  const [reportMonth, setReportMonth] = useState<number | 'all'>(5); // Default to June (index 5)
  const [reportFilterType, setReportFilterType] = useState<'month' | 'dateRange'>('month');
  const [reportStartDate, setReportStartDate] = useState<string>('2026-06-01');
  const [reportEndDate, setReportEndDate] = useState<string>('2026-06-11');
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState(0);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    });
  };

  const calculateMemberStats = (role: 'murid' | 'guru', monthFilter: number | 'all') => {
    const members = registeredMembers.filter(m => m.role === role);
    return members.map(m => {
      // Filter records for this member in the selected month/range
      const memberRecords = records.filter(r => {
        if (r.type !== role) return false;
        const idMatches = role === 'murid' 
          ? (r.data as any).nis === m.id 
          : (r.data as any).nip === m.id;
        if (!idMatches) return false;
        
        if (reportFilterType === 'month') {
          if (monthFilter !== 'all') {
            const recordMonth = new Date(r.timestamp).getMonth();
            return recordMonth === monthFilter;
          }
        } else {
          const rDate = new Date(r.timestamp);
          if (reportStartDate) {
            const startD = new Date(reportStartDate);
            startD.setHours(0, 0, 0, 0);
            if (rDate < startD) return false;
          }
          if (reportEndDate) {
            const endD = new Date(reportEndDate);
            endD.setHours(23, 59, 59, 999);
            if (rDate > endD) return false;
          }
        }
        return true;
      });

      const activeDays = memberRecords.length;
      const hadir = memberRecords.filter(r => r.data.status === 'Hadir').length;
      const sakit = memberRecords.filter(r => r.data.status === 'Sakit').length;
      const izin = memberRecords.filter(r => r.data.status === 'Izin').length;
      const percentage = activeDays > 0 ? Math.round((hadir / activeDays) * 100) : 100;

      return {
        id: m.id,
        name: m.name,
        detail: m.detail,
        activeDays,
        hadir,
        sakit,
        izin,
        percentage: activeDays > 0 ? percentage : null
      };
    });
  };

  const handleDownloadCSV = (role: 'murid' | 'guru', monthFilter: number | 'all', monthName: string) => {
    const stats = calculateMemberStats(role, monthFilter);
    const headers = role === 'murid' 
      ? 'NISN,Nama Siswa,Kelas,Hari Aktif,Kehadiran Hadir,Kehadiran Sakit,Kehadiran Izin,Persentase Kehadiran (%)\n'
      : 'NIP,Nama Guru / Staf,Jabatan,Hari Aktif,Kehadiran Hadir,Kehadiran Sakit,Kehadiran Izin,Persentase Kehadiran (%)\n';
      
    const rows = stats.map(s => {
      const pct = s.percentage !== null ? `${s.percentage}%` : '0%';
      return `"${s.id}","${s.name}","${s.detail}",${s.activeDays},${s.hadir},${s.sakit},${s.izin},"${pct}"`;
    }).join('\n');
    
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const nameSuffix = reportFilterType === 'month' ? monthName.replace(/\s+/g, '_') : `${reportStartDate}_sd_${reportEndDate}`;
    link.setAttribute('download', `Laporan_Absensi_${role === 'murid' ? 'Siswa' : 'Guru'}_${nameSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncToSheets = async () => {
    if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com/macros/s/')) {
      setExportStatus('error_url');
      return;
    }

    setExporting(true);
    setExportStatus('');
    setSyncProgress(0);

    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 10) + 5;
      });
    }, 300);

    try {
      const payload = records.map(r => ({
        id: r.id,
        waktu: new Date(r.timestamp).toISOString(),
        role: r.type,
        uid: r.type === 'murid' ? (r.data as any).nis : (r.data as any).nip,
        nama: r.data.nama,
        detail: r.type === 'murid' ? (r.data as any).kelas : (r.data as any).jabatan,
        status: r.data.status
      }));

      // No-cors mode is often required for GAS web apps when called from a browser directly without CORS headers setup
      // Note: with 'no-cors' we can't read the exact JSON response, assume success if no throw
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'syncTabelAbsensi', data: payload })
      });
      
      clearInterval(progressInterval);
      setSyncProgress(100);
      setExportStatus('success');
    } catch (e) {
      clearInterval(progressInterval);
      console.error(e);
      setExportStatus('error_fetch');
    } finally {
      setTimeout(() => {
        setExporting(false);
      }, 500); // 500ms delay to finish filling the visual bar to 100%
      setTimeout(() => {
        if (exportStatus !== 'error_url') setExportStatus('');
        setSyncProgress(0);
      }, 5000);
    }
  };

  const handlePrintPDF = (role: 'murid' | 'guru', monthFilter: number | 'all', monthName: string) => {
    const stats = calculateMemberStats(role, monthFilter);
    
    // Initialize jsPDF document (A4 size, portrait, mm units)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Draw School Crest Emblem (Deep Navy circular badge)
    doc.setFillColor(30, 27, 75); // Deep Indigo (#1e1b4b)
    doc.circle(25, 23, 10, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TH', 25, 26, { align: 'center' });

    // 2. School Header Text Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('PEMERINTAH PROVINSI JAWA BARAT', 38, 17);
    
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('DINAS PENDIDIKAN SMK TUTWURI HANDAYANI CIMAHI', 38, 22.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115); // Neutral-400
    doc.text('Jl. Kolonel Masturi No. 17, Cimahi, Jawa Barat | Telp: (022) 6652431 | Web: smktutwurihandayani.sch.id', 38, 27.5);

    // 3. Header Dual Line Separator
    doc.setDrawColor(71, 85, 105); // Slate-600
    doc.setLineWidth(0.8);
    doc.line(15, 33, 195, 33);
    doc.setLineWidth(0.2);
    doc.line(15, 34.2, 195, 34.2);

    // 4. Report Document Title
    const titleY = 44;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 27, 75); // Deep Indigo
    const reportTitle = `LAPORAN REKAPITULASI KEHADIRAN ${role === 'murid' ? 'PESERTA DIDIK (SISWA)' : 'PEGAWAI (GURU & STAF)'}`;
    doc.text(reportTitle, 105, titleY, { align: 'center' });

    let rangeText = '';
    if (reportFilterType === 'month') {
      rangeText = `${monthName} 2026`;
    } else {
      const formatDateStr = (ymdStr: string) => {
        if (!ymdStr) return '';
        const d = new Date(ymdStr);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      rangeText = `${formatDateStr(reportStartDate)} s/d ${formatDateStr(reportEndDate)}`;
    }

    const docTypeLabel = reportFilterType === 'month' ? 'BULANAN' : 'RENTANG TANGGAL';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Tahun Ajaran: 2025/2026 | Tipe: ${docTypeLabel} | Rentang: ${rangeText}`, 105, titleY + 5, { align: 'center' });

    // 5. Metadata Block
    const metaY = 58;
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(15, metaY, 195, metaY);

    // Metadata Left Side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108); // Stone-500
    doc.text('KLASIFIKASI DOKUMEN:', 15, metaY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(role === 'murid' ? 'Data Pokok Pendidikan (SIAKAD)' : 'Daftar Pembinaan ASN/GTK', 15, metaY + 9);

    // Metadata Right Side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108); // Stone-500
    doc.text('DITERBITKAN PADA / OLEH:', 195, metaY + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // Slate-900
    const nowStr = `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date().toLocaleTimeString('id-ID')} WIB`;
    doc.text(`${nowStr} / ADMIN SMK TUTWURI`, 195, metaY + 9, { align: 'right' });

    doc.line(15, metaY + 12.5, 195, metaY + 12.5);

    // 6. Report Grid Table Design
    const tableHeaderY = 76;
    doc.setFillColor(248, 250, 252); // Soft Gray Slate-50 background
    doc.rect(15, tableHeaderY, 180, 8, 'F');
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.3);
    doc.line(15, tableHeaderY, 195, tableHeaderY);
    doc.line(15, tableHeaderY + 8, 195, tableHeaderY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // Slate-600

    doc.text('No', 15 + 4, tableHeaderY + 5.5, { align: 'center' });
    doc.text(role === 'murid' ? 'NISN' : 'NIP', 25, tableHeaderY + 5.5);
    doc.text('Nama Lengkap', 50, tableHeaderY + 5.5);
    doc.text(role === 'murid' ? 'Kelas / Rombel' : 'Jabatan Kerja', 105, tableHeaderY + 5.5);
    doc.text('Aktif', 135 + 7.5, tableHeaderY + 5.5, { align: 'center' });
    doc.text('Hadir', 150 + 6, tableHeaderY + 5.5, { align: 'center' });
    doc.text('Sakit', 162 + 5.5, tableHeaderY + 5.5, { align: 'center' });
    doc.text('Izin', 173 + 5.5, tableHeaderY + 5.5, { align: 'center' });
    doc.text('Persentase', 184 + 5.5, tableHeaderY + 5.5, { align: 'center' });

    // Render Table Data Rows with Pagination
    let currentY = tableHeaderY + 8;
    const rowHeight = 7;

    stats.forEach((s, idx) => {
      // Auto-paginate if table contents exceed safe limits
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;

        // Redraw table headers on new page
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(15, currentY, 195, currentY);
        doc.line(15, currentY + 8, 195, currentY + 8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('No', 15 + 4, currentY + 5.5, { align: 'center' });
        doc.text(role === 'murid' ? 'NISN' : 'NIP', 25, currentY + 5.5);
        doc.text('Nama Lengkap', 50, currentY + 5.5);
        doc.text(role === 'murid' ? 'Kelas / Rombel' : 'Jabatan Kerja', 105, currentY + 5.5);
        doc.text('Aktif', 135 + 7.5, currentY + 5.5, { align: 'center' });
        doc.text('Hadir', 150 + 6, currentY + 5.5, { align: 'center' });
        doc.text('Sakit', 162 + 5.5, currentY + 5.5, { align: 'center' });
        doc.text('Izin', 173 + 5.5, currentY + 5.5, { align: 'center' });
        doc.text('Persentase', 184 + 5.5, currentY + 5.5, { align: 'center' });
        
        currentY += 8;
      }

      // Draw zebra stripe
      if (idx % 2 === 1) {
        doc.setFillColor(252, 253, 254);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      // Bottom separator for each row
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      // Value font setup
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      // Index No
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(115, 115, 115);
      doc.text(`${idx + 1}`, 15 + 4, currentY + 4.5, { align: 'center' });

      // ID (NIP/NISN)
      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text(`'${s.id}`, 25, currentY + 4.5);

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      let truncateName = s.name;
      if (truncateName.length > 28) {
        truncateName = truncateName.substring(0, 26) + '..';
      }
      doc.text(truncateName, 50, currentY + 4.5);

      // Detail
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      let truncateDetail = s.detail;
      if (truncateDetail.length > 18) {
        truncateDetail = truncateDetail.substring(0, 16) + '..';
      }
      doc.text(truncateDetail, 105, currentY + 4.5);

      // Active
      doc.setTextColor(15, 23, 42);
      doc.text(`${s.activeDays}`, 135 + 7.5, currentY + 4.5, { align: 'center' });

      // Hadir (Emerald-600)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`${s.hadir}`, 150 + 6, currentY + 4.5, { align: 'center' });

      // Sakit (Amber-600)
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(217, 119, 6);
      doc.text(`${s.sakit}`, 162 + 5.5, currentY + 4.5, { align: 'center' });

      // Izin (Blue-600)
      doc.setTextColor(29, 78, 216);
      doc.text(`${s.izin}`, 173 + 5.5, currentY + 4.5, { align: 'center' });

      // Percentage Rate
      const pctText = s.percentage !== null ? `${s.percentage}%` : '-';
      doc.setFont('helvetica', 'bold');
      if (s.percentage === null) {
        doc.setTextColor(148, 163, 184); // Slate-400 (neutral gray)
      } else if (s.percentage >= 95) {
        doc.setTextColor(5, 150, 105); // Emerald-600
      } else if (s.percentage >= 90) {
        doc.setTextColor(79, 70, 229); // Indigo-600
      } else {
        doc.setTextColor(220, 38, 38); // Rose-600
      }
      doc.text(pctText, 184 + 5.5, currentY + 4.5, { align: 'center' });

      currentY += rowHeight;
    });

    // 7. Sign off & School official signature block
    if (currentY + 40 > 280) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 10;
    }

    const ttdDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cimahi, ${ttdDateStr}`, 195, currentY, { align: 'right' });
    doc.text('Mengetahui,', 195, currentY + 4.5, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala SMK Tutwuri Handayani, Cimahi', 195, currentY + 9, { align: 'right' });

    // Official signature space spacer & printed name
    doc.setFont('helvetica', 'bold');
    doc.text('Drs. Ronald Situmorang, M.Pd.', 195, currentY + 28, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('NIP. 197205121998031002', 195, currentY + 32, { align: 'right' });

    // Sah Stamp Watermark Label
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(194, 65, 12); // Amber-700
    doc.text('✓ Dokumen hasil rekap otomatis SIAKAD terhubung cloud. Sah secara dinamis.', 15, currentY + 32);

    // 8. Download Triggers
    const finalSuffix = reportFilterType === 'month' ? monthName.toUpperCase() : `${reportStartDate}_sd_${reportEndDate}`;
    doc.save(`SIAKAD_REKAP_${role.toUpperCase()}_SMK_TUTWURI_${finalSuffix}.pdf`);
  };

  const handlePrintRecordsPDF = (role: 'murid' | 'guru', monthFilter: number | 'all', monthName: string) => {
    // 1. Get filtered individual records
    const filtered = records.filter(r => {
      if (r.type !== role) return false;
      
      if (reportFilterType === 'month') {
        if (monthFilter !== 'all') {
          const recordMonth = new Date(r.timestamp).getMonth();
          return recordMonth === monthFilter;
        }
      } else {
        const rDate = new Date(r.timestamp);
        if (reportStartDate) {
          const startD = new Date(reportStartDate);
          startD.setHours(0, 0, 0, 0);
          if (rDate < startD) return false;
        }
        if (reportEndDate) {
          const endD = new Date(reportEndDate);
          endD.setHours(23, 59, 59, 999);
          if (rDate > endD) return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

    // Initialize jsPDF document (A4 size, portrait, mm units)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Draw School Crest Emblem (Deep Navy circular badge)
    doc.setFillColor(30, 27, 75); // Deep Indigo (#1e1b4b)
    doc.circle(25, 23, 10, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TH', 25, 26, { align: 'center' });

    // 2. School Header Text Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('PEMERINTAH PROVINSI JAWA BARAT', 38, 17);
    
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('DINAS PENDIDIKAN SMK TUTWURI HANDAYANI CIMAHI', 38, 22.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115); // Neutral-400
    doc.text('Jl. Kolonel Masturi No. 17, Cimahi, Jawa Barat | Telp: (022) 6652431 | Web: smktutwurihandayani.sch.id', 38, 27.5);

    // 3. Header Dual Line Separator
    doc.setDrawColor(71, 85, 105); // Slate-600
    doc.setLineWidth(0.8);
    doc.line(15, 33, 195, 33);
    doc.setLineWidth(0.2);
    doc.line(15, 34.2, 195, 34.2);

    // 4. Report Document Title
    const titleY = 44;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 27, 75); // Deep Indigo
    const reportTitle = `LAPORAN LOG DETAIL PRESENSI KEHADIRAN ${role === 'murid' ? 'SISWA' : 'GURU & STAF'}`;
    doc.text(reportTitle, 105, titleY, { align: 'center' });

    let rangeText = '';
    if (reportFilterType === 'month') {
      rangeText = `${monthName} 2026`;
    } else {
      const formatDateStr = (ymdStr: string) => {
        if (!ymdStr) return '';
        const d = new Date(ymdStr);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      };
      rangeText = `${formatDateStr(reportStartDate)} s/d ${formatDateStr(reportEndDate)}`;
    }

    const docTypeLabel = reportFilterType === 'month' ? 'LOG BULANAN' : 'LOG RENTANG TANGGAL';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Tahun Ajaran: 2025/2026 | Tipe: ${docTypeLabel} | Rentang: ${rangeText}`, 105, titleY + 5, { align: 'center' });

    // 5. Metadata Block
    const metaY = 58;
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(15, metaY, 195, metaY);

    // Metadata Left Side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108); // Stone-500
    doc.text('KLASIFIKASI DOKUMEN:', 15, metaY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(role === 'murid' ? 'Log Presensi Harian Siswa (SIAKAD)' : 'Log Presensi Harian Guru GTT/PNS', 15, metaY + 9);

    // Metadata Right Side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108); // Stone-500
    doc.text('DITERBITKAN PADA / OLEH:', 195, metaY + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // Slate-900
    const nowStr = `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date().toLocaleTimeString('id-ID')} WIB`;
    doc.text(`${nowStr} / ADMIN SMK TUTWURI`, 195, metaY + 9, { align: 'right' });

    doc.line(15, metaY + 12.5, 195, metaY + 12.5);

    // 6. Report Grid Table Design
    const tableHeaderY = 76;
    doc.setFillColor(248, 250, 252); // Soft Gray Slate-50 background
    doc.rect(15, tableHeaderY, 180, 8, 'F');
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.3);
    doc.line(15, tableHeaderY, 195, tableHeaderY);
    doc.line(15, tableHeaderY + 8, 195, tableHeaderY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // Slate-600

    doc.text('No', 15 + 3, tableHeaderY + 5.5, { align: 'center' });
    doc.text('Waktu / Tanggal', 23, tableHeaderY + 5.5);
    doc.text(role === 'murid' ? 'NISN' : 'NIP', 46, tableHeaderY + 5.5);
    doc.text('Nama Lengkap', 64, tableHeaderY + 5.5);
    doc.text(role === 'murid' ? 'Kelas' : 'Jabatan Kerja', 106, tableHeaderY + 5.5);
    doc.text('Status', 131, tableHeaderY + 5.5);
    doc.text('Verifikasi', 146, tableHeaderY + 5.5);
    doc.text('Keterangan', 170, tableHeaderY + 5.5);

    // Render Table Data Rows with Pagination
    let currentY = tableHeaderY + 8;
    const rowHeight = 7;

    filtered.forEach((r, idx) => {
      // Auto-paginate if table contents exceed safe limits
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;

        // Redraw table headers on new page
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(15, currentY, 195, currentY);
        doc.line(15, currentY + 8, 195, currentY + 8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('No', 15 + 3, currentY + 5.5, { align: 'center' });
        doc.text('Waktu / Tanggal', 23, currentY + 5.5);
        doc.text(role === 'murid' ? 'NISN' : 'NIP', 46, currentY + 5.5);
        doc.text('Nama Lengkap', 64, currentY + 5.5);
        doc.text(role === 'murid' ? 'Kelas' : 'Jabatan Kerja', 106, currentY + 5.5);
        doc.text('Status', 131, currentY + 5.5);
        doc.text('Verifikasi', 146, currentY + 5.5);
        doc.text('Keterangan', 170, currentY + 5.5);
        
        currentY += 8;
      }

      // Draw zebra stripe
      if (idx % 2 === 1) {
        doc.setFillColor(252, 253, 254);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      // Bottom separator for each row
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      // Value font setup
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      // Index No
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(115, 115, 115);
      doc.text(`${idx + 1}`, 15 + 3, currentY + 4.5, { align: 'center' });

      // Timestamp
      let timeLabel = '';
      try {
        const dObj = new Date(r.timestamp);
        const hh = String(dObj.getHours()).padStart(2, '0');
        const mm = String(dObj.getMinutes()).padStart(2, '0');
        const dayLabel = dObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
        timeLabel = `${hh}:${mm} - ${dayLabel}`;
      } catch (err) {
        timeLabel = r.timestamp || '';
      }
      doc.setFont('courier', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(timeLabel, 23, currentY + 4.5);

      // ID (NIP/NISN)
      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229); // Indigo-600
      const idVal = role === 'murid' ? (r.data as any).nis : (r.data as any).nip;
      doc.text(`'${idVal}`, 46, currentY + 4.5);

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      let truncateName = r.data.nama || '';
      if (truncateName.length > 25) {
        truncateName = truncateName.substring(0, 23) + '..';
      }
      doc.text(truncateName, 64, currentY + 4.5);

      // Class/Detail
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      let truncateDetail = (role === 'murid' ? (r.data as any).kelas : (r.data as any).jabatan) || '';
      if (truncateDetail.length > 15) {
        truncateDetail = truncateDetail.substring(0, 13) + '..';
      }
      doc.text(truncateDetail, 106, currentY + 4.5);

      // Status
      doc.setFont('helvetica', 'bold');
      if (r.data.status === 'Hadir') {
        doc.setTextColor(5, 150, 105); // Emerald-600
      } else if (r.data.status === 'Sakit') {
        doc.setTextColor(217, 119, 6); // Amber-600
      } else {
        doc.setTextColor(29, 78, 216); // Blue-600
      }
      doc.text(r.data.status || 'Hadir', 131, currentY + 4.5);

      // Verifikasi
      doc.setFont('helvetica', 'normal');
      if (r.data.latitude === null || r.data.latitude === undefined) {
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text('Tanpa GPS', 146, currentY + 4.5);
      } else if (r.data.isWithinRadius) {
        doc.setTextColor(5, 150, 105); // Emerald-600
        doc.text('Sesuai Area', 146, currentY + 4.5);
      } else {
        doc.setTextColor(220, 38, 38); // Red-600
        doc.text('Luar Area', 146, currentY + 4.5);
      }

      // Keterangan
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(115, 115, 115);
      let truncateKeterangan = r.data.keterangan || '-';
      if (truncateKeterangan.length > 15) {
        truncateKeterangan = truncateKeterangan.substring(0, 13) + '..';
      }
      doc.text(truncateKeterangan, 170, currentY + 4.5);

      currentY += rowHeight;
    });

    if (filtered.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text('Belum ada log data presensi yang masuk untuk rentang pengamatan ini.', 105, currentY + 8, { align: 'center' });
      currentY += 15;
    }

    // 7. Sign off & School official signature block
    if (currentY + 40 > 280) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 10;
    }

    const ttdDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cimahi, ${ttdDateStr}`, 195, currentY, { align: 'right' });
    doc.text('Mengetahui,', 195, currentY + 4.5, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala SMK Tutwuri Handayani, Cimahi', 195, currentY + 9, { align: 'right' });

    // Official signature space spacer & printed name
    doc.setFont('helvetica', 'bold');
    doc.text('Drs. Ronald Situmorang, M.Pd.', 195, currentY + 28, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('NIP. 197205121998031002', 195, currentY + 32, { align: 'right' });

    // Sah Stamp Watermark Label
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(194, 65, 12); // Amber-700
    doc.text('✓ Dokumen hasil rekap otomatis SIAKAD terhubung cloud. Sah secara dinamis.', 15, currentY + 32);

    // 8. Download Triggers
    const logSuffix = reportFilterType === 'month' ? monthName.toUpperCase() : `${reportStartDate}_sd_${reportEndDate}`;
    doc.save(`SIAKAD_LOG_${role.toUpperCase()}_SMK_TUTWURI_${logSuffix}.pdf`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-5 sm:p-6 flex flex-col h-full justify-between">
      <div>
        {/* Module Header */}
        <div className="flex items-center gap-2.5 mb-5 border-b border-slate-100 pb-4">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <FileCode size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">Pusat Integrasi & Source Code</h2>
            <span className="text-[11px] text-slate-400 font-semibold mt-1.5 block">Salin kode siap pakai dan ikuti panduan deploy ke Google Apps Script</span>
          </div>
        </div>

        {/* Integration Wizard Tab selectors */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 bg-slate-50 p-1.5 rounded-2xl mb-5 text-center text-xs font-bold font-sans">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            1. Sheets DB
          </button>
          <button
            onClick={() => setActiveTab('backend')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'backend'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            2. Code.gs
          </button>
          <button
            onClick={() => setActiveTab('frontend')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'frontend'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            3. Index.html
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'deploy'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            4. Panduan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`py-2 col-span-2 md:col-span-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700/20'
                : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/50 border border-indigo-100'
            }`}
          >
            <FileSpreadsheet size={13} />
            <span>5. Ekspor Laporan</span>
          </button>
        </div>

        {/* WIZARD CARD WRAPPER */}
        <div className="min-h-[300px]">
          
          {/* TAB 1: SPREADSHEET DATABASE STRUCTURE SETUP */}
          {activeTab === 'sheets' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-2xl flex gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 mb-0.5">Automated Setups</h4>
                  <p className="text-emerald-800 leading-relaxed text-[11px]">
                    Jika spreadsheet Anda kosong, skrip <code className="bg-emerald-100/80 font-mono font-bold px-1 rounded">Code.gs</code> kami akan <strong>otomatis mendeteksi dan membuat sheet serta kolom navigasi</strong> yang diperlukan saat pertama kali di-panggil. Namun, kami sarankan Anda menyiapkan struktur awal agar langsung kompatibel.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-indigo-500" /> Aturan Struktur Google Sheets:
                </p>
                
                {SPREADSHEET_GUIDE.sheets.map((sheet, index) => {
                  const headerText = sheet.headers.join('\t');
                  return (
                    <div key={sheet.name} className="border border-slate-200/60 rounded-2xl p-4 bg-white shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center rounded-lg text-[10px]">
                            {index + 1}
                          </span>
                          <span className="font-bold text-slate-800 font-mono text-[11.5px]">Tab: {sheet.name}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(headerText, sheet.name)}
                          className="py-1 px-2.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all font-bold text-[10px] rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedState[sheet.name] ? (
                            <>
                              <Check size={11} className="text-emerald-500" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy Headers</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-slate-400 text-[10px] leading-tight font-medium italic">{sheet.description}</p>
                      
                      <div className="bg-slate-900 text-slate-300 p-2.5 rounded-xl overflow-x-auto font-mono text-[9.5px] border border-slate-800 shadow-inner flex items-center whitespace-nowrap gap-2">
                        {sheet.headers.map((h, i) => (
                          <span key={i} className="bg-slate-800 text-teal-400 px-2 py-1 rounded border border-slate-700/50">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-slate-400 leading-normal bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                <strong>Tips:</strong> Saat menyalin header di atas, Anda bisa langsung mengaktifkan sel pertama A1 di Google Sheets dan tekan <strong>Ctrl + V</strong> (atau CMD + V pada Mac) demi penulisan kolom instan.
              </div>
            </div>
          )}

          {/* TAB 2: CODE.GS (BACKEND SERVER SCRIPT) */}
          {activeTab === 'backend' && (
            <div className="space-y-3.5 animate-fadeIn text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  📄 Code.gs <span className="text-[10px] font-medium text-slate-400">(Skrip Backend Google Apps Script)</span>
                </span>
                <button
                  onClick={() => handleCopy(CODE_GS_CONTENT, 'backend_code')}
                  className="py-1 px-3 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all font-bold text-[11px] rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {copiedState['backend_code'] ? (
                    <>
                      <Check size={12} className="text-white" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Salin Code.gs</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code preview block */}
              <div className="relative">
                <div className="absolute top-2 right-2 bg-slate-800 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded text-indigo-400 font-mono select-none">
                  javascript / gas
                </div>
                <pre className="bg-slate-900 border border-slate-800 text-slate-300 p-3.5 rounded-2xl font-mono text-[10px] leading-relaxed overflow-x-auto max-h-[300px] shadow-inner select-all">
                  {CODE_GS_CONTENT}
                </pre>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex gap-2 text-[10px] text-indigo-950 leading-relaxed">
                <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">Konfigurasi Tambahan:</h5>
                  Pada skrip <code className="bg-indigo-100 font-mono font-bold px-1 rounded">Code.gs</code> di atas, Anda dapat menyesuaikan baris ke-9 dan ke-10 (koordinat sekolah) serta radius area aman (dalam meter) sesuai letak koordinat sekolah asli Anda. Formula internal menggunakan kalkulasi Haversine bola bumi yang presisi.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INDEX.HTML (FRONTEND CODE TEMPLATE) */}
          {activeTab === 'frontend' && (
            <div className="space-y-3.5 animate-fadeIn text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  📄 Index.html <span className="text-[10px] font-medium text-slate-400">(Skrip Frontend Web App)</span>
                </span>
                <button
                  onClick={() => handleCopy(INDEX_HTML_CONTENT, 'frontend_code')}
                  className="py-1 px-3 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transition-all font-bold text-[11px] rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {copiedState['frontend_code'] ? (
                    <>
                      <Check size={12} className="text-white" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Salin Index.html</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code preview block */}
              <div className="relative">
                <div className="absolute top-2 right-2 bg-slate-800 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded text-blue-400 font-mono select-none">
                  html5 / tailwind / js
                </div>
                <pre className="bg-slate-900 border border-slate-800 text-slate-300 p-3.5 rounded-2xl font-mono text-[10px] leading-relaxed overflow-x-auto max-h-[300px] shadow-inner select-all">
                  {INDEX_HTML_CONTENT}
                </pre>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex gap-2 text-[10px] text-blue-950 leading-relaxed">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">Keunggulan Desain:</h5>
                  Kode HTML di atas fully-responsive, modular, bersih, dan menggunakan design system modern yang bernuansa premium. Dilengkapi dengan live ticking clock, verifikasi status GPS real-time, form disabler (anti-spam), serta pop-up SweetAlert2 yang memukau.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STEP-BY-STEP DEPLOYMENT TUTORIAL */}
          {activeTab === 'deploy' && (
            <div className="space-y-3.5 animate-fadeIn text-[11px] leading-relaxed text-slate-650">
              <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <BookOpen size={13} className="text-purple-600" /> Langkah-Langkah Deploy Web App di GAS:
              </p>

              <div className="space-y-2.5">
                <div className="flex gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/50">
                  <div className="w-5 h-5 shrink-0 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center text-[10px]">1</div>
                  <div>
                    <h5 className="font-bold text-purple-950">Buka Spreadsheet & Apps Script</h5>
                    <p className="text-slate-500 text-[10.5px]">Buka Google Sheets Anda &rarr; klik menu <strong>Extensions (Ekstensi)</strong> di bagian atas &rarr; pilih <strong>Apps Script</strong>. Proyek editor skrip akan otomatis tebuka.</p>
                  </div>
                </div>

                <div className="flex gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/50">
                  <div className="w-5 h-5 shrink-0 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center text-[10px]">2</div>
                  <div>
                    <h5 className="font-bold text-purple-950">Tempel Kode Backend (Code.gs)</h5>
                    <p className="text-slate-500 text-[10.5px]">Di dalam Apps Script, ganti seluruh isi editor file bawaan <strong className="font-mono">Code.gs</strong> dengan menyalin dan menempelkan kode dari tab <strong>2. Code.gs</strong> di atas.</p>
                  </div>
                </div>

                <div className="flex gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/50">
                  <div className="w-5 h-5 shrink-0 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center text-[10px]">3</div>
                  <div>
                    <h5 className="font-bold text-purple-950">Buat File HTML Frontend (Index.html)</h5>
                    <p className="text-slate-500 text-[10.5px]">Di panel navigasi Apps Script sebelah kiri, klik tombol <strong>plus (+)</strong> &rarr; pilih <strong>HTML</strong> &rarr; namai file tersebut tepat <strong className="font-mono">Index</strong> (besar kecil huruf berpengaruh, jangan gunakan ekstensi .html). Ganti seluruh isinya dengan menempelkan kode dari tab <strong>3. Index.html</strong> di atas.</p>
                  </div>
                </div>

                <div className="flex gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/50">
                  <div className="w-5 h-5 shrink-0 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center text-[10px]">4</div>
                  <div>
                    <h5 className="font-bold text-purple-950">Lakukan Deploy Baru</h5>
                    <p className="text-slate-500 text-[10.5px]">Klik tombol <strong>Deploy</strong> di pojok kanan atas &rarr; pilih <strong>New Deployment</strong>. Klik roda gigi konfigurasi &rarr; pilih <strong>Web App</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/50">
                  <div className="w-5 h-5 shrink-0 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center text-[10px]">5</div>
                  <div>
                    <h5 className="font-bold text-purple-950">Atur Izin Akses Secara Tepat</h5>
                    <p className="text-slate-500 text-[10.5px] leading-relaxed">
                      Lengkapi form pengaturan berikut:<br />
                      • <strong>Execute As:</strong> Me (your-email@gmail.com)<br />
                      • <strong>Who has access:</strong> Anyone (Semua Orang - wajib agar warga sekolah bisa absen tanpa login email)<br />
                      Klik <strong>Deploy</strong>, lalu berikan izin otorisasi spreadsheet jika diminta Google. Salin <strong>Web App URL</strong> yang dihasilkan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-950 p-2.5 rounded-2xl flex gap-1.5 text-[10px] items-start mt-3">
                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Catatan Otorisasi:</strong> Saat pertama kali men-deploy atau melakukan pengujian, Google akan memunculkan peringatan <em>"Google hasn't verified this app"</em>. Ini normal untuk akun developer mandiri. Klik <strong>Advanced (Lanjutan)</strong> di pojok kiri bawah, lalu klik <strong>Go to Database_Absensi_Sekolah (unsafe)</strong> untuk melanjutkan.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: DYNAMIC REPORT EXPORT MECHANISM */}
          {activeTab === 'reports' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-1">
                    Kategori Absensi
                  </span>
                  <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReportRole('murid')}
                      className={`flex-1 py-1 bg-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        reportRole === 'murid' ? 'bg-white shadow-sm text-indigo-950 font-extrabold' : 'text-slate-500 bg-transparent'
                      }`}
                    >
                      Siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportRole('guru')}
                      className={`flex-1 py-1 bg-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        reportRole === 'guru' ? 'bg-white shadow-sm text-indigo-950 font-extrabold' : 'text-slate-500 bg-transparent'
                      }`}
                    >
                      Guru & Staf
                    </button>
                  </div>
                </div>

                <div className="w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-1">
                    Tipe Rentang Laporan
                  </span>
                  <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReportFilterType('month')}
                      className={`flex-1 py-1 bg-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        reportFilterType === 'month' ? 'bg-white shadow-sm text-indigo-950 font-extrabold' : 'text-slate-500 bg-transparent'
                      }`}
                    >
                      Bulanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFilterType('dateRange')}
                      className={`flex-1 py-1 bg-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        reportFilterType === 'dateRange' ? 'bg-white shadow-sm text-indigo-950 font-extrabold' : 'text-slate-500 bg-transparent'
                      }`}
                    >
                      Rentang Tanggal
                    </button>
                  </div>
                </div>

                <div className="w-full">
                  {reportFilterType === 'month' ? (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-1">
                        Pilih Bulan
                      </span>
                      <select
                        value={reportMonth}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReportMonth(val === 'all' ? 'all' : parseInt(val));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                      >
                        <option value="all">Semua Riwayat Bulanan</option>
                        <option value="0">Januari 2026</option>
                        <option value="1">Februari 2026</option>
                        <option value="2">Maret 2026</option>
                        <option value="3">April 2026</option>
                        <option value="4">Mei 2026</option>
                        <option value="5">Juni 2026</option>
                      </select>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-1">
                          Tanggal Mulai
                        </span>
                        <input
                          type="date"
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-705"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-1">
                          Tanggal Selesai
                        </span>
                        <input
                          type="date"
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-705"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance Table per Member */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner max-h-[180px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[10px] transition-colors duration-200">
                  <thead className="bg-[#f8fafc] dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 font-mono transition-colors duration-200">
                    <tr>
                      <th className="px-3 py-2 w-8 text-center text-slate-300">#</th>
                      <th className="px-3 py-2">{reportRole === 'murid' ? 'NISN' : 'NIP'}</th>
                      <th className="px-3 py-2 min-w-[100px]">Nama Lengkap</th>
                      <th className="px-3 py-2">{reportRole === 'murid' ? 'Kelas' : 'Jabatan'}</th>
                      <th className="px-3 py-2 text-center">Hari Aktif</th>
                      <th className="px-3 py-2 text-center">Hadir</th>
                      <th className="px-3 py-2 text-center">Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                    {(() => {
                      const list = calculateMemberStats(reportRole, reportMonth);
                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="text-center py-6 text-slate-400">
                              Tidak ada data yang cocok.
                            </td>
                          </tr>
                        );
                      }
                      return list.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-1.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-indigo-700">'{item.id}</td>
                          <td className="px-3 py-1.5 font-bold text-slate-900">{item.name}</td>
                          <td className="px-3 py-1.5 truncate max-w-[120px]" title={item.detail}>{item.detail}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{item.activeDays} hari</td>
                          <td className="px-3 py-1.5 text-center text-emerald-600 font-mono">{item.hadir} kali</td>
                          <td className="px-3 py-1.5 text-center">
                            {item.percentage !== null ? (
                              <span className={`px-2 py-0.5 rounded font-black font-mono text-[9px] ${
                                item.percentage >= 95 ? 'bg-emerald-100 text-emerald-800' :
                                item.percentage >= 90 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {item.percentage}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">0%</span>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Report Downloads Action Tray */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const monthName = reportMonth === 'all' ? 'Semua Bulan' : [
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
                    ][reportMonth];
                    handleDownloadCSV(reportRole, reportMonth, monthName);
                  }}
                  className="bg-emerald-600 text-white py-2.5 px-2 rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Ekspor CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monthName = reportMonth === 'all' ? 'Semua Bulan' : [
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
                    ][reportMonth];
                    handlePrintPDF(reportRole, reportMonth, monthName);
                  }}
                  className="bg-indigo-600 text-white py-2.5 px-2 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/10 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Unduh Rekap PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monthName = reportMonth === 'all' ? 'Semua Bulan' : [
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
                    ][reportMonth];
                    handlePrintRecordsPDF(reportRole, reportMonth, monthName);
                  }}
                  className="bg-purple-600 text-white py-2.5 px-2 rounded-xl hover:bg-purple-700 active:scale-[0.98] transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm shadow-purple-500/10 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Unduh Log PDF</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex gap-1.5 text-[9.5px] leading-relaxed text-slate-500">
                <Calendar size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Formulasi Ekspor:</strong> Kehadiran dihitung dari persentase status Hadir terhadap total record. Silakan muat riwayat melalui tombol <strong>"Muat Riwayat 6 Bulan"</strong> pada dashboard di atas untuk visualisasi rekap terisi penuh.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Exporter Footer Action */}
      <div className="border-t border-slate-100 pt-4 mt-5 flex flex-col gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <label className="text-xs font-bold text-slate-700 mb-2 block">Direct Export API URL (Google Apps Script Web App)</label>
          <div className="flex gap-2 flex-col sm:flex-row">
            <input 
              type="text" 
              value={scriptUrl}
              onChange={(e) => {
                setScriptUrl(e.target.value);
                if (exportStatus === 'error_url') setExportStatus('');
              }}
              placeholder="https://script.google.com/macros/s/..." 
              className={`flex-1 bg-white border ${exportStatus === 'error_url' ? 'border-rose-300 ring-rose-100' : 'border-slate-200'} rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400`}
            />
            <button 
              onClick={handleSyncToSheets}
              disabled={exporting || records.length === 0}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {exporting ? (
                <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Syncing...</span>
              ) : exportStatus === 'success' ? (
                <span className="flex items-center gap-1"><Check size={14} /> Berhasil!</span>
              ) : exportStatus === 'error_fetch' ? (
                <span className="flex items-center gap-1 text-rose-200"><AlertCircle size={14} /> Gagal Coba Lagi</span>
              ) : (
                <span className="flex items-center gap-1"><Sparkles size={14} /> Sinkronisasi Sekarang</span>
              )}
            </button>
          </div>
          {exporting && (
            <div className="mt-3 w-full animate-fadeIn">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-indigo-600">Terhubung ke Google Sheets...</span>
                <span className="text-[10px] sm:text-xs font-bold text-indigo-600">{syncProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2 overflow-hidden shadow-inner">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                  style={{ width: `${syncProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', transform: 'skewX(-20deg)' }}></div>
                </div>
              </div>
            </div>
          )}
          {exportStatus === 'error_url' && <p className="text-[10px] text-rose-500 mt-1.5 font-medium">URL Web App tidak valid. Pastikan dimulai dengan https://script.google.com/macros/s/...</p>}
        </div>

        <div className="flex justify-between items-center bg-white">
          <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Skrip Valid & Siap Digunakan</span>
          </div>
          <a 
            href="https://script.google.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/80 p-2 rounded-xl border border-indigo-100"
          >
            <span>Pusat Apps Script</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
