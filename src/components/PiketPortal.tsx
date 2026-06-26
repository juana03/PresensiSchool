import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardList,
  BookOpen,
  DoorOpen,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Info,
  User,
  RefreshCw,
  MapPin,
  X,
  Send,
  ShieldAlert,
  HardDrive,
  Filter,
  Download,
  Cloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  SimulatedRecord,
  StudentAttendance,
  TeacherAttendance,
  AttendanceStatus,
} from "../types";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const customMarkerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface PiketPortalProps {
  records: SimulatedRecord[];
  onAddRecord: (type: "murid" | "guru", data: any) => void;
  onToggleOverride?: (
    id: string,
    newStatus?: AttendanceStatus,
    newCatatan?: string,
  ) => void;
  onAddLog?: (action: string, detail: string) => void;
}

export default function PiketPortal({
  records,
  onAddRecord,
  onToggleOverride,
  onAddLog,
}: PiketPortalProps) {
  const [activeTab, setActiveTab] = useState<
    "rekap" | "buku" | "izin" | "audit"
  >("rekap");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // Manual Form State
  const [manualType, setManualType] = useState<"murid" | "guru">("murid");
  const [manualId, setManualId] = useState("");
  const [manualNama, setManualNama] = useState("");
  const [manualDetail, setManualDetail] = useState("");
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>("Hadir");
  const [manualCatatan, setManualCatatan] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [notifiedStudents, setNotifiedStudents] = useState<Set<string>>(
    new Set(),
  );
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(),
  );
  const [filterKelas, setFilterKelas] = useState<string>("Semua");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  const [playedAlerts, setPlayedAlerts] = useState<Set<string>>(() => {
    // Collect all initial radius, terlambat, and time anomaly records so they don't play sound on reload
    const outOfRadiusInitial = records
      .filter((r) => r.data.isWithinRadius === false)
      .map((r) => r.id);
    const terlambatInitial = records
      .filter((r) => r.data.status === "Terlambat" && r.type === "murid")
      .map((r) => r.id);
    const timeAnomalyInitial = records
      .filter((r) => r.timestamp && (new Date(r.timestamp).getHours() < 6 || new Date(r.timestamp).getHours() >= 18))
      .map((r) => r.id);
    return new Set([...outOfRadiusInitial, ...terlambatInitial, ...timeAnomalyInitial]);
  });

  const outOfRadiusRecords = records.filter(
    (r) => r.data.isWithinRadius === false,
  );
  const terlambatRecords = records.filter(
    (r) => r.data.status === "Terlambat" && r.type === "murid",
  );
  const timeAnomalyRecords = records.filter((r) => {
    if (!r.timestamp) return false;
    const hrs = new Date(r.timestamp).getHours();
    return hrs < 6 || hrs >= 18;
  });

  const playAudioAlert = (type: "radius" | "terlambat") => {
    if (isMuted) return;
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === "radius") {
        // Double warning sound for geofence violation
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5 (Alert pitch)
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.3);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sawtooth";
          osc2.frequency.setValueAtTime(880, ctx.currentTime);
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 180);
      } else {
        // Moderate alert tone for late arrivals
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(554.37, ctx.currentTime); // C#5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      }
    } catch (e) {
      console.warn("Audio Context could not play audio alert:", e);
    }
  };

  const allAlerts = [
    ...outOfRadiusRecords.map((r) => ({ ...r, alertType: "RADIUS" as const })),
    ...terlambatRecords.map((r) => ({ ...r, alertType: "TERLAMBAT" as const })),
    ...timeAnomalyRecords.map((r) => ({ ...r, alertType: "TIME_ANOMALY" as const })),
  ];

  // Sort alerts by timestamp descending
  allAlerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const activeAlerts = allAlerts.filter((r) => !dismissedAlerts.has(r.id));

  // Trigger sound alerts whenever new radius, terlambat, or time anomaly records arrive
  useEffect(() => {
    const unplayed = activeAlerts.find((a) => !playedAlerts.has(a.id));
    if (unplayed) {
      const typeOfAlert =
        unplayed.alertType === "RADIUS" ? "radius" : "terlambat";
      playAudioAlert(typeOfAlert);

      // Update played alerts so they don't replay
      setPlayedAlerts((prev) => {
        const next = new Set(prev);
        allAlerts.forEach((a) => next.add(a.id));
        return next;
      });
    }
  }, [records, allAlerts, playedAlerts, isMuted]);

  const handleNotifyAction = (studentId: string, nama: string) => {
    alert(
      `Pengiriman otomatis WhatsApp/SMS Surat Peringatan (SP) Absensi ke orang tua murid: ${nama}`,
    );
    setNotifiedStudents((prev) => new Set(prev).add(studentId));
  };

  // Local state for Buku Piket
  const [bukuPiket, setBukuPiket] = useState<
    {
      id: number;
      time: string;
      event: string;
      type: "info" | "warning" | "violation";
    }[]
  >([
    {
      id: 1,
      time: "06:45",
      event: "Gerbang utama dibuka, kondisi aman.",
      type: "info",
    },
    {
      id: 2,
      time: "07:15",
      event: "Siswa atas nama Budi (10-A) terlambat 15 menit.",
      type: "warning",
    },
  ]);
  const [newEvent, setNewEvent] = useState("");
  const [newEventType, setNewEventType] = useState<
    "info" | "warning" | "violation"
  >("info");

  // Local state for Perizinan
  const [izinList, setIzinList] = useState<
    {
      id: number;
      name: string;
      class: string;
      reason: string;
      timeOut: string;
      timeIn: string | null;
      status: "keluar" | "kembali";
    }[]
  >([
    {
      id: 1,
      name: "Siti Sarah",
      class: "12-A",
      reason: "Sakit, dijemput orang tua",
      timeOut: "09:30",
      timeIn: null,
      status: "keluar",
    },
  ]);
  const [izinName, setIzinName] = useState("");
  const [izinClass, setIzinClass] = useState("");
  const [izinReason, setIzinReason] = useState("");

  const handleAddBukuPiket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent) return;
    const now = new Date();
    const timeToSave = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setBukuPiket([
      { id: Date.now(), time: timeToSave, event: newEvent, type: newEventType },
      ...bukuPiket,
    ]);
    setNewEvent("");
  };

  const handleCreateIzin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!izinName || !izinClass || !izinReason) return;
    const now = new Date();
    const timeToSave = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setIzinList([
      {
        id: Date.now(),
        name: izinName,
        class: izinClass,
        reason: izinReason,
        timeOut: timeToSave,
        timeIn: null,
        status: "keluar",
      },
      ...izinList,
    ]);
    setIzinName("");
    setIzinClass("");
    setIzinReason("");
  };

  const handleSetKembali = (id: number) => {
    const now = new Date();
    const timeToSave = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setIzinList(
      izinList.map((item) =>
        item.id === id
          ? { ...item, status: "kembali", timeIn: timeToSave }
          : item,
      ),
    );
  };

  const todayStudentRecords = records.filter((r) => r.type === "murid");
  const todayTeacherRecords = records.filter((r) => r.type === "guru");

  const analyzeSentimentAndUrgency = (keterangan: string, status: string) => {
    if (!keterangan || keterangan.trim() === "-" || keterangan.trim() === "")
      return null;
    const lowerKet = keterangan.toLowerCase();

    if (
      lowerKet.includes("sakit") ||
      lowerKet.includes("pusing") ||
      lowerKet.includes("demam") ||
      lowerKet.includes("rumah sakit")
    ) {
      return {
        emotion: "Empati",
        urgency: "Sedang",
        color: "bg-blue-100 border-blue-200 text-blue-700",
      };
    } else if (
      lowerKet.includes("kecelakaan") ||
      lowerKet.includes("darurat") ||
      lowerKet.includes("meninggal") ||
      lowerKet.includes("operasi")
    ) {
      return {
        emotion: "Waspada",
        urgency: "Tinggi",
        color: "bg-rose-100 border-rose-200 text-rose-700",
      };
    } else if (
      lowerKet.includes("macet") ||
      lowerKet.includes("bocor") ||
      lowerKet.includes("kesiangan")
    ) {
      return {
        emotion: "Kecewa / Klise",
        urgency: "Rendah",
        color: "bg-amber-100 border-amber-200 text-amber-700",
      };
    } else if (
      status === "Izin" ||
      status === "Sakit" ||
      status === "Terlambat"
    ) {
      return {
        emotion: "Netral",
        urgency: "Sedang",
        color: "bg-indigo-100 border-indigo-200 text-indigo-700",
      };
    }
    return {
      emotion: "Netral",
      urgency: "Rendah",
      color: "bg-slate-100 border-slate-200 text-slate-700",
    };
  };

  const filteredStudentRecords = todayStudentRecords.filter((r) => {
    const data = r.data as StudentAttendance;
    if (isFocusMode && data.status !== "Terlambat" && data.status !== "Alpa")
      return false;
    if (filterKelas !== "Semua" && data.kelas !== filterKelas) return false;
    if (filterStatus !== "Semua" && data.status !== filterStatus) return false;
    return true;
  });

  const studentHadirCount = todayStudentRecords.filter(
    (r) => (r.data as StudentAttendance).status === "Hadir",
  ).length;
  const studentAbsenCount = todayStudentRecords.filter(
    (r) => (r.data as StudentAttendance).status !== "Hadir",
  ).length;
  const studentKeluarCount = izinList.filter(
    (item) => item.status === "keluar",
  ).length;

  const handleManualSync = () => {
    setIsDriveSyncing(true);
    setTimeout(() => {
      setIsDriveSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID") + " WIB");
    }, 2500);
  };

  // Get unique classes for filter dropdown
  const uniqueClasses = Array.from(
    new Set(
      todayStudentRecords.map((r) => (r.data as StudentAttendance).kelas),
    ),
  ).sort();

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId || !manualNama || !manualDetail) {
      Swal.fire("Error", "Mohon isi semua data wajib!", "error");
      return;
    }

    setIsSubmittingManual(true);
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      [manualType === "murid" ? "nis" : "nip"]: manualId,
      nama: manualNama,
      [manualType === "murid" ? "kelas" : "jabatan"]: manualDetail,
      status: manualStatus,
      keterangan: manualStatus === "Hadir" ? "-" : "Input Manual oleh Piket",
      catatan: manualCatatan || "Lupa bawa kartu / Bantuan Staf",
      latitude: -6.168491,
      longitude: 106.83316,
      jarak: 0,
      isWithinRadius: true,
      isManualOverride: true,
    };

    setTimeout(() => {
      onAddRecord(manualType, payload);
      onAddLog?.(
        "ABSENSI_MANUAL",
        `Input manual untuk ${manualNama} (${manualDetail})`,
      );
      setIsSubmittingManual(false);
      setShowManualForm(false);
      // Reset form
      setManualId("");
      setManualNama("");
      setManualDetail("");
      setManualStatus("Hadir");
      setManualCatatan("");

      Swal.fire({
        title: "Berhasil!",
        text: `Data absensi ${manualNama} telah ditambahkan secara manual.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    }, 800);
  };

  const handleMarkAllPresent = async () => {
    const absentees = todayStudentRecords.filter(
      (r) => r.data.status !== "Hadir",
    );
    if (absentees.length === 0) return;

    const result = await Swal.fire({
      title: "Konfirmasi Massal",
      text: `Apakah Anda yakin ingin menandai ${absentees.length} siswa sebagai "Hadir"? Tindakan ini akan dicatat dalam log audit.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Tandai Semua Hadir",
      cancelButtonText: "Batal",
      confirmButtonColor: "#10b981",
    });

    if (result.isConfirmed) {
      absentees.forEach((r) => {
        onToggleOverride?.(r.id, "Hadir", "Bulk update oleh Piket");
      });
      onAddLog?.(
        "BULK_UPDATE",
        `Menandai ${absentees.length} siswa sebagai Hadir hari ini`,
      );
      Swal.fire("Berhasil", "Semua siswa telah diperbarui.", "success");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* NOTIFICATION PANEL (POPOVER) */}
      <AnimatePresence>
        {showNotificationPanel && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-16 right-0 z-50 w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Notifikasi Anomali & Peringatan
                </h3>
              </div>
              <button
                onClick={() => setShowNotificationPanel(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-xs text-slate-500 font-bold">
                    Tidak ada peringatan baru
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Sistem dalam kondisi aman dan terkendali.
                  </p>
                </div>
              ) : (
                activeAlerts.map((alertRecord: any) => {
                  const isRadius = alertRecord.alertType === "RADIUS";
                  const isTimeAnomaly = alertRecord.alertType === "TIME_ANOMALY";

                  return (
                    <div
                      key={`${alertRecord.id}-${alertRecord.alertType}`}
                      className={`p-3 rounded-2xl border flex gap-3 relative transition-all hover:scale-[1.01] ${isRadius ? "bg-rose-50 border-rose-100" : isTimeAnomaly ? "bg-purple-50 border-purple-100" : "bg-amber-50 border-amber-100"}`}
                    >
                      <div
                        className={`w-1.5 absolute left-0 top-3 bottom-3 rounded-r-full ${isRadius ? "bg-rose-500" : isTimeAnomaly ? "bg-purple-500" : "bg-amber-500"}`}
                      ></div>
                      <ShieldAlert
                        size={18}
                        className={`shrink-0 ${isRadius ? "text-rose-600" : isTimeAnomaly ? "text-purple-600" : "text-amber-600"}`}
                      />
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-slate-800 leading-snug">
                          {isRadius
                            ? `Radius: ${alertRecord.data.nama}`
                            : isTimeAnomaly
                              ? `Jam: ${alertRecord.data.nama}`
                              : `Late: ${alertRecord.data.nama}`}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                          {isRadius
                            ? `Absensi terdeteksi di luar jangkauan (${alertRecord.data.jarak}m)`
                            : isTimeAnomaly
                              ? `Absensi dilakukan pada jam tidak wajar`
                              : `Siswa terlambat check-in`}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] font-bold text-slate-400 font-mono">
                            {new Date(alertRecord.timestamp).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            WIB
                          </span>
                          <button
                            onClick={() =>
                              setDismissedAlerts((prev) =>
                                new Set(prev).add(alertRecord.id),
                              )
                            }
                            className="text-[9px] font-bold text-indigo-600 hover:underline"
                          >
                            Tandai Dibaca
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MANUAL ATTENDANCE FORM MODAL */}
      <AnimatePresence>
        {showManualForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Entri Absensi Manual
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Bantuan untuk siswa/guru tanpa kartu
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManualForm(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setManualType("murid")}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${manualType === "murid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Siswa
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualType("guru")}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${manualType === "guru" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Guru/Staf
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {manualType === "murid" ? "NISN" : "NIP"}
                    </label>
                    <input
                      required
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="1234..."
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {manualType === "murid" ? "Kelas" : "Jabatan"}
                    </label>
                    <input
                      required
                      value={manualDetail}
                      onChange={(e) => setManualDetail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="10-A / Guru Bio"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    required
                    value={manualNama}
                    onChange={(e) => setManualNama(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Nama lengkap..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Hadir", "Sakit", "Izin"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setManualStatus(s)}
                        className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${manualStatus === s ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-600 border-slate-200"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    value={manualCatatan}
                    onChange={(e) => setManualCatatan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Contoh: Lupa bawa kartu..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingManual ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Simpan Absensi Manual
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <ClipboardList size={20} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Portal Guru Piket
            </h2>
          </div>
          <p className="text-slate-500 font-medium text-sm">
            Manajemen harian, rekap absensi, buku piket, dan perizinan siswa.
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 h-11 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Absensi Manual</span>
          </button>

          <button
            onClick={() => setShowNotificationPanel(!showNotificationPanel)}
            className={`relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-all active:scale-95 shadow-sm ${activeAlerts.length > 0 ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600"}`}
            title="Buka Notifikasi Anomali"
          >
            <Bell size={18} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                {activeAlerts.length}
              </span>
            )}
          </button>

          <div className="w-px h-8 bg-slate-200 mx-1"></div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isMuted
                  ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
              title={isMuted ? "Hidupkan Suara" : "Senyapkan Suara"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm gap-1.5 mb-6">
        <button
          onClick={() => setActiveTab("rekap")}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black transition-all ${
            activeTab === "rekap"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          }`}
        >
          <Users size={16} />
          <span>REKAPITULASI</span>
        </button>
        <button
          onClick={() => setActiveTab("buku")}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black transition-all ${
            activeTab === "buku"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          }`}
        >
          <BookOpen size={16} />
          <span>BUKU PIKET</span>
        </button>
        <button
          onClick={() => setActiveTab("izin")}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black transition-all ${
            activeTab === "izin"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          }`}
        >
          <DoorOpen size={16} />
          <span>PERIZINAN</span>
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black transition-all ${
            activeTab === "audit"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert size={16} />
          <span>AUDIT LOG</span>
        </button>
      </div>

      {/* Tab Content: Rekap */}
      <AnimatePresence mode="wait">
        {activeTab === "rekap" && (
          <motion.div
            key="rekap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
          {/* Drive Sync Panel */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <Cloud size={160} />
            </div>
            <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                <HardDrive size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                  Sinkronisasi Otomatis Google Drive
                </h3>
                <p className="text-indigo-200 text-xs font-medium mt-1 max-w-sm">
                  Status: Aktif. Laporan harian PDF/CSV akan otomatis dikirimkan
                  ke folder "Rekap Absen Sekolah" setiap pukul 16:00 WIB.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto relative z-10">
              {lastSyncTime && (
                <div className="text-[10px] text-indigo-200 font-bold tracking-wider uppercase text-center sm:text-right">
                  Terakhir Sinkronisasi:
                  <br />
                  <span className="text-white font-mono">{lastSyncTime}</span>
                </div>
              )}
              <button
                onClick={handleManualSync}
                disabled={isDriveSyncing}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm w-full sm:w-auto transition-all ${isDriveSyncing ? "bg-indigo-500/50 text-indigo-200 cursor-wait" : "bg-white text-indigo-700 hover:bg-indigo-50 shadow-md"}`}
              >
                {isDriveSyncing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />{" "}
                    Menyelaraskan Data...
                  </>
                ) : (
                  <>
                    <Clock size={16} /> Paksa Sinkronisasi Ulang
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Users className="text-indigo-500" size={20} />
                  Kehadiran Siswa
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">
                      Hadir
                    </span>
                    <span className="font-black text-emerald-700 text-2xl leading-none">
                      {studentHadirCount}
                    </span>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-600 mb-0.5">
                      Absen/Sakit
                    </span>
                    <span className="font-black text-amber-700 text-2xl leading-none">
                      {studentAbsenCount}
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-600 mb-0.5">
                      Izin Keluar
                    </span>
                    <span className="font-black text-blue-700 text-2xl leading-none">
                      {studentKeluarCount}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-slate-600 text-sm">
                      Filter Laporan
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsFocusMode(!isFocusMode)}
                        className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${isFocusMode ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                        title="Hanya tampilkan Terlambat & Alpa"
                      >
                        <Filter size={14} />
                        Mode Fokus
                      </button>
                      <span className="font-black text-indigo-600 text-lg">
                        {filteredStudentRecords.length} /{" "}
                        {todayStudentRecords.length}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select
                        value={filterKelas}
                        onChange={(e) => setFilterKelas(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Semua">Semua Kelas</option>
                        {uniqueClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Semua">Semua Status</option>
                        <option value="Hadir">Hadir</option>
                        <option value="Terlambat">Terlambat</option>
                        <option value="Sakit">Sakit</option>
                        <option value="Izin">Izin</option>
                        <option value="Alpa">Alpa</option>
                      </select>
                    </div>
                  </div>
                  {onToggleOverride && filteredStudentRecords.some(r => r.data.status !== 'Hadir') && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => {
                          let count = 0;
                          filteredStudentRecords.forEach(r => {
                            if (r.data.status !== 'Hadir') {
                              onToggleOverride(r.id, 'Hadir');
                              count++;
                            }
                          });
                          if (onAddLog && count > 0) {
                            onAddLog('Validasi Masal', `Guru Piket menyetujui ${count} siswa (Setujui Semua)`);
                          }
                        }}
                        className="py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 size={14} /> Setujui Semua
                      </button>
                      <button 
                        onClick={handleMarkAllPresent}
                        className="py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Users size={14} /> Tandai Semua Hadir
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {filteredStudentRecords.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-6 text-slate-400 text-sm font-semibold border-2 border-dashed border-slate-100 rounded-xl"
                      >
                        Tidak ada record yang sesuai dengan filter.
                      </motion.div>
                    ) : (
                      filteredStudentRecords.map((r, i) => {
                        const data = r.data as StudentAttendance;
                        const isExpanded = expandedMapId === r.id;
                        const hasLocation =
                          data.latitude !== null && 
                          data.longitude !== null && 
                          !isNaN(data.latitude) && 
                          !isNaN(data.longitude);
                        return (
                          <motion.div
                            key={r.id || i}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col text-sm bg-white border border-slate-100 rounded-lg shadow-sm gap-2 overflow-hidden"
                          >
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 gap-2">
                            <div>
                              <div className="flex items-center flex-wrap gap-2">
                                <p className="font-bold text-slate-800">
                                  {data.nama}
                                </p>
                                {(() => {
                                  if (!r.timestamp) return null;
                                  const hrs = new Date(r.timestamp).getHours();
                                  if (hrs < 6 || hrs >= 18) {
                                    return (
                                      <span className="text-[8px] bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold shrink-0 animate-pulse">
                                        ⚠️ Anomali Waktu
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                                {data.isWithinRadius === false && (
                                  <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold shrink-0 animate-pulse">
                                    🚩 Lokasi Mencurigakan
                                  </span>
                                )}
                                {data.isManualOverride && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shrink-0">
                                    Manual
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-slate-500">
                                  {data.kelas} -{" "}
                                  {new Date(r.timestamp).toLocaleTimeString(
                                    "id-ID",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                  {data.catatan && (
                                    <span className="ml-2 text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded italic">
                                      Note: {data.catatan}
                                    </span>
                                  )}
                                </p>
                                {hasLocation && (
                                  <button
                                    onClick={() =>
                                      setExpandedMapId(isExpanded ? null : r.id)
                                    }
                                    className={`text-[9px] flex items-center gap-1 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-all cursor-pointer ${isExpanded ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-slate-200"}`}
                                  >
                                    <MapPin size={10} />
                                    {isExpanded ? "Tutup Peta" : "Lihat Lokasi"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              {data.status === "Alpa" && (
                                <button
                                  onClick={() =>
                                    handleNotifyAction(r.id, data.nama)
                                  }
                                  disabled={notifiedStudents.has(r.id)}
                                  className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md font-bold transition-colors shadow-sm cursor-pointer ${
                                    notifiedStudents.has(r.id)
                                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                      : "bg-rose-100/50 hover:bg-rose-100 border border-rose-200 text-rose-700"
                                  }`}
                                  title="Kirim SP Absensi WhatsApp ke Ortu"
                                >
                                  {notifiedStudents.has(r.id) ? (
                                    <>
                                      <CheckCircle2 size={12} />
                                      Terkirim
                                    </>
                                  ) : (
                                    <>
                                      <Send size={12} />
                                      Notif Ortu
                                    </>
                                  )}
                                </button>
                              )}
                              {onToggleOverride ? (
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="text"
                                    placeholder="Catatan..."
                                    defaultValue={data.catatan}
                                    onBlur={(e) => onToggleOverride(r.id, data.status, e.target.value)}
                                    className="px-2 py-1.5 rounded-lg text-[10px] font-medium border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-500 w-24 sm:w-32"
                                  />
                                  <select
                                    value={data.status}
                                    onChange={(e) => onToggleOverride(r.id, e.target.value as AttendanceStatus, data.catatan)}
                                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans transition-all ${
                                      data.status === "Hadir"
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                        : data.status === "Terlambat"
                                          ? "bg-amber-50 border-amber-200 text-amber-805"
                                          : data.status === "Alpa"
                                            ? "bg-rose-50 border-rose-200 text-rose-805"
                                            : data.status === "Izin" || data.status === "Sakit"
                                              ? "bg-indigo-50 border-indigo-200 text-indigo-805"
                                              : "bg-slate-50 border-slate-200 text-slate-805"
                                    }`}
                                    title="Ubah Status Absensi Siswa"
                                  >
                                    <option value="Hadir">Hadir</option>
                                    <option value="Terlambat">Terlambat</option>
                                    <option value="Sakit">Sakit</option>
                                    <option value="Izin">Izin</option>
                                    <option value="Alpa">Alpa</option>
                                  </select>
                                </div>
                              ) : (
                                <span
                                  className={`px-2 py-1 rounded-md text-[10px] items-center flex font-bold ${
                                    data.status === "Hadir"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : data.status === "Terlambat"
                                        ? "bg-orange-100 text-orange-700"
                                        : data.status === "Alpa"
                                          ? "bg-rose-100 text-rose-700"
                                          : data.status === "Izin" ||
                                              data.status === "Sakit"
                                            ? "bg-indigo-100 text-indigo-700"
                                            : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {data.status}
                                </span>
                              )}
                            </div>
                          </div>
                          {data.keterangan &&
                            data.keterangan !== "-" &&
                            data.keterangan.trim() !== "" &&
                            (() => {
                              const ai = analyzeSentimentAndUrgency(
                                data.keterangan,
                                data.status,
                              );
                              return (
                                <div className="mx-3 mb-3 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg flex flex-col gap-1.5">
                                  <p className="text-xs text-slate-600 font-medium italic">
                                    "{data.keterangan}"
                                  </p>
                                  {ai && (
                                    <div className="flex items-center gap-2 mt-1 border-t border-slate-100 pt-1.5">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">
                                        AI Analysis
                                      </span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ai.color}`}
                                      >
                                        Emosi: {ai.emotion}
                                      </span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ai.urgency === "Tinggi" ? "bg-rose-100 text-rose-700 border-rose-200" : ai.urgency === "Sedang" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                                      >
                                        Urgensi: {ai.urgency}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          {/* Expandable Minimap inline */}
                          {isExpanded && hasLocation && (
                            <div className="border-t border-slate-100 bg-slate-50 p-2">
                              <div className="h-[150px] rounded-lg overflow-hidden border border-slate-200 shadow-inner relative z-0">
                                <MapContainer
                                  center={[data.latitude!, data.longitude!]}
                                  zoom={15}
                                  className="w-full h-full"
                                  zoomControl={false}
                                  style={{ zIndex: 1 }}
                                >
                                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                  <Marker
                                    position={[data.latitude!, data.longitude!]}
                                    icon={customMarkerIcon}
                                  >
                                    <Popup>
                                      <span className="text-[10px] font-bold">
                                        {data.nama}
                                      </span>
                                    </Popup>
                                  </Marker>
                                </MapContainer>
                              </div>
                              <div className="mt-1.5 flex justify-between items-center px-1">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Lat: {data.latitude?.toFixed(5)}, Lng:{" "}
                                  {data.longitude?.toFixed(5)}
                                </span>
                                {data.jarak !== undefined && (
                                  <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    Jarak: {data.jarak}m
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="text-emerald-500" size={20} />
                Kehadiran Guru / GTK
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-600 text-sm">
                    Total Record Absen
                  </span>
                  <span className="font-black text-emerald-600 text-xl">
                    {todayTeacherRecords.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {todayTeacherRecords.slice(0, 5).map((r, i) => {
                    const data = r.data as TeacherAttendance;
                    return (
                      <div
                        key={i}
                        className="flex justify-between items-center text-sm p-3 bg-white border border-slate-100 rounded-lg shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-slate-800">
                            {data.nama}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(r.timestamp).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {onToggleOverride ? (
                          <select
                            value={data.status}
                            onChange={(e) => onToggleOverride(r.id, e.target.value as AttendanceStatus, data.catatan)}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans transition-all ${
                              data.status === "Hadir"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : data.status === "Terlambat"
                                  ? "bg-amber-50 border-amber-200 text-amber-805"
                                  : data.status === "Alpa"
                                    ? "bg-rose-50 border-rose-200 text-rose-805"
                                    : data.status === "Izin" || data.status === "Sakit"
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-805"
                                      : "bg-slate-50 border-slate-200 text-slate-805"
                            }`}
                            title="Ubah Status Absensi Guru"
                          >
                            <option value="Hadir">Hadir</option>
                            <option value="Terlambat">Terlambat</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Izin">Izin</option>
                            <option value="Alpa">Alpa</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                              data.status === "Hadir"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {data.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {todayTeacherRecords.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">
                      Belum ada absen guru hari ini.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Content: Buku Piket */}
      {activeTab === "buku" && (
        <motion.div
          key="buku"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-1">
            <form
              onSubmit={handleAddBukuPiket}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                Catat Kejadian Baru
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Jenis Kejadian
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewEventType("info")}
                      className={`py-2 text-xs font-bold rounded-lg ${newEventType === "info" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-slate-50 text-slate-600 border border-slate-200"}`}
                    >
                      Info
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEventType("warning")}
                      className={`py-2 text-xs font-bold rounded-lg ${newEventType === "warning" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-50 text-slate-600 border border-slate-200"}`}
                    >
                      Teguran
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEventType("violation")}
                      className={`py-2 text-xs font-bold rounded-lg ${newEventType === "violation" ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-slate-50 text-slate-600 border border-slate-200"}`}
                    >
                      Pelanggaran
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Deskripsi Kejadian
                  </label>
                  <textarea
                    value={newEvent}
                    onChange={(e) => setNewEvent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    rows={4}
                    placeholder="Misal: Siswa ketahuan membolos di kantin..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={!newEvent}
                  className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {bukuPiket.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex gap-4 items-start"
              >
                <div
                  className={`p-3 rounded-xl mt-1 ${
                    item.type === "violation"
                      ? "bg-rose-100 text-rose-600"
                      : item.type === "warning"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {item.type === "violation" ? (
                    <AlertTriangle size={24} />
                  ) : item.type === "warning" ? (
                    <AlertTriangle size={24} />
                  ) : (
                    <Info size={24} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {item.time} WIB
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.type === "violation"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : item.type === "warning"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {item.type === "violation"
                        ? "Pelanggaran Berat"
                        : item.type === "warning"
                          ? "Peringatan"
                          : "Informasi"}
                    </span>
                  </div>
                  <p className="text-slate-800 text-sm font-medium leading-relaxed">
                    {item.event}
                  </p>
                </div>
              </div>
            ))}
            {bukuPiket.length === 0 && (
              <div className="text-center p-12 bg-white border border-slate-200 rounded-2xl border-dashed">
                <p className="text-slate-400 font-medium text-sm">
                  Buku piket masih kosong hari ini.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab Content: Perizinan */}
      {activeTab === "izin" && (
        <motion.div
          key="izin"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-1">
            <form
              onSubmit={handleCreateIzin}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                Buat Surat Izin Baru
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={izinName}
                    onChange={(e) => setIzinName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    placeholder="Nama Siswa / Guru"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Kelas / Jabatan
                  </label>
                  <input
                    type="text"
                    value={izinClass}
                    onChange={(e) => setIzinClass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    placeholder="Contoh: 12-IPA-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Keperluan / Alasan
                  </label>
                  <input
                    type="text"
                    value={izinReason}
                    onChange={(e) => setIzinReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    placeholder="Misal: Berobat ke Puskesmas"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!izinName || !izinReason || !izinClass}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Keluarkan Surat Izin
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {izinList.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 shrink-0">
                      <User size={20} className="text-slate-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">
                        {item.name}{" "}
                        <span className="text-sm font-normal text-slate-500">
                          ({item.class})
                        </span>
                      </h4>
                      <p className="text-sm text-slate-600 mt-1 mb-2">
                        Alasan:{" "}
                        <span className="font-medium text-slate-800">
                          {item.reason}
                        </span>
                      </p>
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} /> Keluar: {item.timeOut} WIB
                        </div>
                        {item.timeIn && (
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 size={14} /> Kembali: {item.timeIn}{" "}
                            WIB
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {item.status === "keluar" ? (
                    <button
                      onClick={() => handleSetKembali(item.id)}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      Konfirmasi Kembali
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider">
                      Selesai
                    </span>
                  )}
                </div>
              </div>
            ))}
            {izinList.length === 0 && (
              <div className="text-center p-12 bg-white border border-slate-200 rounded-2xl border-dashed">
                <p className="text-slate-400 font-medium text-sm">
                  Belum ada data perizinan.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
      {/* Tab Content: Audit */}
      {activeTab === "audit" && (
        <motion.div
          key="audit"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Log Audit Keamanan Akses
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Monitoring anomali lokasi dan perubahan manual absensi
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
                <tr>
                  <th className="px-4 py-3">Waktu Terdeteksi</th>
                  <th className="px-4 py-3">Identitas Pengguna</th>
                  <th className="px-4 py-3 text-center">Tipe Anomali</th>
                  <th className="px-4 py-3">Detail Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                {records.filter(
                  (r) =>
                    r.data.isManualOverride || r.data.isWithinRadius === false,
                ).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center italic text-slate-400"
                    >
                      Tidak ditemukan anomali. Sistem aman.
                    </td>
                  </tr>
                ) : (
                  records
                    .filter(
                      (r) =>
                        r.data.isManualOverride ||
                        r.data.isWithinRadius === false,
                    )
                    .map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono">
                          {new Date(r.timestamp).toLocaleString("id-ID")} WIB
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800 block">
                            {(r.data as any).nama}
                          </span>
                          <span className="text-xs text-slate-400">
                            UID: {(r.data as any).nis || (r.data as any).nip}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.data.isManualOverride ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 font-bold text-[10px] rounded uppercase tracking-wider">
                              Override Manual
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded uppercase tracking-wider">
                              Luar Geofence
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs max-w-sm truncate text-slate-500">
                          {r.data.isManualOverride
                            ? "Status diubah secara manual tanpa GPS valid"
                            : `Koordinat terdeteksi sejauh ${r.data.jarak}m dari pusat radius sekolah (SMK Tutwuri)`}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
