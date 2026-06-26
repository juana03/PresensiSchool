import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { SimulatedRecord, StudentAttendance, TeacherAttendance, AttendanceStatus } from '../types';

// Reuse or initialize the app
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Add required Workspace scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

// Track active credentials
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // We have a firebase user but no access token. 
        // In a real app we might use a refresh token or a custom backend to get a new one.
        // For now, we signal failure to get the token so App can decide whether to prompt.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google OAuth.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_sheets_id');
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// --- GOOGLE DRIVE & SHEETS API COMMUNICATIONS ---

export const findOrCreateSpreadsheet = async (accessToken: string): Promise<string> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') {
    return 'MOCK_LOCAL_SPREADSHEET';
  }
  // First, check if spreadsheet ID is stored in localStorage to avoid redundant Drive API calls
  const storedId = localStorage.getItem('google_sheets_id');
  if (storedId) {
    try {
      // Validate that it still exists by fetching its title
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${storedId}?fields=spreadsheetId`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        return storedId;
      }
    } catch (e) {
      console.warn("Stored spreadsheet not valid, searching Drive...", e);
    }
  }

  // 1. Search Google Drive for Database Absensi Sekolah V2
  const query = encodeURIComponent("name = 'Database Absensi Sekolah V2' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  const driveRes = await fetch(driveUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!driveRes.ok) {
    throw new Error(`Google Drive API error (${driveRes.status}): ${driveRes.statusText}`);
  }

  const driveData = await driveRes.json();
  if (driveData.files && driveData.files.length > 0) {
    const sheetId = driveData.files[0].id;
    localStorage.setItem('google_sheets_id', sheetId);
    return sheetId;
  }

  // 2. Not found, create a new spreadsheet via Sheets API
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title: 'Database Absensi Sekolah V2' }
    })
  });

  if (!createRes.ok) {
    throw new Error(`Gagal membuat Spreadsheet (${createRes.status}): ${createRes.statusText}`);
  }

  const createData = await createRes.json();
  const newSheetId = createData.spreadsheetId;
  localStorage.setItem('google_sheets_id', newSheetId);

  // Initialize columns and tabs on the new Spreadsheet
  await ensureSheetsAndHeadersExist(newSheetId, accessToken);
  return newSheetId;
};

export const ensureSheetsAndHeadersExist = async (spreadsheetId: string, accessToken: string): Promise<void> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') return;
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) return;

  const metaData = await metaRes.json();
  const activeTabs: string[] = metaData.sheets.map((s: any) => s.properties.title);

  const reqs: any[] = [];
  const requiredSheets = ['Data_Murid', 'Data_Guru', 'Akun_Admin', 'Akun_Guru', 'Akun_Siswa', 'Akun_Piket'];

  for (const sName of requiredSheets) {
    if (!activeTabs.includes(sName)) {
      reqs.push({
        addSheet: {
          properties: { title: sName }
        }
      });
    }
  }

  // Execute sheet creation in batch if needed
  if (reqs.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: reqs })
    });
  }

  // Make sure headers are written to Sheet tabs
  const headersMurid = [
    'ID Record', 'NISN', 'Nama Siswa', 'Kelas', 'Waktu Presensi', 
    'Status', 'Keterangan', 'Latitude', 'Longitude', 'Jarak (Meter)', 
    'Dalam Radius', 'Manual Override'
  ];

  const headersGuru = [
    'ID Record', 'NIP', 'Nama Guru', 'Jabatan', 'Waktu Presensi', 
    'Status', 'Keterangan', 'Latitude', 'Longitude', 'Jarak (Meter)', 
    'Dalam Radius', 'Manual Override'
  ];

  const headersAkun = [
    'Username', 'Nama', 'Role', 'Password', 'Detail'
  ];

  // We write headers using values.update if they don't exist
  await writeHeadersIfEmpty(spreadsheetId, 'Data_Murid', headersMurid, accessToken);
  await writeHeadersIfEmpty(spreadsheetId, 'Data_Guru', headersGuru, accessToken);
  await writeHeadersIfEmpty(spreadsheetId, 'Akun_Admin', headersAkun, accessToken);
  await writeHeadersIfEmpty(spreadsheetId, 'Akun_Guru', headersAkun, accessToken);
  await writeHeadersIfEmpty(spreadsheetId, 'Akun_Siswa', headersAkun, accessToken);
  await writeHeadersIfEmpty(spreadsheetId, 'Akun_Piket', headersAkun, accessToken);
};

export const syncAccountsToSheet = async (spreadsheetId: string, accessToken: string, accounts: any[]) => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') return;
  
  // Categorize accounts by role to save to respective sheets
  const adminRows = accounts.filter(a => a.role === 'admin').map(a => [a.id, a.name, a.role, a.password || 'admin123', a.detail || '']);
  const guruRows = accounts.filter(a => a.role === 'guru').map(a => [a.id, a.name, a.role, a.password || 'guru123', a.detail || '']);
  const siswaRows = accounts.filter(a => a.role === 'murid').map(a => [a.id, a.name, a.role, a.password || 'siswa123', a.detail || '']);
  const piketRows = accounts.filter(a => a.role === 'piket').map(a => [a.id, a.name, a.role, a.password || 'piket123', a.detail || '']);

  const syncToSheet = async (sheetName: string, rows: any[][]) => {
    if (rows.length === 0) return;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  };

  await syncToSheet('Akun_Admin', adminRows);
  await syncToSheet('Akun_Guru', guruRows);
  await syncToSheet('Akun_Siswa', siswaRows);
  await syncToSheet('Akun_Piket', piketRows);
};

export const loadAccountsFromSheet = async (spreadsheetId: string, accessToken: string): Promise<any[]> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') return [];
  
  const allAccounts: any[] = [];
  const sheets = ['Akun_Admin', 'Akun_Guru', 'Akun_Siswa', 'Akun_Piket'];

  for (const sName of sheets) {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sName}!A2:E5000`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.values && data.values.length > 0) {
          data.values.forEach((r: any[]) => {
            allAccounts.push({
              id: r[0],
              name: r[1],
              role: r[2],
              password: r[3],
              detail: r[4]
            });
          });
        }
      }
    } catch (e) {
      console.error(`Gagal memuat akun dari ${sName}`, e);
    }
  }
  return allAccounts;
};

