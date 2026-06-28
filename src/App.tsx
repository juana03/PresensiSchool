/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  School, 
  Award, 
  CheckCircle2, 
  Database, 
  FileCode, 
  Smartphone, 
  Compass, 
  Layers,
  MapPin,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info,
  Shield,
  User,
  GraduationCap,
  Bell,
  Settings,
  Trophy,
  Users,
  BarChart3,
  AlertCircle,
  LogOut,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import FormSimulator from './components/FormSimulator';
import LocalDatabase from './components/LocalDatabase';
import SummaryDashboard from './components/SummaryDashboard';
import MapDistribution from './components/MapDistribution';
import StudentPortal from './components/StudentPortal';
import TeacherPortal from './components/TeacherPortal';
import PiketPortal from './components/PiketPortal';
import LoginScreen from './components/LoginScreen';
import { backupRecordToFirestore, addActivityLogToFirestore, backupDailySnapshot } from './lib/firestoreService';
import { SimulatedRecord, StudentAttendance, TeacherAttendance, AttendanceStatus } from './types';
import { generateMonthlyMockData, registeredMembers } from './data/directory';
import { Joyride, Step } from 'react-joyride';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  findOrCreateSpreadsheet, 
  loadAllRecordsFromSheet, 
  appendRecordToUrl, 
  clearSpreadsheetRows,
  loadAccountsFromSheet,
  syncAccountsToSheet
} from './lib/sheetsService';

import schoolLogo from './assets/images/smk_tutwuri_handayani_logo_1782261943532.jpg';

import LiveSheetsDashboard from './components/LiveSheetsDashboard';

