import type { DesainKartu, Pengaturan, PenggunaData } from '../types';

/**
 * Satu kartu identitas 85 x 55 mm (landscape) atau 55 x 85 mm (portrait).
 * Ukuran memakai mm persis agar hasil cetak akurat; skala teks mengikuti
 * desain.ukuranTeks. Foto default: inisial nama di lingkaran, bukan foto orang lain.
 */
export function Kartu({ user, desain, pengaturan }: { user: PenggunaData; desain: DesainKartu; pengaturan: Pengaturan }) {
  const landscape = desain.orientasi === 'landscape';
  const w = landscape ? '85mm' : '55mm';
  const h = landscape ? '55mm' : '85mm';
  const s = desain.ukuranTeks;
  const namaInstansi = pengaturan.namaInstansi || 'Nama Instansi';
  const inisial = (user.nama || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const foto = user.fotoUrl ? (
    <img src={user.fotoUrl} alt={user.nama} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-white font-black" style={{ background: desain.warnaKedua, fontSize: `${7 * s}mm` }}>{inisial}</div>
  );
  const logo = desain.tampilLogo && pengaturan.logoUrl ? (
    <img src={pengaturan.logoUrl} alt="Logo" className="object-contain" style={{ width: `${8 * s}mm`, height: `${8 * s}mm` }} />
  ) : null;

  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{
        width: w, height: h, background: desain.gradasi, color: desain.warnaTeks,
        fontFamily: desain.fontKeluarga === 'serif' ? 'Georgia, serif' : desain.fontKeluarga === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif',
        border: desain.bingkai ? `0.6mm solid ${desain.warnaAksen}` : 'none',
        borderRadius: '2mm',
      }}
    >
      {desain.ornamen && <div className="absolute -right-3 -bottom-5 w-16 h-16 rounded-full opacity-20" style={{ background: desain.warnaAksen }} />}
      <div className={`h-full flex ${landscape ? 'flex-col' : 'flex-col'} p-[3mm] gap-[1.5mm]`}>
        <div className="flex items-center gap-[2mm]">
          {desain.posisiLogo === 'kiri' && logo}
          <div className={`flex-1 min-w-0 ${desain.posisiLogo === 'tengah' ? 'text-center' : ''}`}>
            <div className="font-black leading-tight truncate" style={{ fontSize: `${3.6 * s}mm` }}>{namaInstansi}</div>
            <div className="opacity-80 leading-tight truncate" style={{ fontSize: `${2.4 * s}mm` }}>{pengaturan.alamatInstansi || 'Alamat instansi'}</div>
          </div>
          {desain.posisiLogo === 'kanan' && logo}
        </div>
        <div className="h-[0.4mm] w-full" style={{ background: desain.warnaAksen }} />
        <div className={`flex-1 flex gap-[2.5mm] min-h-0 ${desain.posisiFoto === 'kanan' ? 'flex-row-reverse' : ''}`}>
          <div className="shrink-0 rounded overflow-hidden border border-white/40" style={{ width: landscape ? '20mm' : '18mm', height: landscape ? '26mm' : '24mm' }}>{foto}</div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-[0.8mm]">
            <div className="font-black leading-tight break-words" style={{ fontSize: `${4 * s}mm` }}>{user.nama}</div>
            {desain.tampilId && <div style={{ fontSize: `${2.8 * s}mm` }}>ID: {user.id}</div>}
            <div style={{ fontSize: `${2.8 * s}mm` }}>@{user.username}</div>
            {desain.tampilRole && <div style={{ fontSize: `${2.8 * s}mm` }}>{user.role}</div>}
            {desain.tampilKelas && user.kelas && <div style={{ fontSize: `${2.8 * s}mm` }}>Kelas: {user.kelas}</div>}
          </div>
        </div>
        <div className="flex items-center justify-between opacity-80" style={{ fontSize: `${2.3 * s}mm` }}>
          <span>KARTU IDENTITAS</span>
          <span>{pengaturan.tahun || ''}</span>
        </div>
      </div>
    </div>
  );
}
