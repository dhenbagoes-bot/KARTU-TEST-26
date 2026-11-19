export type Peran = 'Admin' | 'Guru' | 'Siswa' | 'Pegawai' | 'Operator';

export const DAFTAR_PERAN: Peran[] = ['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'];

/** Peran yang dihitung sebagai "guru" di dashboard. */
export const PERAN_GURU: Peran[] = ['Guru'];

export interface DesainKartu {
  warnaUtama: string;
  warnaKedua: string;
  warnaAksen: string;
  warnaTeks: string;
  gradasi: string;
  fontKeluarga: string;
  ukuranTeks: number; // skala 0.8 - 1.3
  orientasi: 'landscape' | 'portrait';
  posisiLogo: 'kiri' | 'kanan' | 'tengah' | 'sembunyi';
  posisiFoto: 'kiri' | 'kanan';
  tampilId: boolean;
  tampilRole: boolean;
  tampilKelas: boolean;
  tampilLogo: boolean;
  bingkai: boolean;
  ornamen: boolean;
}

export const DESAIN_DEFAULT: DesainKartu = {
  warnaUtama: '#047857',
  warnaKedua: '#065f46',
  warnaAksen: '#d4af37',
  warnaTeks: '#ffffff',
  gradasi: 'linear-gradient(135deg,#059669 0%,#047857 55%,#064e3b 100%)',
  fontKeluarga: 'system-ui',
  ukuranTeks: 1,
  orientasi: 'landscape',
  posisiLogo: 'kiri',
  posisiFoto: 'kiri',
  tampilId: true,
  tampilRole: true,
  tampilKelas: true,
  tampilLogo: true,
  bingkai: true,
  ornamen: true,
};

export const PRESET_DESAIN: { nama: string; desain: Partial<DesainKartu> }[] = [
  { nama: 'Emerald Gold', desain: { warnaUtama: '#047857', warnaKedua: '#065f46', warnaAksen: '#d4af37', warnaTeks: '#ffffff', gradasi: 'linear-gradient(135deg,#059669 0%,#047857 55%,#064e3b 100%)' } },
  { nama: 'Hijau Putih', desain: { warnaUtama: '#15803d', warnaKedua: '#166534', warnaAksen: '#d4af37', warnaTeks: '#14532d', gradasi: 'linear-gradient(135deg,#ffffff 0%,#dcfce7 60%,#bbf7d0 100%)' } },
  { nama: 'Emas Elegan', desain: { warnaUtama: '#78350f', warnaKedua: '#451a03', warnaAksen: '#f59e0b', warnaTeks: '#ffffff', gradasi: 'linear-gradient(135deg,#b45309 0%,#78350f 60%,#451a03 100%)' } },
  { nama: 'Minimalis Gelap', desain: { warnaUtama: '#1f2937', warnaKedua: '#111827', warnaAksen: '#059669', warnaTeks: '#ffffff', gradasi: 'linear-gradient(135deg,#374151 0%,#1f2937 100%)' } },
];

export interface TemplateKartu {
  id: string;
  nama: string;
  roleTarget: string; // 'Semua' atau salah satu Peran
  desain: DesainKartu;
  isDefault: boolean;
  dibuatPada: string;
  diubahPada: string;
}

export function templateBawaan(): TemplateKartu[] {
  const kini = new Date().toISOString();
  return [
    { id: 'tmpl-siswa', nama: 'Kartu Siswa', roleTarget: 'Siswa', desain: { ...DESAIN_DEFAULT }, isDefault: true, dibuatPada: kini, diubahPada: kini },
    { id: 'tmpl-guru', nama: 'Kartu Guru', roleTarget: 'Guru', desain: { ...DESAIN_DEFAULT, ...PRESET_DESAIN[2].desain }, isDefault: true, dibuatPada: kini, diubahPada: kini },
    { id: 'tmpl-pegawai', nama: 'Kartu Pegawai', roleTarget: 'Pegawai', desain: { ...DESAIN_DEFAULT, ...PRESET_DESAIN[3].desain }, isDefault: true, dibuatPada: kini, diubahPada: kini },
  ];
}

export function parseDesain(json: string | null | undefined): DesainKartu {
  if (!json) return { ...DESAIN_DEFAULT };
  try {
    return { ...DESAIN_DEFAULT, ...(JSON.parse(json) as Partial<DesainKartu>) };
  } catch {
    return { ...DESAIN_DEFAULT };
  }
}

export interface Pengaturan {
  namaInstansi: string;
  alamatInstansi: string;
  teleponInstansi: string;
  kepalaInstansi: string;
  tahun: string;
  logoUrl: string;
  [key: string]: string;
}

export interface PenggunaData {
  id: string;
  nama: string;
  username: string;
  role: Peran | string;
  kelas: string;
  fotoUrl: string;
  status: string;
  dicetak: number;
  dibuatPada: string;
  diubahPada: string;
}

export interface LogItem {
  id: string;
  waktu: string;
  username: string;
  aksi: string;
  detail: string;
}

export interface AllData {
  pengaturan: Pengaturan;
  pengguna: PenggunaData[];
  templates: TemplateKartu[];
  log: LogItem[];
  version: string;
}

export interface UserSesi {
  nama: string;
  username: string;
  peran: Peran | string;
  id?: string;
}

export const APP_VERSION = '1.0.1';
