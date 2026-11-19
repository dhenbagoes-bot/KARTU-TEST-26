import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Btn, Card, Pesan } from '../components/ui';
import { importPengguna } from '../services/api';
import { bacaFileImpor, unduhTemplatePengguna } from '../utils/excel';
import type { BarisImporPengguna } from '../utils/logika';
import type { PageProps } from './PageProps';

export default function ImporExcel({ data, refresh, setPesanGlobal }: PageProps) {
  const [baris, setBaris] = useState<BarisImporPengguna[]>([]);
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const usernameAda = new Set(data.pengguna.map((u) => u.username.toLowerCase()));
      const hasil = await bacaFileImpor(f, usernameAda);
      setBaris(hasil);
      const valid = hasil.filter((b) => b.masalah.length === 0).length;
      setPesan(`${hasil.length} baris dibaca: ${valid} valid, ${hasil.length - valid} bermasalah. Periksa pratinjau, lalu klik Simpan.`);
      setJenis('info');
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal membaca file Excel.'); setJenis('error');
    }
  }

  const valid = baris.filter((b) => b.masalah.length === 0);

  async function simpan() {
    if (!valid.length) { setPesan('Tidak ada baris valid untuk disimpan.'); setJenis('error'); return; }
    setSibuk(true);
    try {
      const hasil = await importPengguna(valid.map((b) => ({ nama: b.nama, username: b.username, password: b.password, role: b.role, kelas: b.kelas, id: b.id || undefined })));
      setPesan(`Impor selesai: ${hasil.ditambah} ditambahkan, ${hasil.dilewati.length} dilewati. ${hasil.dilewati.map((d) => `${d.nama}: ${d.alasan}`).join(' ')}`);
      setJenis(hasil.dilewati.length ? 'error' : 'sukses');
      setPesanGlobal(`Impor Excel: ${hasil.ditambah} ditambahkan, ${hasil.dilewati.length} dilewati.`, hasil.dilewati.length ? 'error' : 'sukses');
      setBaris([]);
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Impor gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title="Impor Excel — Data Pengguna Massal">
        <Pesan teks={pesan} jenis={jenis} />
        <p className="text-sm text-slate-600 mb-3">
          Masukkan ratusan data sekaligus tanpa mengetik satu per satu. Unduh template, isi kolom
          <b> Nama | Username | Password | Role | Kelas | ID</b> (ID boleh kosong — dibuat otomatis KID-0001, dst),
          lalu unggah. Username duplikat dilewati &amp; dilaporkan; data lama <b>tidak dihapus dan tidak ditimpa</b>.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <Btn warna="putih" onClick={unduhTemplatePengguna}><span className="inline-flex items-center gap-1"><Download size={15} /> Unduh Template .xlsx</span></Btn>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={pilihFile} />
          <Btn onClick={() => inputRef.current?.click()}><span className="inline-flex items-center gap-1"><FileSpreadsheet size={15} /> Pilih File Excel</span></Btn>
          <Btn warna="emas" disabled={!valid.length || sibuk} onClick={() => void simpan()}>
            <span className="inline-flex items-center gap-1"><Upload size={15} /> Simpan {valid.length} Baris Valid</span>
          </Btn>
        </div>
        {baris.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Nama</th><th className="py-2 pr-2">Username</th>
                  <th className="py-2 pr-2">Role</th><th className="py-2 pr-2">Kelas</th><th className="py-2 pr-2">ID</th><th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${b.masalah.length ? 'bg-red-50' : ''}`}>
                    <td className="py-2 pr-2">{i + 1}</td>
                    <td className="py-2 pr-2 font-semibold">{b.nama}</td>
                    <td className="py-2 pr-2">@{b.username}</td>
                    <td className="py-2 pr-2">{b.role}</td>
                    <td className="py-2 pr-2">{b.kelas || '-'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{b.id || '(otomatis)'}</td>
                    <td className="py-2 text-xs">{b.masalah.length ? <span className="text-red-700">{b.masalah.join('; ')}</span> : <span className="text-emerald-700 font-semibold">Valid</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
