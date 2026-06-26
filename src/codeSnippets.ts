/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SPREADSHEET_GUIDE = {
  fileName: "Database_Absensi_Sekolah",
  sheets: [
    {
      name: "Data_Murid",
      headers: [
        "Timestamp",
        "NIS / NISN",
        "Nama Lengkap",
        "Kelas",
        "Status",
        "Keterangan",
        "Lokasi (Lat, Long)",
        "Jarak (Meter)",
        "Verifikasi Lokasi"
      ],
      description: "Menyimpan data kehadiran harian dari seluruh siswa."
    },
    {
      name: "Data_Guru",
      headers: [
        "Timestamp",
        "NIP / ID Pegawai",
        "Nama Lengkap",
        "Jabatan / Mapel",
        "Status",
        "Keterangan",
        "Lokasi (Lat, Long)",
        "Jarak (Meter)",
        "Verifikasi Lokasi"
      ],
      description: "Menyimpan data kehadiran harian guru dan tenaga kependidikan."
    },
    {
      name: "Akun_Admin",
      headers: ["Username", "Nama", "Role", "Password", "Detail"],
      description: "Menyimpan data kredensial login untuk administrator sistem."
    },
    {
      name: "Akun_Guru",
      headers: ["Username", "Nama", "Role", "Password", "Detail"],
      description: "Menyimpan data kredensial login untuk Guru dan Staff."
    },
    {
      name: "Akun_Murid",
      headers: ["Username", "Nama", "Role", "Password", "Detail"],
      description: "Menyimpan data kredensial login untuk Siswa (NISN)."
    }
  ]
};