export default function App() {
  const [records, setRecords] = useState<SimulatedRecord[]>(() => {
    try {
      const saved = localStorage.getItem('absensi_simulated_records_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      }
    } catch(e) {}
    const dummy = generateMonthlyMockData() as SimulatedRecord[];
    const todayDummy: SimulatedRecord[] = [
      {
        id: 'mock-today-1',
        timestamp: new Date().toISOString(),
        type: 'murid',
        data: {
          timestamp: new Date().toISOString(),
          nis: '12998374',
          nama: 'Muhammad Fadli',
          kelas: '12-A',
          status: 'Hadir',
          keterangan: '-',
          latitude: -6.88371,
          longitude: 107.54511,
          jarak: 8,
          isWithinRadius: true
        }
      },
      {
        id: 'mock-today-2',
        timestamp: new Date().toISOString(),
        type: 'murid',
        data: {
          timestamp: new Date().toISOString(),
          nis: '12998375',
          nama: 'Siti Rahmawati',
          kelas: '10-B',
          status: 'Hadir',
          keterangan: '-',
          latitude: -6.88372,
          longitude: 107.54512,
          jarak: 12,
          isWithinRadius: true
        }
      },
      {
        id: 'mock-today-3',
        timestamp: new Date().toISOString(),
        type: 'guru',
        data: {
          timestamp: new Date().toISOString(),
          nip: '19780512',
          nama: 'Drs. Bambang Wijaya, M.Pd.',
          jabatan: 'Guru Kimia / Kepala TU',
          status: 'Hadir',
          keterangan: '-',
          latitude: -6.8837,
          longitude: 107.5451,
          jarak: 5,
          isWithinRadius: true
        }
      }
    ];
    const initial = [...todayDummy, ...dummy];
    try { localStorage.setItem('absensi_simulated_records_v2', JSON.stringify(initial)); } catch(e){}
    return initial;
  });
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // OAuth & Google Sheets Real Storage State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [members, setMembers] = useState<any[]>(registeredMembers);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('absensi_activity_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const addLog = useCallback((action: string, detail: string, user?: string) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user: user || currentUser?.displayName || 'Sistem',
      action,
      detail
    };
    setActivityLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 50);
      localStorage.setItem('absensi_activity_logs', JSON.stringify(updated));
      return updated;
    });
    
    // Auto-backup to Firestore (async, non-blocking)
    addActivityLogToFirestore(newLog).catch(e => console.warn('Firestore Log Backup Failed:', e));
  }, [currentUser?.displayName]);

  // Tour State
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setRunTour(true);
      // Wait a bit for components to render, since we need maps & scanners available
      setTimeout(() => setActivePortal('murid'), 500);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = ['finished', 'skipped'];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  const tourSteps: Step[] = [
    {
      target: '#tour-portal-switcher',
      content: 'Gunakan panel ini untuk beralih mode. Aplikasi ini memiliki 4 pintu: Admin, Piket, Guru, dan Siswa.',
      skipBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-maps',
      content: 'Saat absensi via GPS ditekan oleh siswa, sistem Geofence akan mendeteksi apakah lokasi sudah di dalam radius batas sekolah atau memicu Anti-Fake GPS.',
      placement: 'top',
    },
    {
      target: '#tour-scanner',
      content: 'Absensi juga mendukung tap-in cepat dan contactless menggunakan sistem QR Scanner ini untuk antrian yang lebih singkat.',
      placement: 'top',
    }
  ];

  // User Portal Role Management state
  const [adminNav, setAdminNav] = useState<'dashboard' | 'entry' | 'simulator' | 'database'>('dashboard');
  const [activePortal, setActivePortal] = useState<'admin' | 'murid' | 'guru' | 'piket'>('admin');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('12998374'); // Muhammad Fadli
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('19821104'); // Abdul Rahman, M.Kom
  
  // Custom Alert Modal Simulator State (SweetAlert2 Matcher)
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    meta?: React.ReactNode;
  } | null>(null);

  // Gamification, Notification, Settings State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themeMode, setThemeMode] = useState<'light'|'dark'>(() => {
    return (localStorage.getItem('absensi_theme_preference') as 'light' | 'dark') || 'light';
  });

  // Simulated Notifications
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Sistem Pusat', message: 'Sinkronisasi Google Sheets berhasil (1 menit lalu)', read: false },
    { id: 2, title: 'Pesan Guru Piket', message: 'Pintu gerbang utama ditutup pukul 07:05 WIB', read: false },
    { id: 3, title: 'Keamanan GPS', message: 'Sistem deteksi radius anti-fake GPS telah aktif.', read: true }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Sync theme mode to document element and localStorage
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('absensi_theme_preference', themeMode);
  }, [themeMode]);

  // Lock active portal to currentUser.role
  useEffect(() => {
    if (currentUser?.role) {
      setActivePortal(currentUser.role);
    }
  }, [currentUser]);

  // Daily automatic backup to Firestore at 16:00
  useEffect(() => {
    const checkAndBackup = async () => {
      const now = new Date();
      const hh = now.getHours();
      
      if (hh >= 16) {
        const todayStr = now.toDateString();
        const lastBackupDate = localStorage.getItem('absensi_daily_backup_date');
        
        if (lastBackupDate !== todayStr) {
          localStorage.setItem('absensi_daily_backup_date', todayStr);
          try {
            console.log('Menjalankan backup harian otomatis ke Firestore...');
            await backupDailySnapshot(records);
            addLog('Backup Harian', 'Snapshot data absensi harian berhasil dicadangkan ke server (Firestore)');
            setNotifications(prev => [
              {
                id: Date.now(),
                title: 'Backup Harian Sukses',
                message: 'Data absensi hari ini telah dicadangkan secara otomatis ke server.',
                read: false
              },
              ...prev
            ]);
          } catch (err) {
            console.error('Gagal melakukan backup harian:', err);
            // Revert the local storage so it can try again
            localStorage.removeItem('absensi_daily_backup_date');
          }
        }
      }
    };
    
    // Check immediately on mount, and then every 1 minute
    checkAndBackup();
    const backupInterval = setInterval(checkAndBackup, 60000);
    
    return () => clearInterval(backupInterval);
  }, [records]);
  // Synchronized Clock Ticker
  useEffect(() => {
    // Meminta izin notifikasi browser jika belum
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}:${ss}`);

      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      setDateStr(now.toLocaleDateString('id-ID', options));

      // Fitur Notifikasi Browser Pagi Hari (Jam 07:00:00)
      if (hh === '07' && mm === '00' && ss === '00') {
        const todayStr = now.toDateString();
        const lastNotified = localStorage.getItem('absensi_reminder_date');
        
        if (lastNotified !== todayStr) {
          // Trigger Browser Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification("Waktu Absensi!", {
              body: "Jam sekolah telah dimulai (07:00). Segera lakukan absensi kehadiran Anda agar tidak dinyatakan terlambat.",
              icon: "/favicon.ico" 
            });
          }
          
          // Trigger In-App Alerts
          setNotifications(prev => [
            {
              id: Date.now(),
              title: 'Peringatan Absensi',
              message: 'Jam 07:00 WIB. Segera lakukan presensi kehadiran Anda!',
              read: false
            },
            ...prev
          ]);
           
          setAlertConfig({
            show: true,
            type: 'warning',
            title: 'WAKTU ABSENSI!',
            message: 'Jam pelajaran telah dimulai (07:00 WIB). Harap segera mendata kehadiran Anda sekarang juga sebelum gerbang ditutup.',
            meta: (
              <div className="mt-3 text-[11px] font-semibold text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                Peringatan sistem: Data kehadiran akan langsung tercatat sebagai 'Terlambat' setelah lewat jam 07:15.
              </div>
            )
          });

          localStorage.setItem('absensi_reminder_date', todayStr);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load local and Sheets data
  useEffect(() => {
    // Initialize Auth State Listener
    const unsubscribe = initAuth(
      async (user, token) => {
        setCurrentUser(user);
        setGoogleToken(token);
        await handleLoadSheetsData(token);
      },
      () => {
        setCurrentUser(null);
        setGoogleToken(null);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLoadSheetsData = async (token: string) => {
    setIsLoadingSheet(true);
    setErrorMsg(null);
    try {
      const sheetId = await findOrCreateSpreadsheet(token);
      setSpreadsheetId(sheetId);
      const sheetRecords = await loadAllRecordsFromSheet(sheetId, token);
      
      // Load accounts to make sure the sheet is populated
      const sheetAccounts = await loadAccountsFromSheet(sheetId, token);
      if (sheetAccounts.length === 0 || sheetRecords.length === 0) {
        await syncAccountsToSheet(sheetId, token, registeredMembers);
        setAccounts(registeredMembers);
      } else {
        setAccounts(sheetAccounts);
      }
      
      // If the newly created sheet has 0 records, we can populate it with initial mock records
      if (sheetRecords.length === 0) {
        const dummyHistorical = generateMonthlyMockData() as SimulatedRecord[];
        const todayDummy: SimulatedRecord[] = [
          {
            id: 'mock-1',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            type: 'murid',
            data: {
              timestamp: new Date().toISOString(),
              nis: '1092837482',
              nama: 'Ahmad Rafli Hidayat',
              kelas: '10-A',
              status: 'Hadir',
              keterangan: '-',
              latitude: -6.88371,
              longitude: 107.54511,
              jarak: 8,
              isWithinRadius: true
            }
          },
          {
            id: 'mock-2',
            timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
            type: 'murid',
            data: {
              timestamp: new Date().toISOString(),
              nis: '1092837311',
              nama: 'Siti Sarah Fadilah',
              kelas: '12-A',
              status: 'Izin',
              keterangan: 'Menghadiri olimpiade matematika nasional',
              latitude: -6.175392,
              longitude: 106.827153,
              jarak: 1560,
              isWithinRadius: false
            }
          },
          {
            id: 'mock-3',
            timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
            type: 'guru',
            data: {
              timestamp: new Date().toISOString(),
              nip: '29384759',
              nama: 'Budi Santoso, S.Pd',
              jabatan: 'Guru Pemesinan',
              status: 'Hadir',
              keterangan: '-',
              latitude: -6.88375,
              longitude: 107.54512,
              jarak: 12,
              isWithinRadius: true
            }
          },
          {
            id: 'mock-4',
            timestamp: new Date().toISOString(),
            type: 'murid',
            data: {
              timestamp: new Date().toISOString(),
              nis: '1092837423',
              nama: 'Bagus Prakoso',
              kelas: '11-B',
              status: 'Sakit',
              keterangan: 'Demam Berdarah',
              latitude: -6.8837,
              longitude: 107.5451,
              jarak: 50,
              isWithinRadius: true
            }
          }
        ];
        
        // Mengisi baris pertama dengan data dummy historis agar antarmuka tidak kosong
        const combinedInitial = [...todayDummy, ...dummyHistorical];
        
        // Write top rows to sheet so the user starts with real rows
        for (const record of todayDummy) {
          await appendRecordToUrl(sheetId, record, token);
        }
        setRecords(combinedInitial);
        localStorage.setItem('absensi_simulated_records_v2', JSON.stringify(combinedInitial));
      } else {
        setRecords(sheetRecords);
        localStorage.setItem('absensi_simulated_records_v2', JSON.stringify(sheetRecords));
      }
    } catch (err: any) {
      console.error("Gagal meload data spreadsheet harian:", err);
      setErrorMsg(err.message || "Gagal menyambungkan ke Google Sheets");
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Helper for checking routing permissions
  const checkPortalPermission = (targetPortal: 'admin' | 'piket' | 'murid' | 'guru') => {
    const userRole = currentUser?.role || 'admin';
    if (userRole === 'admin') return true;
    if (userRole === 'piket' && targetPortal !== 'admin') return true;
    if (userRole === targetPortal) return true;
    return false;
  };

  const [isSwitchingPortal, setIsSwitchingPortal] = useState(false);

  const handlePortalSwitch = (targetPortal: 'admin' | 'piket' | 'murid' | 'guru') => {
    if (checkPortalPermission(targetPortal)) {
      setIsSwitchingPortal(true);
      setTimeout(() => {
        setActivePortal(targetPortal);
        setIsSwitchingPortal(false);
      }, 600);
    } else {
      setAlertConfig({
        show: true,
        type: 'warning',
        title: 'Akses Portal Ditolak',
        message: `Akun Anda terdaftar sebagai ${
          currentUser?.role === 'guru' ? 'Guru' : 
          currentUser?.role === 'murid' ? 'Siswa' : 'Guru Piket'
        }. Silakan "Keluar" (Logout) terlebih dahulu lalu masuk kembali melalui pintu Portal ${
          targetPortal === 'admin' ? 'Admin' :
          targetPortal === 'piket' ? 'Piket' :
          targetPortal === 'guru' ? 'Guru' : 'Siswa'
        } untuk mengakses fitur ini.`
      });
    }
  };

  const handleCustomLogin = async (usr: string, ps: string, role: 'admin' | 'piket' | 'guru' | 'murid' = 'admin', memberId?: string) => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      let displayName = "Staf SMK Tutwuri Handayani";
      if (role === 'guru' && memberId) {
        const found = registeredMembers.find(m => m.id === memberId);
        if (found) {
          displayName = found.name;
          setSelectedTeacherId(memberId);
        }
      } else if (role === 'murid' && memberId) {
        const found = registeredMembers.find(m => m.id === memberId);
        if (found) {
          displayName = found.name;
          setSelectedStudentId(memberId);
        }
      } else if (role === 'piket') {
        displayName = "Guru Piket Tutwuri";
      } else if (role === 'admin') {
        displayName = "Administrator SIAKAD";
      }

      // Simulate real auth state so the app renders the dashboard with full controls
      setCurrentUser({
        displayName,
        email: usr,
        photoURL: null,
        role: role
      });
      setActivePortal(role); // Set active portal directly based on logged in role!
      setGoogleToken("MOCK_LOCAL_TOKEN");
      setSpreadsheetId("MOCK_LOCAL_SPREADSHEET");
      await handleLoadSheetsData("MOCK_LOCAL_TOKEN");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Kredensial tidak valid");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (username: string, pass: string) => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      // Find account in loaded accounts
      const found = accounts.find(a => 
        (String(a.id).toLowerCase() === username.toLowerCase() || String(a.name).toLowerCase() === username.toLowerCase()) && 
        String(a.password) === pass
      );

      if (found) {
        setCurrentUser({
          id: found.id,
          displayName: found.name,
          email: `${found.id}@sekolah.id`,
          role: found.role,
          detail: found.detail
        });
        
        if (found.role === 'guru') setSelectedTeacherId(found.id);
        if (found.role === 'murid') setSelectedStudentId(found.id);
        
        addLog('Login Berhasil', `User ${found.name} masuk ke portal ${found.role}`, found.name);

        // AUTO-SYNC TRIGGER: If not linked to Google, try to link silently or via popup (if allowed by browser)
        if (!googleToken) {
          try {
            const res = await googleSignIn();
            if (res) {
              setGoogleToken(res.accessToken);
              await handleLoadSheetsData(res.accessToken);
            }
          } catch (e) {
            console.warn("Silent/Auto Google Link deferred. User can still use local mode.", e);
          }
        }
      } else {
        // Fallback to initial seed if accounts list is empty or not yet loaded
        const backupFound = registeredMembers.find(a => 
          (String(a.id).toLowerCase() === username.toLowerCase() || String(a.name).toLowerCase() === username.toLowerCase()) && 
          String(a.password || 'password123') === pass
        );

        if (backupFound) {
          setCurrentUser(backupFound);
          addLog('Login Berhasil', `User ${backupFound.name} masuk (fallback mode)`, backupFound.name);
        } else {
          setErrorMsg("Username atau Kata Sandi salah.");
          addLog('Login Gagal', `Percobaan masuk gagal untuk user: ${username}`, 'Tamu');
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMsg("Terjadi kesalahan sistem saat verifikasi.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLinkGoogle = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleToken(res.accessToken);
        await handleLoadSheetsData(res.accessToken);
        addLog('Sinkronisasi Google', 'Database Google Sheets berhasil dihubungkan');
      }
    } catch (err: any) {
      console.error("Gagal masuk dengan Google:", err);
      let friendlyMessage = err.message || "Gagal masuk dengan Google";
      const errStr = String(err);
      
      if (err.code === 'auth/popup-closed-by-user' || errStr.includes('popup-closed-by-user')) {
        friendlyMessage = "Google Sign-in ditutup sebelum selesai. Tips: Klik 'Buka di Tab Baru' di pojok kanan atas agar otentikasi sukses.";
      }
      setErrorMsg(friendlyMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setGoogleToken(null);
    setSpreadsheetId(null);
    setRecords([]);
  };

  // Memoized saveRecords to prevent unnecessary re-creations and fix stale closure
  const saveRecords = useCallback((newRecords: SimulatedRecord[]) => {
    setRecords(newRecords);
    try {
      localStorage.setItem('absensi_simulated_records_v2', JSON.stringify(newRecords));
      
      // Auto-backup to Firestore (redundancy)
      // For performance, we only backup the latest record if it's a new addition
      if (newRecords.length > records.length) {
        backupRecordToFirestore(newRecords[0]).catch(e => console.warn('Firestore Record Backup Failed:', e));
      }
    } catch (e) {
      console.error(e);
    }
  }, [records.length]);

  const handleSeedHistorical = () => {
    const historical = generateMonthlyMockData() as SimulatedRecord[];
    // Merge historical records with existing records (avoiding duplicates if already loaded)
    const filteredExists = records.filter(r => !r.id.startsWith('hist-'));
    saveRecords([...filteredExists, ...historical]);
  };

  const handleAddRecord = async (type: 'murid' | 'guru', data: any) => {
    const isWithin = data.isWithinRadius;
    const distanceMeter = data.jarak;
    
    const newRecord: SimulatedRecord = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: data.timestamp,
      type,
      data: {
        ...data,
      }
    };

    // Normal Online flow
    const updated = [newRecord, ...records];
    saveRecords(updated);
    addLog('Absensi Baru', `Presensi manual dicatat untuk ${newRecord.data.nama} (${newRecord.data.status})`);

    // Write to Google Sheet if we have a real session active
    if (googleToken && spreadsheetId) {
      try {
        await appendRecordToUrl(spreadsheetId, newRecord, googleToken);
      } catch (e) {
        console.error("Gagal menambahkan baris baru ke Google Sheet:", e);
      }
    }

    // Trigger sweet success popup simulator
    let locationFeedback = '';
    if (data.latitude) {
      locationFeedback = isWithin
        ? `✔ LOKASI VALID: Posisi Anda berada di area sekolah (Jarak: ${distanceMeter} meter dari SMK Tutwuri Handayani, Cimahi - Di dalam batas aman radius 100 meter).`
        : `⚠ LOKASI DILUAR GEOLIMIT: Anda terdeteksi berada di luar area sekolah (Jarak: ${(distanceMeter / 1000).toFixed(2)} km dari SMK Tutwuri Handayani, Cimahi). Namun absensi tetap masuk ke Google Sheets dengan tanda "DI LUAR AREA" untuk verifikasi guru piket.`;
    } else {
      locationFeedback = ' tanpa catatan lokasi GPS.';
    }

    setAlertConfig({
      show: true,
      type: isWithin ? 'success' : 'warning',
      title: 'Absensi Berhasil Terkirim!',
      message: type === 'murid' 
        ? `Terima kasih ${data.nama} (NIS: ${data.nis}). Kehadiran Anda hari ini berstatus "${data.status}" telah berhasil dikirim ke database Google Sheets.`
        : `Selamat bertugas Bapak/Ibu ${data.nama}. Presensi kehadiran Anda hari ini berstatus "${data.status}" telah berhasil dikirim ke database Google Sheets Guru.`,
      meta: (
        <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-2xl leading-normal font-medium flex items-start gap-2 text-left font-sans">
          <Compass size={18} className={isWithin ? 'text-emerald-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
          <div>
            <strong className={isWithin ? 'text-emerald-950 font-bold' : 'text-amber-900 font-bold'}>
              {isWithin ? 'Status GPS: Terverifikasi di Sekolah' : 'Status GPS: Di Luar Batasan Area'}
            </strong>
            <p className="mt-0.5">{locationFeedback}</p>
          </div>
        </div>
      )
    });
  };

  const handleDeleteRecord = (id: string) => {
    const filtered = records.filter(r => r.id !== id);
    saveRecords(filtered);
  };

  const handleToggleOverride = (id: string, newStatus?: AttendanceStatus, newCatatan?: string) => {
    const updated = records.map(r => {
      if (r.id === id) {
        const nextStatus = newStatus || ((r.data.status === 'Hadir' ? 'Alpa' : 'Hadir') as AttendanceStatus);
        const updatedData = {
          ...r.data,
          status: nextStatus,
          isManualOverride: true,
          catatan: newCatatan || r.data.catatan
        };
        addLog('Perubahan Status', `Status ${r.data.nama} diubah menjadi ${nextStatus}${newCatatan ? ' dengan catatan: ' + newCatatan : ''}`);
        return {
          ...r,
          data: updatedData
        } as SimulatedRecord;
      }
      return r;
    });
    saveRecords(updated);
  };

  const handleResetDailyHadir = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus/mereset seluruh data absensi berstatus 'Hadir' untuk HARI INI? Data riwayat tanggal lain dan izin/sakit hari ini tidak akan terhapus.")) {
      const todayStr = new Date().toDateString();
      const filtered = records.filter(r => {
        const isToday = new Date(r.timestamp).toDateString() === todayStr;
        const isHadir = r.data.status === 'Hadir';
        if (isToday && isHadir) return false;
        return true;
      });
      saveRecords(filtered);
      addLog('Reset Absensi', 'Seluruh data absensi harian berstatus Hadir telah direset');

      if (googleToken && spreadsheetId) {
        setIsLoadingSheet(true);
        try {
          await clearSpreadsheetRows(spreadsheetId, googleToken);
          for (const item of filtered) {
            await appendRecordToUrl(spreadsheetId, item, googleToken);
          }
        } catch (e) {
          console.error("Gagal sinkron reset ke Sheets:", e);
        } finally {
          setIsLoadingSheet(false);
        }
      }
    }
  };

  const handleClearRecords = async () => {
    if (window.confirm("Apakah Anda yakin ingin mengosongkan seluruh riwayat database Google Sheets Anda? Tindakan ini akan mengosongkan kedua tab.")) {
      saveRecords([]);
      addLog('Database Dibersihkan', 'Seluruh riwayat absensi di database telah dihapus');
      if (googleToken && spreadsheetId) {
        setIsLoadingSheet(true);
        try {
          await clearSpreadsheetRows(spreadsheetId, googleToken);
        } catch (e) {
          console.error("Gagal membersihkan database Sheets:", e);
        } finally {
          setIsLoadingSheet(false);
        }
      }
    }
  };

  // Calculate stats live for the left panel widgets to match visual placeholders
  const activeStudentCount = records.filter(r => r.type === 'murid' && r.data.status === 'Hadir').length;
  const activeTeacherCount = records.filter(r => r.type === 'guru' && r.data.status === 'Hadir').length;

  if (!currentUser) {
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        onLinkSheet={handleLinkGoogle}
        isLoggingIn={isLoggingIn} 
        errorMsg={errorMsg}
        isSheetLinked={!!googleToken}
      />
    );
  }

  if (isLoadingSheet) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 text-center max-w-sm">
          <div className="relative inline-flex items-center justify-center p-3.5 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl mb-6 shadow-xl">
            <RefreshCw size={42} className="text-indigo-400 animate-spin" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-2">
            Sinkronisasi Database Aktif
          </h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed font-mono tracking-wider uppercase mb-5">
            Menghubungkan ke Google Sheets API...
          </p>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-300 font-semibold flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ID Sheet: {spreadsheetId ? `${spreadsheetId.slice(0, 12)}...` : 'Membuat file spreadsheet baru...'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-slate-50 dark:bg-slate-950 font-['Inter',sans-serif] overflow-hidden text-slate-800 dark:text-slate-200 antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        onEvent={handleJoyrideCallback}
        styles={{
          buttonPrimary: {
            fontSize: '12px',
            fontWeight: 'bold',
            padding: '8px 16px',
            borderRadius: '8px',
          },
          buttonBack: {
            fontSize: '12px',
            color: '#64748b',
          },
          buttonSkip: {
            fontSize: '12px',
            color: '#e2e8f0',
          },
          tooltip: {
            fontFamily: 'Inter, sans-serif',
            borderRadius: '12px',
          },
          tooltipContent: {
            fontSize: '13px',
            lineHeight: '1.5',
            padding: '20px 10px',
          }
        }}
        options={{
          primaryColor: '#4f46e5', // indigo-600
          zIndex: 1000,
          showProgress: true,
          buttons: ['back', 'skip', 'primary', 'close'] as any
        }}
        locale={{
          back: 'Kembali',
          close: 'Tutup',
          last: 'Selesai',
          next: 'Lanjut',
          skip: 'Lewati Tour',
        }}
      />
      
      {/* Left Panel: Info & Stats */}
      <div className="lg:w-80 w-full bg-indigo-900 flex flex-col p-6 lg:p-8 text-white shrink-0 scrollbar-none lg:overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/10 overflow-hidden shrink-0 p-1">
              <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tight uppercase">SIAKAD PRO</h1>
          </div>
          <p className="text-indigo-200 text-xs font-semibold opacity-80 uppercase tracking-widest leading-none">Sistem Absensi Real-time</p>
        </div>

        {/* Profile Card */}
        {currentUser && (
          <div className="mb-6 bg-indigo-950/40 border border-indigo-700/20 p-3 rounded-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-8 h-8 rounded-full border border-indigo-400 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 select-none">
                    {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                  </div>
                )}
                <div className="overflow-hidden text-left">
                  <div className="text-xs font-bold text-slate-100 truncate">{currentUser.displayName || 'Pengguna'}</div>
                  <div className="text-[9px] text-indigo-300 truncate font-medium uppercase font-mono tracking-wider">{currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'piket' ? 'Staf Piket' : currentUser.role === 'guru' ? 'Guru' : 'Siswa'}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 shrink-0 hover:bg-rose-500/20 text-rose-300 hover:text-white rounded-xl border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                title="Keluar / Logout"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center gap-6 lg:gap-10 my-4 lg:my-0">
          <div>
            <p className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest mb-1.5 font-mono">Waktu Server (WIB)</p>
            <div className="text-4xl font-light mb-1 font-mono tracking-wider">{timeStr || '07:42:15'}</div>
            <div className="text-indigo-300 text-xs font-medium">{dateStr || 'Senin, 24 Mei 2024'}</div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-indigo-800/50 p-4 rounded-xl border border-indigo-700/50 shadow-inner transition-all duration-300 hover:scale-105 hover:bg-indigo-700/60 hover:shadow-lg cursor-pointer">
              <div className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest mb-1.5 font-mono">Kehadiran Murid</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold font-mono">{842 + activeStudentCount}</span>
                <span className="text-indigo-400 text-xs mb-1">/ 950 Siswa</span>
              </div>
            </div>
            <div className="bg-indigo-800/50 p-4 rounded-xl border border-indigo-700/50 shadow-inner transition-all duration-300 hover:scale-105 hover:bg-indigo-700/60 hover:shadow-lg cursor-pointer">
              <div className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest mb-1.5 font-mono">Kehadiran Guru</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold font-mono">{48 + activeTeacherCount}</span>
                <span className="text-indigo-400 text-xs mb-1">/ 52 Tendik</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 lg:mt-auto pt-6 border-t border-indigo-800 space-y-4">
        </div>
      </div>

      {/* Right Panel: Form Section & Database */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 relative overflow-y-auto w-full lg:max-h-screen">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
          
          {/* SECURE ROLE-BASED HEADER BANNER */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#94a3b8] uppercase block">
                  SMK TUTWURI HANDAYANI, CIMAHI - PRESENSI PRESISI
                </span>
                <span className="text-xs font-bold text-white leading-none">
                  {activePortal === 'admin' && "Portal Utama Administrator (Monitoring & Pengaturan)"}
                  {activePortal === 'piket' && "Portal Staff / Guru Piket (Presensi Manual & Rekapitulasi)"}
                  {activePortal === 'guru' && "Portal Guru Mandiri (Geofence & Validasi ID Siswa)"}
                  {activePortal === 'murid' && "Portal Siswa Mandiri (Kehadiran & ID Digital)"}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* User Avatar Preview */}
              <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-xs shadow-inner overflow-hidden">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-100 leading-none truncate max-w-[80px]">
                    {currentUser?.displayName || (activePortal === 'admin' ? 'Admin' : activePortal === 'guru' ? 'Guru' : activePortal === 'piket' ? 'Piket' : 'Siswa')}
                  </p>
                  <p className="text-[8px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter">SIAKAD v2.0</p>
                </div>
              </div>

              {/* Active Role Badge Indicator */}
              <div className="text-[10px] bg-slate-800 border border-slate-700/60 text-slate-100 font-bold font-mono uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activePortal === 'admin' ? 'bg-indigo-400' :
                  activePortal === 'piket' ? 'bg-amber-400' :
                  activePortal === 'guru' ? 'bg-violet-400' : 'bg-emerald-400'
                }`} />
                <span>
                  Sesi: {
                    activePortal === 'admin' ? 'Administrator' :
                    activePortal === 'piket' ? 'Staf Piket' :
                    activePortal === 'guru' ? 'Guru' : 'Siswa'
                  }
                </span>
              </div>

              <div className="flex items-center gap-2 relative z-50">
                <button
                  type="button"
                  onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center relative transition-all"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-slate-800"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* NOTIFICATIONS POPOVER */}
          {showNotifications && (
            <div className="absolute right-6 top-28 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 overflow-hidden animate-fadeIn">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800">Notifikasi Sistem</h3>
                <button onClick={handleMarkAllRead} className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer">Tandai Dibaca</button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">Belum ada notifikasi.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors ${n.read ? 'opacity-60' : 'bg-indigo-50/20'}`}>
                      <div className="flex gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-300' : 'bg-indigo-500'}`}></div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 mb-0.5">{n.title}</p>
                          <p className="text-[11px] text-slate-500 leading-snug">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SETTINGS POPOVER */}
          {showSettings && (
            <div className="absolute right-6 top-28 w-72 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 overflow-hidden animate-fadeIn">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Pengaturan Profil</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Tema Aplikasi</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setThemeMode('light')} className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all cursor-pointer ${themeMode === 'light' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Terang</button>
                    <button onClick={() => setThemeMode('dark')} className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all cursor-pointer ${themeMode === 'dark' ? 'bg-slate-800 shadow text-slate-200' : 'text-slate-500'}`}>Gelap</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Ganti Portal Layanan</label>
                  <select 
                    value={activePortal}
                    onChange={(e) => {
                      setActivePortal(e.target.value as any);
                      setShowSettings(false);
                    }}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="admin">Administrator</option>
                    <option value="guru">Guru Mandiri</option>
                    <option value="murid">Siswa Mandiri</option>
                    <option value="piket">Staff Piket</option>
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1 italic">Fitur navigasi portal khusus untuk pengujian.</p>
                </div>
                <div className="pt-2">
                  <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer">Tutup Pengaturan</button>
                </div>
              </div>
            </div>
          )}

          {/* PORTAL CONTENT CONTROLLER */}
          <AnimatePresence mode="wait" initial={false}>
            {activePortal === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-8"
              >
                <header className="text-center lg:text-left mb-2 max-w-3xl">
                <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-800 mb-1.5 tracking-tight">Presensi Harian SMK Tutwuri Handayani, Cimahi - Kantor Admin</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Selamat datang di portal administrasi utama SMK Tutwuri Handayani, Cimahi. Anda dapat memantau status persebaran, melakukan rekapitulasi absensi, dan mengekspor laporan bulanan.
                </p>
              </header>

              {/* APP FEATURES INDICATOR */}
              <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-xs text-slate-600 font-semibold font-sans">
                  <Sparkles size={16} className="text-indigo-600 shrink-0" />
                  <span>Sistem absensi EdTech terintegrasi Google Sheets Real-time</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold font-mono text-slate-500">
                  <span className="bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">✔ G-Fence Tracker</span>
                  <span className="bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">✔ Anti-Spam Locker</span>
                  <span className="bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">✔ Cloud Ready</span>
                </div>
              </div>

              {/* SUMMARY DASHBOARD SECTION WITH PIE CHART */}
              <SummaryDashboard records={records} onSeedHistorical={handleSeedHistorical} />
              
              {/* Admin Navigation Menu */}
              <div className="grid grid-cols-2 md:flex bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm gap-1.5">
                <button
                  onClick={() => setAdminNav('dashboard')}
                  className={`flex-1 md:flex-none px-6 h-12 md:h-11 flex items-center justify-center gap-2.5 rounded-xl text-xs font-black transition-all ${adminNav === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-500' : 'text-slate-500 hover:text-slate-800 cursor-pointer hover:bg-slate-100'}`}
                >
                  <BarChart3 size={18} />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setAdminNav('entry')}
                  className={`flex-1 md:flex-none px-6 h-12 md:h-11 flex items-center justify-center gap-2.5 rounded-xl text-xs font-black transition-all ${adminNav === 'entry' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-500' : 'text-slate-500 hover:text-slate-800 cursor-pointer hover:bg-slate-100'}`}
                >
                  <Users size={18} />
                  <span>Manajemen Akun</span>
                </button>
                <button
                  onClick={() => setAdminNav('simulator')}
                  className={`flex-1 md:flex-none px-6 h-12 md:h-11 flex items-center justify-center gap-2.5 rounded-xl text-xs font-black transition-all ${adminNav === 'simulator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-500' : 'text-slate-500 hover:text-slate-800 cursor-pointer hover:bg-slate-100'}`}
                >
                  <Smartphone size={18} />
                  <span>Entri Manual</span>
                </button>
                <button
                  onClick={() => setAdminNav('database')}
                  className={`flex-1 md:flex-none px-6 h-12 md:h-11 flex items-center justify-center gap-2.5 rounded-xl text-xs font-black transition-all ${adminNav === 'database' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-500' : 'text-slate-500 hover:text-slate-800 cursor-pointer hover:bg-slate-100'}`}
                >
                  <Database size={18} />
                  <span>Database Logs</span>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {adminNav === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                  >
                    <LiveSheetsDashboard spreadsheetId={spreadsheetId} googleToken={googleToken} />
                    <MapDistribution records={records} />
                    
                    {/* Daily Stats Widget */}
                    {(() => {
                      const startOfToday = new Date();
                      startOfToday.setHours(0, 0, 0, 0);
                      const endOfToday = new Date();
                      endOfToday.setHours(23, 59, 59, 999);
                      
                      const todaysRecords = records.filter(r => {
                        if (!r.timestamp) return false;
                        const d = new Date(r.timestamp);
                        return d >= startOfToday && d <= endOfToday;
                      });
                      
                      const totalToday = todaysRecords.length;
                      const hadirToday = todaysRecords.filter(r => r.data.status === 'Hadir').length;
                      const terlambatToday = todaysRecords.filter(r => r.data.status === 'Terlambat').length;
                      const persentase = totalToday > 0 ? Math.round((hadirToday / totalToday) * 100) : 0;

                      return (
                        <div className="bg-white rounded-3xl border border-slate-200 p-7 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:shadow-md border-b-4 border-b-indigo-500/20">
                          <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
                              <BarChart3 size={32} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-800">Ringkasan Kehadiran Hari Ini</h3>
                              <p className="text-sm text-slate-500 font-medium">Monitoring performa kehadiran civitas secara real-time</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-10">
                            <div className="text-center">
                              <p className="text-4xl font-black text-emerald-600">{hadirToday}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 font-mono">Hadir Tepat</p>
                            </div>
                            <div className="text-center">
                              <p className="text-4xl font-black text-amber-500">{terlambatToday}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 font-mono">Terlambat</p>
                            </div>
                            <div className="text-center bg-indigo-50 px-6 py-4 rounded-3xl border border-indigo-100/50 shadow-inner">
                              <p className="text-4xl font-black text-indigo-600">{persentase}%</p>
                              <p className="text-[10px] font-bold text-indigo-500/70 uppercase tracking-widest mt-1 font-mono">Efficiency</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {adminNav === 'entry' && (
                  <motion.div
                    key="entry"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* ADMIN ACCOUNT MANAGEMENT SECTION */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
                        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-5">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
                            <UserPlus size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800">Registrasi Akun Baru</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Daftarkan NISN Siswa atau NIP Pendidik ke sistem</p>
                          </div>
                        </div>

                        <form 
                          onSubmit={(e: any) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const newAcc = {
                              id: formData.get('id'),
                              name: formData.get('name'),
                              role: formData.get('role'),
                              detail: formData.get('detail'),
                              password: 'password123'
                            };
                            setMembers([...members, newAcc]);
                            e.target.reset();
                            setAlertConfig({
                              show: true,
                              type: 'success',
                              title: 'Berhasil!',
                              message: `Akun ${newAcc.name} berhasil ditambahkan.`
                            });
                          }}
                          className="space-y-5"
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">ID (NISN/NIP)</label>
                              <input name="id" required className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" placeholder="12345678" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">Nama Lengkap</label>
                              <input name="name" required className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" placeholder="Ahmad ..." />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">Peran / Role</label>
                              <select name="role" required className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none">
                                <option value="murid">Siswa (Murid)</option>
                                <option value="guru">Guru (GTK)</option>
                                <option value="piket">Staf Piket</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">Detail (Kelas/Jabatan)</label>
                              <input name="detail" required className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" placeholder="12-A / Guru Kimia" />
                            </div>
                          </div>
                          <button type="submit" className="w-full h-13 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-2">
                            <UserPlus size={18} />
                            <span>Konfirmasi & Simpan Akun</span>
                          </button>
                        </form>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-sm">
                              <Shield size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-800">Preview Database Akun</h3>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">Daftar pengguna yang memiliki akses portal</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">{members.length} Users</span>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-3 custom-scrollbar">
                          {members.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110 ${m.role === 'admin' ? 'bg-indigo-500' : m.role === 'guru' ? 'bg-violet-500' : m.role === 'piket' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                  {m.role === 'guru' ? <GraduationCap size={20} /> : m.role === 'murid' ? <User size={20} /> : <Shield size={20} />}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-800">{m.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold font-mono tracking-wider">{m.id} • {m.role.toUpperCase()}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">{m.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {adminNav === 'simulator' && (
                  <motion.div
                    key="simulator"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm">
                          <Smartphone size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-800">Simulator Entri Data Manual</h3>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">Gunakan form ini untuk simulasi penginputan data tanpa scanner fisik</p>
                        </div>
                      </div>
                      <FormSimulator onSuccessSubmit={handleAddRecord} />
                    </div>
                  </motion.div>
                )}

                {adminNav === 'database' && (
                  <motion.div
                    key="database"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between gap-4 px-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                          <Database size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-mono">Log Database Cloud</h3>
                          <p className="text-[10px] text-slate-400 font-bold">Sinkronisasi data real-time dengan Google Sheets</p>
                        </div>
                      </div>
                      {spreadsheetId && (
                        <a 
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-2 h-10 px-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          <FileSpreadsheet size={14} />
                          BUKA GOOGLE SHEETS &rarr;
                        </a>
                      )}
                    </div>
                    <LocalDatabase 
                      records={records} 
                      onClearRecords={handleClearRecords} 
                      onResetDailyHadir={handleResetDailyHadir}
                      onDeleteRecord={handleDeleteRecord} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

            {activePortal === 'piket' && (
              <motion.div
                key="piket"
                initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <PiketPortal 
                  records={records} 
                  onAddRecord={handleAddRecord}
                  onToggleOverride={handleToggleOverride} 
                  onAddLog={addLog} 
                />
              </motion.div>
            )}

            {activePortal === 'murid' && (
              <motion.div
                key="murid"
                initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6"
              >
                <header className="text-center lg:text-left mb-2 max-w-3xl">
                <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-800 mb-1.5 tracking-tight">Presensi Harian SMK Tutwuri Handayani, Cimahi - Portal Siswa</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Lakukan absensi mandiri, periksa kartu pelajar QR digital Anda, dan tinjau riwayat kehadiran Anda sendiri demi keamanan data.
                </p>
              </header>

              <StudentPortal 
                records={records}
                onAddRecord={handleAddRecord}
                selectedStudentId={selectedStudentId}
                onStudentIdChange={setSelectedStudentId}
              />
              </motion.div>
            )}

            {activePortal === 'guru' && (
              <motion.div
                key="guru"
                initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6"
              >
                <header className="text-center lg:text-left mb-2 max-w-3xl">
                <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-800 mb-1.5 tracking-tight">Presensi Harian SMK Tutwuri Handayani, Cimahi - Portal Guru & Staff</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Ajukan absensi guru mandiri, lihat rekap kehadiran dinas Anda, serta gunakan instrumen Scanner ID Siswa untuk memproses absensi langsung di kelas.
                </p>
              </header>

              <TeacherPortal 
                records={records}
                onAddRecord={handleAddRecord}
                selectedTeacherId={selectedTeacherId}
                onTeacherIdChange={setSelectedTeacherId}
              />
              </motion.div>
            )}
          </AnimatePresence>

          {/* GLOBAL FOOTER */}
          <footer className="mt-8 pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-400 text-[11px] font-semibold text-center sm:text-left">
            <div className="flex items-center gap-2 uppercase tracking-wider font-mono">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>Geolocation: Aktif (6.1686° S, 106.8331° E)</span>
            </div>
            <p>© {new Date().getFullYear()} SMA Negeri Unggulan • Jurusan IT & Sistem Informasi Absensi</p>
          </footer>

        </div>
      </div>

      {/* PORTAL SWITCHING OVERLAY */}
      <AnimatePresence>
        {isSwitchingPortal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <div className="relative">
                <RefreshCw size={32} className="text-indigo-600 animate-spin" />
                <div className="absolute inset-0 bg-indigo-600/10 rounded-full blur-xl animate-pulse"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-slate-800 tracking-tight">Menyiapkan Portal...</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Otentikasi Peran Aktif</p>
              </div>
              <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIGH-FIDELITY ALERT MODAL / SWEETALERT2 SIMULATOR */}
      {alertConfig && alertConfig.show && (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn transition-colors duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-md w-full p-6 text-slate-800 dark:text-slate-200 shadow-2xl relative overflow-hidden transition-colors duration-200">
            {/* Visual Icon Badge decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-800/50 rounded-full translate-x-12 -translate-y-12 z-0 transition-colors duration-200"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={`p-3 rounded-full mb-4 ring-8 ${alertConfig.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/20 ring-emerald-50/50 dark:ring-emerald-500/10' : alertConfig.type === 'error' ? 'bg-rose-50 dark:bg-rose-500/20 ring-rose-50/50 dark:ring-rose-500/10' : 'bg-amber-50 dark:bg-amber-500/20 ring-amber-50/50 dark:ring-amber-500/10'}`}>
                {alertConfig.type === 'success' && <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />}
                {alertConfig.type === 'error' && <AlertCircle size={36} className="text-rose-600 dark:text-rose-400" />}
                {alertConfig.type === 'warning' && <AlertCircle size={36} className="text-amber-600 dark:text-amber-400" />}
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none mb-2">{alertConfig.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold max-w-sm mb-4">{alertConfig.message}</p>
              
              {alertConfig.meta}

              <button
                type="button"
                onClick={() => setAlertConfig(null)}
                className="w-full mt-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-bold text-xs tracking-wider uppercase rounded-2xl shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Tutup Peringatan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
