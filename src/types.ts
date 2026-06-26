/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa' | 'Terlambat';

export interface StudentAttendance {
  timestamp: string;
  nis: string;
  nama: string;
  kelas: string;
  status: AttendanceStatus;
  keterangan: string;
  catatan?: string;
  latitude: number | null;
  longitude: number | null;
  jarak?: number; // Distance in meters from school
  isWithinRadius?: boolean;
  isManualOverride?: boolean;
}

export interface TeacherAttendance {
  timestamp: string;
  nip: string;
  nama: string;
  jabatan: string;
  status: AttendanceStatus;
  keterangan: string;
  catatan?: string;
  latitude: number | null;
  longitude: number | null;
  jarak?: number; // Distance in meters from school
  isWithinRadius?: boolean;
  isManualOverride?: boolean;
}

export interface GymLocation {
  latitude: number;
  longitude: number;
  name: string;
}

export interface SimulatedRecord {
  id: string;
  timestamp: string;
  type: 'murid' | 'guru';
  data: StudentAttendance | TeacherAttendance;
}