export const CODE_GS_CONTENT = `/**
 * SISTEM INFORMASI ABSENSI SEKOLAH REAL-TIME (GAS BACKEND)
 * Pengembang: Senior Full-Stack Web Developer & System Analyst
 * Deskripsi: Skrip backend untuk menerima data absensi siswa dan guru ke Google Sheets.
 */

// Konfigurasi Inti
var CONFIG = {
  // Koordinat Utama Sekolah (Contoh: SMK Tutwuri Handayani, Cimahi)
  // Ganti koordinat ini sesuai dengan lokasi sekolah Anda
  SCHOOL_LATITUDE: -6.8837,
  SCHOOL_LONGITUDE: 107.5451,
  MAX_RADIUS_METER: 100 // Radius maksimal presensi di area sekolah (100 meter)
};

/**
 * Endpoint Utama Web App (GET)
 * Menampilkan halaman antarmuka web absensi
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Presensi Real-time Sekolah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menyimpan data absensi Murid
 * Dipanggil dari frontend menggunakan google.script.run
 * 
 * @param {Object} data - Payload data absensi murid
 * @return {Object} Response status
 */
function submitAbsensiMurid(data) {
  var lock = LockService.getScriptLock();
  try {
    // Tunggu maksimal 15 detik jika ada proses tulis lain yang sedang aktif
    lock.waitLock(15000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(spreadsheet, "Data_Murid", [
      "Timestamp", "NIS", "Nama", "Kelas", "Status", "Keterangan", "Lokasi (Lat, Long)", "Jarak (Meter)", "Verifikasi"
    ]);
    
    var timestamp = new Date();
    var latLongStr = "-";
    var distanceResult = { distance: 0, isValid: false };
    
    if (data.latitude && data.longitude) {
      latLongStr = data.latitude + ", " + data.longitude;
      distanceResult = calculateDistance(data.latitude, data.longitude);
    }
    
    // Siapkan baris data baru sesuai header
    sheet.appendRow([
      timestamp,
      "'" + data.nis.trim(), // Force string with single quote
      data.nama.trim(),
      data.kelas,
      data.status,
      data.keterangan ? data.keterangan.trim() : "-",
      latLongStr,
      distanceResult.distance ? Math.round(distanceResult.distance) : 0,
      distanceResult.isValid ? "DI SEKOLAH" : (data.latitude ? "DI LUAR AREA" : "TANPA GPS")
    ]);
    
    // Sinkronisasi otomatis ke Google Calendar (Izin atau Sakit)
    if (data.status === "Izin" || data.status === "Sakit") {
      try {
        syncKeGoogleCalendar(data.nama, data.kelas, data.status, data.keterangan || "-");
      } catch (calError) {
        Logger.log("Gagal membuat agenda Google Calendar: " + calError.toString());
      }
    }
    
    return {
      status: "SUCCESS",
      message: "Absensi Berhasil Tersimpan! Terima kasih, " + data.nama + ".",
      distance: Math.round(distanceResult.distance),
      isWithinRadius: distanceResult.isValid
    };
    
  } catch (error) {
    Logger.log("Error murid: " + error.toString());
    return {
      status: "ERROR",
      message: "Terjadi kesalahan internal: " + error.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menyimpan data absensi Guru/Tendik
 * Dipanggil dari frontend menggunakan google.script.run
 * 
 * @param {Object} data - Payload data absensi guru
 * @return {Object} Response status
 */
function submitAbsensiGuru(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(spreadsheet, "Data_Guru", [
      "Timestamp", "NIP", "Nama", "Jabatan", "Status", "Keterangan", "Lokasi (Lat, Long)", "Jarak (Meter)", "Verifikasi"
    ]);
    
    var timestamp = new Date();
    var latLongStr = "-";
    var distanceResult = { distance: 0, isValid: false };
    
    if (data.latitude && data.longitude) {
      latLongStr = data.latitude + ", " + data.longitude;
      distanceResult = calculateDistance(data.latitude, data.longitude);
    }
    
    // Siapkan baris data baru sesuai header
    sheet.appendRow([
      timestamp,
      "'" + data.nip.trim(),
      data.nama.trim(),
      data.jabatan.trim(),
      data.status,
      data.keterangan ? data.keterangan.trim() : "-",
      latLongStr,
      distanceResult.distance ? Math.round(distanceResult.distance) : 0,
      distanceResult.isValid ? "DI SEKOLAH" : (data.latitude ? "DI LUAR AREA" : "TANPA GPS")
    ]);
    
    return {
      status: "SUCCESS",
      message: "Absensi Guru/Tendik Berhasil Tersimpan! Selamat bertugas Bapak/Ibu " + data.nama + ".",
      distance: Math.round(distanceResult.distance),
      isWithinRadius: distanceResult.isValid
    };
    
  } catch (error) {
    Logger.log("Error guru: " + error.toString());
    return {
      status: "ERROR",
      message: "Terjadi kesalahan internal: " + error.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Ambil sheet berdasarkan nama, jika tidak tersedia otomatis dibuat dengan header
 */
function getOrCreateSheet(spreadsheet, sheetName, defaultHeaders) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(defaultHeaders);
    
    // Format header agar rapi (Bold dan Background Khas)
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setFontWeight("bold")
      .setBackground("#e2e8f0")
      .setHorizontalAlignment("center");
      
    // Set auto-length column jika didukung
    try {
      sheet.autoResizeColumns(1, defaultHeaders.length);
    } catch(e) {}
  }
  return sheet;
}

/**
 * Helper: Kalkulasi jarak menggunakan formula Haversine (Spheroid Bumi)
 * Menentukan apakah pengguna berada dalam radius geofence sekolah
 */
function calculateDistance(lat, lon) {
  var R = 6371e3; // Radius bumi dalam meter
  var phi1 = CONFIG.SCHOOL_LATITUDE * Math.PI / 180;
  var phi2 = lat * Math.PI / 180;
  var deltaPhi = (lat - CONFIG.SCHOOL_LATITUDE) * Math.PI / 180;
  var deltaLambda = (lon - CONFIG.SCHOOL_LONGITUDE) * Math.PI / 180;

  var a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  var d = R * c; // Hasil dalam Satuan METER
  return {
    distance: d,
    isValid: d <= CONFIG.MAX_RADIUS_METER
  };
}

/**
 * Integrasi otomatis agenda kegiatan presensi siswa (Sakit / Izin) ke Kalender Akademik Sekolah
 */
function syncKeGoogleCalendar(nama, kelas, status, keterangan) {
  try {
    var calendar = CalendarApp.getDefaultCalendar();
    var tanggalMulai = new Date();
    
    // Atur judul dan detail deskripsi agenda kalender
    var judulEvent = "[" + status.toUpperCase() + "] " + nama + " (Kelas " + kelas + ")";
    var deskripsi = "Presensi Sekolah Real-time\\n" +
                    "Nama Siswa: " + nama + "\\n" +
                    "Kelas: " + kelas + "\\n" +
                    "Status Kehadiran: " + status + "\\n" +
                    "Keterangan/Sebab: " + keterangan + "\\n" +
                    "Dibuat Otomatis pada: " + tanggalMulai.toLocaleString("id-ID") + " WIB";
    
    // Buat event All-Day pada kalender akademik default sekolah
    var event = calendar.createAllDayEvent(judulEvent, tanggalMulai, {
      description: deskripsi
    });
    
    Logger.log("Google Calendar Event berhasil dibuat. ID: " + event.getId());
    return {
      success: true,
      eventId: event.getId()
    };
  } catch (error) {
    Logger.log("Kesalahan integrasi Calendar: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
`;

