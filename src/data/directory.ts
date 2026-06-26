/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RegisteredMember {
  id: string; // NISN or NIP
  name: string;
  role: 'admin' | 'piket' | 'murid' | 'guru';
  detail: string; // Kelas/Rombel for murid, Jabatan for guru
  password?: string;
}

export const registeredMembers: RegisteredMember[] = [
  // Admin & Piket
  { id: 'admin', name: 'Super Admin SIAKAD', role: 'admin', detail: 'Kepala Sekolah / Admin Utama', password: 'admin' },
  { id: 'piket', name: 'Staf Piket Tutwuri', role: 'piket', detail: 'Guru Piket Harian', password: 'piket' },

  // Murid (Students) - NISN
  { id: '12998374', name: 'Muhammad Fadli', role: 'murid', detail: '12-A', password: 'password123' },
  { id: '12998375', name: 'Siti Rahmawati', role: 'murid', detail: '10-B', password: 'password123' },
  { id: '12998500', name: 'Rian Hidayat', role: 'murid', detail: '11-B', password: 'password123' },
  { id: '12998501', name: 'Zaskia Putri Amanda', role: 'murid', detail: '10-A', password: 'password123' },
  { id: '12998502', name: 'Andi Wijaya Pratama', role: 'murid', detail: '11-A', password: 'password123' },
  { id: '12998503', name: 'Dewi Lestari Kusuma', role: 'murid', detail: '12-B', password: 'password123' },
  { id: '12998504', name: 'Budi Santoso Purba', role: 'murid', detail: '10-C', password: 'password123' },
  { id: '12998505', name: 'Lia Ananda Saputri', role: 'murid', detail: '11-B', password: 'password123' },
  { id: '12998506', name: 'Fajar Ramadhan', role: 'murid', detail: '12-A', password: 'password123' },
  { id: '12998507', name: 'Nabila Syakieb', role: 'murid', detail: '10-C', password: 'password123' },

  // Guru (Teachers) - NIP
  { id: '19780512', name: 'Drs. Bambang Wijaya, M.Pd.', role: 'guru', detail: 'Guru Kimia / Kepala TU', password: 'guru' },
  { id: '19821104', name: 'Abdul Rahman, M.Kom', role: 'guru', detail: 'Guru Informatika / Wali Kelas 12-A', password: 'guru' },
  { id: '19850320', name: 'Siti Aminah, S.Pd.', role: 'guru', detail: 'Guru Bahasa Indonesia / Wali Kelas 10-A', password: 'guru' },
  { id: '19750810', name: 'Eko Prasetyo, M.Si.', role: 'guru', detail: 'Guru Fisika / Wakasek', password: 'guru' },
  { id: '19880115', name: 'Rina Kartika, S.Si.', role: 'guru', detail: 'Guru Biologi', password: 'guru' },
  { id: '19920405', name: 'Hendra Wijaya, S.Pd.', role: 'guru', detail: 'Guru Matematika', password: 'guru' },
];

/**
 * Generates high-fidelity historical backup data for multiple months
 * so the user can see beautiful monthly attendance distributions immediately.
 */
export function generateMonthlyMockData(): {
  id: string;
  timestamp: string;
  type: 'murid' | 'guru';
  data: any;
}[] {
  const records: any[] = [];
  const currentYear = 2026;
  
  // Generating data for Jan (0), Feb (1), Mar (2), Apr (3), Mei (4), Jun (5)
  const monthlyRates: Record<number, { hadir: number; sakit: number; izin: number }> = {
    0: { hadir: 94, sakit: 4, izin: 2 }, // Jan
    1: { hadir: 91, sakit: 6, izin: 3 }, // Feb
    2: { hadir: 89, sakit: 7, izin: 4 }, // Mar
    3: { hadir: 95, sakit: 3, izin: 2 }, // Apr
    4: { hadir: 92, sakit: 5, izin: 3 }, // Mei
    5: { hadir: 96, sakit: 2, izin: 2 }, // Jun
  };

  let idCounter = 1;

  for (const month of [0, 1, 2, 3, 4, 5]) {
    const rate = monthlyRates[month];
    const daysInMonth = month === 1 ? 28 : 30; // simple simplified days

    // Pick 3 random students and 2 random teachers to have historical records in each month
    const studentsToAbes = registeredMembers.filter(m => m.role === 'murid').slice(0, 5);
    const teachersToAbes = registeredMembers.filter(m => m.role === 'guru').slice(0, 3);

    for (let day = 1; day <= daysInMonth; day += 2) { // alternate days for compact database size
      const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T07:${String(Math.floor(Math.random() * 20) + 10).padStart(2, '0')}:00.000Z`;

      // Assign student attendance based on target rates
      studentsToAbes.forEach(student => {
        const roll = Math.random() * 100;
        let status: 'Hadir' | 'Sakit' | 'Izin' = 'Hadir';
        let keterangan = '-';

        if (roll > rate.hadir + rate.sakit) {
          status = 'Izin';
          keterangan = 'Keperluan Keluarga';
        } else if (roll > rate.hadir) {
          status = 'Sakit';
          keterangan = 'Demam / Flu';
        }

        records.push({
          id: `hist-${idCounter++}`,
          timestamp: dateStr,
          type: 'murid',
          data: {
            timestamp: dateStr,
            nis: student.id,
            nama: student.name,
            kelas: student.detail,
            status,
            keterangan,
            latitude: -6.168480,
            longitude: 106.833150,
            jarak: 15,
            isWithinRadius: true,
          }
        });
      });

      // Assign teacher attendance
      teachersToAbes.forEach(teacher => {
        const roll = Math.random() * 100;
        let status: 'Hadir' | 'Sakit' | 'Izin' = 'Hadir';
        let keterangan = '-';

        if (roll > rate.hadir + rate.sakit) {
          status = 'Izin';
          keterangan = 'Izin Dinas Luar';
        } else if (roll > rate.hadir) {
          status = 'Sakit';
          keterangan = 'Sakit Kepala';
        }

        records.push({
          id: `hist-${idCounter++}`,
          timestamp: dateStr,
          type: 'guru',
          data: {
            timestamp: dateStr,
            nip: teacher.id,
            nama: teacher.name,
            jabatan: teacher.detail,
            status,
            keterangan,
            latitude: -6.168480,
            longitude: 106.833150,
            jarak: 15,
            isWithinRadius: true,
          }
        });
      });
    }
  }

  return records;
}