const writeHeadersIfEmpty = async (spreadsheetId: string, sheetName: string, headers: string[], accessToken: string) => {
  try {
    const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:L1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (valRes.ok) {
      const data = await valRes.json();
      if (data.values && data.values.length > 0) {
        return; // Headers already set
      }
    }

    // Set headers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:L1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [headers] })
    });
  } catch (e) {
    console.error("Gagal verifikasi header", e);
  }
};

export const appendRecordToUrl = async (spreadsheetId: string, record: SimulatedRecord, accessToken: string): Promise<boolean> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') {
    return true;
  }
  try {
    const isMurid = record.type === 'murid';
    const sheetName = isMurid ? 'Data_Murid' : 'Data_Guru';
    const data = record.data;

    const row = isMurid 
      ? [
          record.id,
          (data as StudentAttendance).nis,
          data.nama,
          (data as StudentAttendance).kelas,
          data.timestamp,
          data.status,
          data.keterangan,
          data.latitude !== null ? data.latitude : '',
          data.longitude !== null ? data.longitude : '',
          data.jarak !== undefined ? data.jarak : '',
          data.isWithinRadius !== undefined ? (data.isWithinRadius ? 'YA' : 'TIDAK') : '',
          data.isManualOverride !== undefined ? (data.isManualOverride ? 'YA' : 'TIDAK') : ''
        ]
      : [
          record.id,
          (data as TeacherAttendance).nip,
          data.nama,
          (data as TeacherAttendance).jabatan,
          data.timestamp,
          data.status,
          data.keterangan,
          data.latitude !== null ? data.latitude : '',
          data.longitude !== null ? data.longitude : '',
          data.jarak !== undefined ? data.jarak : '',
          data.isWithinRadius !== undefined ? (data.isWithinRadius ? 'YA' : 'TIDAK') : '',
          data.isManualOverride !== undefined ? (data.isManualOverride ? 'YA' : 'TIDAK') : ''
        ];

    const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    });

    return appendRes.ok;
  } catch (e) {
    console.error("Gagal menambahkan baris ke Google Sheets", e);
    return false;
  }
};

export const loadAllRecordsFromSheet = async (spreadsheetId: string, accessToken: string): Promise<SimulatedRecord[]> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') {
    const stored = localStorage.getItem('absensi_simulated_records_v2');
    return stored ? JSON.parse(stored) : [];
  }
  const records: SimulatedRecord[] = [];

  try {
    // 1. Fetch murid records
    const muridRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Data_Murid!A2:L2000`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (muridRes.ok) {
      const data = await muridRes.json();
      if (data.values && data.values.length > 0) {
        data.values.forEach((row: any[]) => {
          if (!row[0]) return;
          records.push({
            id: row[0],
            timestamp: row[4] || new Date().toISOString(),
            type: 'murid',
            data: {
              timestamp: row[4] || new Date().toISOString(),
              nis: row[1] || '',
              nama: row[2] || '',
              kelas: row[3] || '',
              status: (row[5] || 'Alpa') as AttendanceStatus,
              keterangan: row[6] || '-',
              latitude: row[7] ? Number(row[7]) : null,
              longitude: row[8] ? Number(row[8]) : null,
              jarak: row[9] ? Number(row[9]) : undefined,
              isWithinRadius: row[10] === 'YA',
              isManualOverride: row[11] === 'YA'
            }
          });
        });
      }
    }

    // 2. Fetch guru records
    const guruRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Data_Guru!A2:L2000`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (guruRes.ok) {
      const data = await guruRes.json();
      if (data.values && data.values.length > 0) {
        data.values.forEach((row: any[]) => {
          if (!row[0]) return;
          records.push({
            id: row[0],
            timestamp: row[4] || new Date().toISOString(),
            type: 'guru',
            data: {
              timestamp: row[4] || new Date().toISOString(),
              nip: row[1] || '',
              nama: row[2] || '',
              jabatan: row[3] || '',
              status: (row[5] || 'Alpa') as AttendanceStatus,
              keterangan: row[6] || '-',
              latitude: row[7] ? Number(row[7]) : null,
              longitude: row[8] ? Number(row[8]) : null,
              jarak: row[9] ? Number(row[9]) : undefined,
              isWithinRadius: row[10] === 'YA',
              isManualOverride: row[11] === 'YA'
            }
          });
        });
      }
    }
  } catch (e) {
    console.error("Gagal memuat data dari Spreadsheet", e);
  }

  // Sort chronologically desc
  return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const clearSpreadsheetRows = async (spreadsheetId: string, accessToken: string): Promise<boolean> => {
  if (accessToken === 'MOCK_LOCAL_TOKEN') {
    return true;
  }
  try {
    // Clear value ranges keeping the header intact
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Data_Murid!A2:L2000:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Data_Guru!A2:L2000:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return true;
  } catch (e) {
    console.error("Gagal mengosongkan Spreadsheet", e);
    return false;
  }
};