export const INDEX_HTML_CONTENT = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sistem Presensi Real-time Sekolah</title>
  
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- FontAwesome Icons for Beautiful EdTech UI -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  
  <!-- SweetAlert2 for Elegant Popups -->
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
    .custom-gradient-bg {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }
    /* Elegant Custom Scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  </style>
  
  <script>
    // Konfigurasi Tailwind Kustom
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              navy: '#0f172a',
              blue: '#1d4ed8',
              emerald: '#059669',
              slate: '#475569',
              light: '#f1f5f9'
            }
          }
        }
      }
    };
  </script>
</head>

<body class="custom-gradient-bg min-h-screen text-slate-800 antialiased flex flex-col justify-between">

  <!-- Main Container -->
  <main class="w-full max-w-lg mx-auto p-4 sm:p-6 my-auto">
    
    <!-- Header Section -->
    <header class="text-center mb-6">
      <div class="inline-flex items-center justify-center p-2.5 bg-white shadow-sm border border-slate-100 rounded-2xl mb-3">
        <i class="fa-solid fa-graduation-cap text-brand-emerald text-3xl animate-bounce"></i>
      </div>
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight leading-none">Presensi Digital</h1>
      <p class="text-xs text-slate-500 font-medium mt-1">Sistem Absensi Real-time Terverifikasi GPS</p>
      
      <!-- Live Real-time Clock Dashboard -->
      <div class="mt-4 bg-white border border-slate-100 shadow-sm rounded-2xl p-3.5 flex flex-col items-center">
        <span class="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">WAKTU AKTUAL (WIB)</span>
        <div id="digitalClock" class="text-2xl font-mono font-bold text-brand-navy tracking-widest">00:00:00</div>
        <div id="dateString" class="text-xs text-slate-500 font-semibold mt-1">Hari, Tanggal Bulan Tahun</div>
      </div>
    </header>

    <!-- Tab Switch (Category Selector) -->
    <div class="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex gap-1 mb-5">
      <button id="tabButtonMurid" onclick="switchForm('murid')" class="w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-brand-emerald text-white shadow-sm hover:scale-[1.02]">
        <i class="fa-solid fa-user-graduate"></i>
        <span>Absensi Murid</span>
      </button>
      <button id="tabButtonGuru" onclick="switchForm('guru')" class="w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        <i class="fa-solid fa-chalkboard-user"></i>
        <span>Absensi Guru/Tendik</span>
      </button>
    </div>

    <!-- MAIN CARD BOX -->
    <div class="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
      
      <!-- Geolocation Verification Banner status -->
      <div id="gpsStatusBanner" class="bg-amber-50 border-b border-amber-100 px-4 py-3 flex gap-3 items-start text-xs text-amber-800">
        <i class="fa-solid fa-circle-info mt-0.5 text-amber-500 text-sm animate-pulse"></i>
        <div class="flex-1 font-medium">
          <span class="font-bold block">Memverifikasi Sinyal GPS...</span>
          Aplikasi butuh akses lokasi Anda demi keakuratan presensi di sekolah.
        </div>
        <button onclick="requestGeolocation()" class="shrink-0 bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded-lg font-bold hover:bg-amber-100 active:scale-95 transition-all">
          Aktifkan
        </button>
      </div>

      <!-- FORM : ABSENSI MURID -->
      <form id="formMurid" onsubmit="submitPresensi(event, 'murid')" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-id-card text-emerald-600"></i> NIS / NISN <span class="text-rose-500">*</span>
          </label>
          <input type="number" id="muridNis" name="nis" placeholder="Masukkan 10 digit nomor NIS Anda" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-emerald focus:bg-white text-slate-800 font-medium transition-all">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-user text-emerald-600"></i> Nama Lengkap <span class="text-rose-500">*</span>
          </label>
          <input type="text" id="muridNama" name="nama" placeholder="Masukkan Nama Lengkap Sesuai Rapor" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-emerald focus:bg-white text-slate-800 font-medium transition-all">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-hotel text-emerald-600"></i> Kelas <span class="text-rose-500">*</span>
          </label>
          <select id="muridKelas" name="kelas" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-emerald focus:bg-white text-slate-800 font-medium transition-all">
            <option value="" disabled selected>Pilih kelas Anda</option>
            <optgroup label="KELAS X (Sepuluh)">
              <option value="10-A">10-A (IPA 1)</option>
              <option value="10-B">10-B (IPA 2)</option>
              <option value="10-C">10-C (IPS 1)</option>
              <option value="10-D">10-D (IPS 2)</option>
            </optgroup>
            <optgroup label="KELAS XI (Sebelas)">
              <option value="11-A">11-A (Bahasa)</option>
              <option value="11-B">11-B (IPA)</option>
              <option value="11-C">11-C (IPS)</option>
            </optgroup>
            <optgroup label="KELAS XII (Duabelas)">
              <option value="12-A">12-A (Unggulan)</option>
              <option value="12-B">12-B (Reguler 1)</option>
              <option value="12-C">12-C (Reguler 2)</option>
            </optgroup>
          </select>
        </div>

        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check text-emerald-600"></i> Status Kehadiran <span class="text-rose-500">*</span>
          </label>
          <div class="grid grid-cols-3 gap-2.5">
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Hadir" checked onchange="toggleKeteranganField('murid', false)" class="absolute top-2 right-2 accent-brand-emerald">
              <i class="fa-solid fa-square-check text-brand-emerald text-base mb-1"></i>
              <span class="text-xs font-bold">Hadir</span>
            </label>
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Sakit" onchange="toggleKeteranganField('murid', true)" class="absolute top-2 right-2 accent-brand-emerald">
              <i class="fa-solid fa-staff-aesculapius text-amber-500 text-base mb-1"></i>
              <span class="text-xs font-bold">Sakit</span>
            </label>
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Izin" onchange="toggleKeteranganField('murid', true)" class="absolute top-2 right-2 accent-brand-emerald">
              <i class="fa-solid fa-envelope-open-text text-sky-500 text-base mb-1"></i>
              <span class="text-xs font-bold">Izin</span>
            </label>
          </div>
        </div>

        <!-- Conditional Info Field for Sakit/Izin (Hidden by default) -->
        <div id="muridKeteranganContainer" class="hidden transition-all duration-300">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-file-pen text-amber-500"></i> Alasan / Keterangan Sakit / Izin <span class="text-rose-500">*</span>
          </label>
          <textarea id="muridKeterangan" name="keterangan" rows="2" placeholder="Tuliskan keterangan detail alasan ketidakhadiran Anda..."
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-emerald focus:bg-white text-slate-800 font-medium transition-all"></textarea>
        </div>

        <button type="submit" id="btnSubmitMurid" class="w-full bg-brand-emerald hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/15 items-center justify-center gap-2 text-sm flex active:scale-[0.98] transition-all cursor-pointer">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Kirim Absensi Kehadiran</span>
        </button>
      </form>

      <!-- FORM : ABSENSI GURU / TENDIK -->
      <form id="formGuru" onsubmit="submitPresensi(event, 'guru')" class="p-6 space-y-4 hidden">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-id-card-clip text-brand-blue"></i> NIP / ID Pegawai <span class="text-rose-500">*</span>
          </label>
          <input type="number" id="guruNip" name="nip" placeholder="Masukkan Nomor Induk Pegawai Anda" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:bg-white text-slate-800 font-medium transition-all">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-user-tie text-brand-blue"></i> Nama Lengkap <span class="text-rose-500">*</span>
          </label>
          <input type="text" id="guruNama" name="nama" placeholder="Masukkan Nama Lengkap beserta Gelar" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:bg-white text-slate-800 font-medium transition-all">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-chalkboard text-brand-blue"></i> Jabatan / Mata Pelajaran <span class="text-rose-500">*</span>
          </label>
          <input type="text" id="guruJabatan" name="jabatan" placeholder="Contoh: Guru Matematika / Staf TU" required
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:bg-white text-slate-800 font-medium transition-all">
        </div>

        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check text-brand-blue"></i> Status Kehadiran <span class="text-rose-500">*</span>
          </label>
          <div class="grid grid-cols-3 gap-2.5">
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-200 hover:bg-blue-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Hadir" checked onchange="toggleKeteranganField('guru', false)" class="absolute top-2 right-2 accent-brand-blue">
              <i class="fa-solid fa-square-check text-brand-blue text-base mb-1"></i>
              <span class="text-xs font-bold">Hadir</span>
            </label>
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-200 hover:bg-blue-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Sakit" onchange="toggleKeteranganField('guru', true)" class="absolute top-2 right-2 accent-brand-blue">
              <i class="fa-solid fa-staff-aesculapius text-amber-500 text-base mb-1"></i>
              <span class="text-xs font-bold">Sakit</span>
            </label>
            <label class="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-200 hover:bg-blue-50/20 transition-all text-slate-700 relative">
              <input type="radio" name="status" value="Izin" onchange="toggleKeteranganField('guru', true)" class="absolute top-2 right-2 accent-brand-blue">
              <i class="fa-solid fa-envelope-open-text text-sky-500 text-base mb-1"></i>
              <span class="text-xs font-bold">Izin</span>
            </label>
          </div>
        </div>

        <!-- Conditional Info Field for Sakit/Izin (Hidden by default) -->
        <div id="guruKeteranganContainer" class="hidden transition-all duration-300">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-file-pen text-amber-500"></i> Alasan / Keterangan Sakit / Izin <span class="text-rose-500">*</span>
          </label>
          <textarea id="guruKeterangan" name="keterangan" rows="2" placeholder="Tuliskan keterangan detail alasan ketidakhadiran Bapak/Ibu..."
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:bg-white text-slate-800 font-medium transition-all"></textarea>
        </div>

        <button type="submit" id="btnSubmitGuru" class="w-full bg-brand-blue hover:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-600/15 items-center justify-center gap-2 text-sm flex active:scale-[0.98] transition-all cursor-pointer">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Kirim Absensi Kehadiran</span>
        </button>
      </form>
    </div>
  </main>

  <!-- Footer -->
  <footer class="text-center py-4 bg-white border-t border-slate-100 text-[10px] text-slate-400 font-medium mt-10">
    <div class="max-w-md mx-auto">
      &copy; 2026 Absensi Real-time Sekolah. Hak Cipta dilindungi Undang-Undang.<br>
      Didukung oleh Google Apps Script & Google Sheet API.
    </div>
  </footer>

  <!-- SCRIPT LOGIC -->
  <script>
    // Lokasi Global User
    let globalLat = null;
    let globalLong = null;

    // Inisialisasi Jam Web Real-time
    function startClock() {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      
      setInterval(() => {
        const time = new Date();
        const hh = String(time.getHours()).padStart(2, '0');
        const mm = String(time.getMinutes()).padStart(2, '0');
        const ss = String(time.getSeconds()).padStart(2, '0');
        
        document.getElementById('digitalClock').innerText = \`\${hh}:\${mm}:\${ss}\`;
        
        const day = days[time.getDay()];
        const date = time.getDate();
        const month = months[time.getMonth()];
        const year = time.getFullYear();
        document.getElementById('dateString').innerText = \`\${day}, \${date} \${month} \${year}\`;
      }, 1000);
    }
    
    // Switch Form antara Siswa/Guru secara Asynchronus tanpa loading
    let currentTab = 'murid';
    function switchForm(tab) {
      currentTab = tab;
      
      const tabMurid = document.getElementById('tabButtonMurid');
      const tabGuru = document.getElementById('tabButtonGuru');
      const formMurid = document.getElementById('formMurid');
      const formGuru = document.getElementById('formGuru');
      
      if (tab === 'murid') {
        // Switch Class Button Murid (Emerald Green)
        tabMurid.className = "w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-brand-emerald text-white shadow-sm hover:scale-[1.02]";
        tabGuru.className = "w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800";
        
        // Render form
        formMurid.classList.remove('hidden');
        formGuru.classList.add('hidden');
      } else {
        // Switch Class Button Guru (Navy Blue/Royal Blue)
        tabMurid.className = "w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800";
        tabGuru.className = "w-1/2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-brand-navy text-white shadow-sm hover:scale-[1.02]";
        
        // Render form
        formMurid.classList.add('hidden');
        formGuru.classList.remove('hidden');
      }
    }

    // Toggle Tampilan Keterangan Sakit / Izin secara Interaktif
    function toggleKeteranganField(formType, show) {
      const containerId = formType === 'murid' ? 'muridKeteranganContainer' : 'guruKeteranganContainer';
      const textId = formType === 'murid' ? 'muridKeterangan' : 'guruKeterangan';
      const container = document.getElementById(containerId);
      const textInput = document.getElementById(textId);
      
      if (show) {
        container.classList.remove('hidden');
        textInput.setAttribute('required', 'required');
      } else {
        container.classList.add('hidden');
        textInput.removeAttribute('required');
        textInput.value = '';
      }
    }

    // Request Hak Akses Geolocation dari Browser Pengguna
    function requestGeolocation() {
      if (!navigator.geolocation) {
        updateGPSBanner("error", "Perangkat tidak mendukung pelacakan GPS.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          globalLat = position.coords.latitude;
          globalLong = position.coords.longitude;
          updateGPSBanner("success", "Lokasi terdeteksi (" + globalLat.toFixed(5) + ", " + globalLong.toFixed(5) + "). Siap presensi!");
        },
        (error) => {
          let msg = "Akses GPS ditolak: aktifkan izin lokasi di browser Anda.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Izin lokasi ditolak browser. Hubungi admin atau aktifkan izin.";
          }
          updateGPSBanner("warning", msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // Helper: Update Status GPS Banner
    function updateGPSBanner(type, message) {
      const banner = document.getElementById('gpsStatusBanner');
      if (type === "success") {
        banner.className = "bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex gap-3 items-start text-xs text-emerald-800";
        banner.innerHTML = \`
          <i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
          <div class="flex-1 font-medium">
            <span class="font-bold block text-emerald-900">GPS Berhasil Diverifikasi!</span>
            \${message}
          </div>
        \`;
      } else if (type === "warning") {
        banner.className = "bg-amber-50 border-b border-amber-100 px-4 py-3 flex gap-3 items-start text-xs text-amber-800";
        banner.innerHTML = \`
          <i class="fa-solid fa-triangle-exclamation text-amber-500 text-sm animate-bounce"></i>
          <div class="flex-1 font-medium">
            <span class="font-bold block text-amber-900 font-bold">GPS Belum Diizinkan</span>
            \${message}
          </div>
          <button onclick="requestGeolocation()" class="shrink-0 bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded-lg font-bold hover:bg-amber-100 transition-all">Reload</button>
        \`;
      } else {
        banner.className = "bg-rose-50 border-b border-rose-100 px-4 py-3 flex gap-3 items-start text-xs text-rose-800";
        banner.innerHTML = \`
          <i class="fa-solid fa-circle-xmark text-rose-500 text-sm"></i>
          <div class="flex-1 font-medium">
            <span class="font-bold block text-rose-900">Peringatan Keamanan</span>
            \${message}
          </div>
        \`;
      }
    }

    // Handler Utama Kirim Data Presensi ke GAS via google.script.run
    function submitPresensi(event, type) {
      event.preventDefault();
      
      const submitBtn = type === 'murid' ? document.getElementById('btnSubmitMurid') : document.getElementById('btnSubmitGuru');
      const originalHtml = submitBtn.innerHTML;
      
      // Matikan Tombol & Aktifkan Spinner Loading guna mencegah Double Submit (Anti-Spam)
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
      submitBtn.innerHTML = \`<i class="fa-solid fa-circle-notch animate-spin"></i> <span>Sedang Menyimpan Absensi...</span>\`;

      // Jika GPS kosong, minta akses sekali lagi (opsional, tapi disarankan)
      if (globalLat === null || globalLong === null) {
        // Melakukan request lokasi cepat sebelum submit
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            globalLat = pos.coords.latitude;
            globalLong = pos.coords.longitude;
            prosesKirim(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            // Jika tetap tidak bisa, panggil prosesKirim dengan null
            prosesKirim(null, null);
          },
          { enableHighAccuracy: true, timeout: 3000 }
        );
      } else {
        prosesKirim(globalLat, globalLong);
      }

      function prosesKirim(lat, lng) {
        let payload = {};
        
        if (type === 'murid') {
          payload = {
            nis: document.getElementById('muridNis').value,
            nama: document.getElementById('muridNama').value,
            kelas: document.getElementById('muridKelas').value,
            status: document.querySelector('#formMurid input[name="status"]:checked').value,
            keterangan: document.getElementById('muridKeterangan').value,
            latitude: lat,
            longitude: lng
          };
          
          // Mengeksekusi Google Apps Script (GAS) SDK Async API
          if (!navigator.onLine) {
            resetSubmitButton();
            handleOfflineQueueSubmission('murid', payload);
            return;
          }
          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run
              .withSuccessHandler((response) => {
                resetSubmitButton();
                if (response.status === "SUCCESS") {
                  let badge = response.isWithinRadius ? 'success' : 'warning';
                  let locMsg = response.isWithinRadius 
                    ? \`✔ Lokasi Anda terverifikasi di Area Sekolah (Jarak: \${response.distance}m).\` 
                    : \`⚠ Peringatan: Anda berada di luar area sekolah (Jarak: \${response.distance || 'tidak terbatas'}m).\`;
                  
                  let calendarSyncMsg = "";
                  if (payload.status === "Izin" || payload.status === "Sakit") {
                    calendarSyncMsg = \`<p class="text-[10px] font-bold text-sky-700 mt-2 bg-sky-50 p-2 rounded-xl border border-sky-200 flex items-center justify-center gap-1.5"><i class="fa-solid fa-calendar-check text-sky-500 font-bold"></i> [CALENDAR AUTO-SYNC] Presensi Izin/Sakit Terjadwal Otomatis di Kalender Akademik Sekolah!</p>\`;
                  }

                  Swal.fire({
                    icon: badge,
                    title: 'Absensi Terkirim!',
                    html: \`
                      <div class="text-left py-1 text-sm text-slate-600">
                        <p>\${response.message}</p>
                        <hr class="my-2 border-slate-100">
                        <p class="text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">\${locMsg}</p>
                        \${calendarSyncMsg}
                      </div>
                    \`,
                    confirmButtonColor: '#059669',
                    customClass: { popup: 'rounded-3xl' }
                  });
                  document.getElementById('formMurid').reset();
                  toggleKeteranganField('murid', false);
                } else {
                  Swal.fire({
                    icon: 'error',
                    title: 'Gagal Menyimpan!',
                    text: response.message,
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-3xl' }
                  });
                }
              })
              .withFailureHandler((err) => {
                resetSubmitButton();
                if (!navigator.onLine) {
                  handleOfflineQueueSubmission('murid', payload);
                } else {
                  Swal.fire({
                    icon: 'error',
                    title: 'Gangguan Server!',
                    text: 'Hubungi IT administrator: ' + err.toString(),
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-3xl' }
                  });
                }
              })
              .submitAbsensiMurid(payload);
          } else {
            // MOCK MODE : Jika diakses di luar GAS (Misalnya Preview Local)
            setTimeout(() => {
              resetSubmitButton();
              
              // Hitung jarak simulasi dari sekolah
              let dummyDistance = 45; // simulasi 45 meter
              let isWithin = dummyDistance <= 100;
              let locMsg = isWithin 
                ? \`<p class="text-xs text-slate-500 mt-2 font-semibold bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-100">✔ Lokasi Anda terverifikasi di Area Sekolah (Jarak: \${dummyDistance}m). Pas di radius aman!</p>\` 
                : \`<p class="text-xs text-slate-500 mt-2 font-semibold bg-amber-50 text-amber-800 p-2 rounded-xl border border-amber-100">⚠ Peringatan: Jarak Anda \${dummyDistance}m (Di luar area sekolah). Tetap dicatat dengan catatan lokasi.</p>\`;
              
              let calendarSyncMsg = "";
              if (payload.status === "Izin" || payload.status === "Sakit") {
                calendarSyncMsg = \`<p class="text-[10px] font-bold text-sky-700 mt-2 bg-sky-50 p-2 rounded-xl border border-sky-200 flex items-center gap-1.5"><i class="fa-solid fa-calendar-check text-sky-500 font-bold"></i> [CALENDAR AUTO-SYNC] Presensi Izin/Sakit Terjadwal Otomatis di Kalender Akademik Sekolah!</p>\`;
              }

              Swal.fire({
                icon: 'success',
                title: 'SUKSES (MOCK PREVIEW)',
                html: \`
                  <div class="text-left py-1 text-sm text-slate-600">
                    <p><b>Nama:</b> \${payload.nama}</p>
                    <p><b>NIS:</b> \${payload.nis}</p>
                    <p><b>Kelas:</b> \${payload.kelas}</p>
                    <p><b>Status:</b> \${payload.status}</p>
                    \${payload.keterangan ? \`<p><b>Alasan:</b> \${payload.keterangan}</p>\` : ''}
                    \${locMsg}
                    \${calendarSyncMsg}
                  </div>
                \`,
                confirmButtonColor: '#059669',
                confirmButtonText: 'OKE',
                customClass: { popup: 'rounded-2xl' }
              });
              document.getElementById('formMurid').reset();
              toggleKeteranganField('murid', false);
            }, 1200);
          }
          
        } else {
          // GURU FLOW
          payload = {
            nip: document.getElementById('guruNip').value,
            nama: document.getElementById('guruNama').value,
            jabatan: document.getElementById('guruJabatan').value,
            status: document.querySelector('#formGuru input[name="status"]:checked').value,
            keterangan: document.getElementById('guruKeterangan').value,
            latitude: lat,
            longitude: lng
          };
          
          if (!navigator.onLine) {
            resetSubmitButton();
            handleOfflineQueueSubmission('guru', payload);
            return;
          }
          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run
              .withSuccessHandler((response) => {
                resetSubmitButton();
                if (response.status === "SUCCESS") {
                  let badge = response.isWithinRadius ? 'success' : 'warning';
                  let locMsg = response.isWithinRadius 
                    ? \`Lokasi terverifikasi berada di sekolah (Sekitar \${response.distance}m).\` 
                    : \`Presensi Tercatat, Namun Anda terdeteksi di luar area sekolah (Sekitar \${response.distance || 'tidak terbatas'}m).\`;
                  
                  Swal.fire({
                    icon: badge,
                    title: 'Presensi Sukses!',
                    text: response.message + ' ' + locMsg,
                    confirmButtonColor: '#1e3a8a',
                    customClass: { popup: 'rounded-3xl' }
                  });
                  document.getElementById('formGuru').reset();
                  toggleKeteranganField('guru', false);
                } else {
                  Swal.fire({
                    icon: 'error',
                    title: 'Gagal!',
                    text: response.message,
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-3xl' }
                  });
                }
              })
              .withFailureHandler((err) => {
                resetSubmitButton();
                if (!navigator.onLine) {
                  handleOfflineQueueSubmission('guru', payload);
                } else {
                  Swal.fire({
                    icon: 'error',
                    title: 'Koneksi Terganggu!',
                    text: 'Detail: ' + err.toString(),
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-3xl' }
                  });
                }
              })
              .submitAbsensiGuru(payload);
          } else {
            // MOCK MODE : Preview Local
            setTimeout(() => {
              resetSubmitButton();
              let dummyDistance = 60; // 60m
              let isWithin = dummyDistance <= 100;
              let locMsg = isWithin 
                ? \`<p class="text-xs text-slate-500 mt-2 font-semibold bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-100">✔ Lokasi terverifikasi di Area Sekolah (Jarak: \${dummyDistance}m). Presensi Valid!</p>\` 
                : \`<p class="text-xs text-slate-500 mt-2 font-semibold bg-amber-50 text-amber-800 p-2 rounded-xl border border-amber-100">⚠ Peringatan: Jarak Anda \${dummyDistance}m (Di luar area sekolah). Tetap didata dengan catatan jarak.</p>\`;
              
              Swal.fire({
                icon: 'success',
                title: 'SUKSES (MOCK PREVIEW)',
                html: \`
                  <div class="text-left py-1 text-sm text-slate-600">
                    <p><b>Nama Guru/Gelar:</b> Bapak/Ibu \${payload.nama}</p>
                    <p><b>NIP:</b> \${payload.nip}</p>
                    <p><b>Jabatan/Mapel:</b> \${payload.jabatan}</p>
                    <p><b>Status:</b> \${payload.status}</p>
                    \${payload.keterangan ? \`<p><b>Keterangan:</b> \${payload.keterangan}</p>\` : ''}
                    \${locMsg}
                  </div>
                \`,
                confirmButtonColor: '#1e3a8a',
                confirmButtonText: 'Bagus',
                customClass: { popup: 'rounded-2xl' }
              });
              document.getElementById('formGuru').reset();
              toggleKeteranganField('guru', false);
            }, 1200);
          }
        }
      }

      function resetSubmitButton() {
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = originalHtml;
      }
    }

    // ==========================================
    // SISTEM ANTREAN SYNC OFFLINE & AUTO-PUSH
    // ==========================================
    window.addEventListener('online', triggerBgSync);
    
    function triggerBgSync() {
      let queue = JSON.parse(localStorage.getItem('gas_offline_queue') || '[]');
      if (queue.length === 0) return;
      
      console.log("Internet tersambung kembali! Mensinkronisasi " + queue.length + " data offline...");
      
      Swal.fire({
        title: 'Koneksi Pulih!',
        text: 'Mengunggah ' + queue.length + ' data absensi tertunda ke Google Sheets...',
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
          processSyncQueue(queue);
        },
        customClass: { popup: 'rounded-3xl' }
      });
    }

    function processSyncQueue(queue) {
      if (queue.length === 0) {
        localStorage.setItem('gas_offline_queue', JSON.stringify([]));
        Swal.fire({
          icon: 'success',
          title: 'Sinkronisasi Sukses!',
          text: 'Semua antrean absensi offline berhasil diunggah ke Google Sheets!',
          confirmButtonColor: '#059669',
          customClass: { popup: 'rounded-3xl' }
        });
        return;
      }

      let currentItem = queue[0];
      
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        if (currentItem.type === 'murid') {
          google.script.run
            .withSuccessHandler(function(response) {
              if (response.status === "SUCCESS") {
                queue.shift();
                processSyncQueue(queue);
              } else {
                failSync(queue);
              }
            })
            .withFailureHandler(function() {
              failSync(queue);
            })
            .submitAbsensiMurid(currentItem.payload);
        } else {
          google.script.run
            .withSuccessHandler(function(response) {
              if (response.status === "SUCCESS") {
                queue.shift();
                processSyncQueue(queue);
              } else {
                failSync(queue);
              }
            })
            .withFailureHandler(function() {
              failSync(queue);
            })
            .submitAbsensiGuru(currentItem.payload);
        }
      } else {
        // MOCK SYNC SIMULATOR
        setTimeout(function() {
          queue.shift();
          processSyncQueue(queue);
        }, 1200);
      }
    }

    function failSync(queue) {
      localStorage.setItem('gas_offline_queue', JSON.stringify(queue));
      Swal.fire({
        icon: 'warning',
        title: 'Sinkronisasi Ditunda',
        text: 'Internet terputus saat sinkronisasi. Antrean disimpan kembali dan dicoba saat jaringan stabil.',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-3xl' }
      });
    }

    function handleOfflineQueueSubmission(type, payload) {
      let queue = JSON.parse(localStorage.getItem('gas_offline_queue') || '[]');
      queue.push({
        id: 'gas-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        type: type,
        payload: payload
      });
      localStorage.setItem('gas_offline_queue', JSON.stringify(queue));

      Swal.fire({
        icon: 'warning',
        title: 'Koneksi Offline - Antrean Lokal',
        html: '<div class="text-left py-1 text-sm text-slate-600 leading-relaxed">' +
              '<p>Anda sedang offline atau jaringan terganggu. Absensi atas nama <b>' + payload.nama + '</b> aman disimpan dalam penyimpanan lokal perangkat Anda.</p>' +
              '<p class="mt-2 text-xs font-bold text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-100 flex items-center gap-1.5">' +
              '<i class="fa-solid fa-cloud-arrow-up text-amber-500 text-sm animate-bounce"></i> ' +
              'Akan disinkronkan otomatis segera saat internet aktif kembali!' +
              '</p>' +
              '</div>',
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'PAHAM',
        customClass: { popup: 'rounded-3xl' }
      });
    }

    // Jalankan service saat halaman selesai dimuat
    window.addEventListener('DOMContentLoaded', () => {
      startClock();
      requestGeolocation();
    });
  </script>
</body>
</html>
`;
