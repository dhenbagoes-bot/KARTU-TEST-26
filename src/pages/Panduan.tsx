import { Card } from '../components/ui';

export default function Panduan() {
  return (
    <div>
      <Card title="Panduan Penggunaan — Kartu Identitas v1.0.0">
        <div className="text-sm space-y-4 text-slate-700">
          <section>
            <h3 className="font-bold text-slate-800 mb-1">1. Penyiapan pertama (sekali saja)</h3>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Buat Google Spreadsheet baru, lalu dari DALAM spreadsheet: <b>Extensions → Apps Script</b> (jangan dari script.google.com — script harus container-bound).</li>
              <li>Paste isi <code>backend/Kode.gs</code>, ganti <code>appsscript.json</code> dengan file dari repo, jalankan <code>authorizeDriveAccess</code> sekali, lalu <b>Deploy → New deployment → Web app</b> (Execute as Me, akses Anyone).</li>
              <li>Tempel URL <code>/exec</code> di menu <b>Konfigurasi</b>, klik <b>Uji Koneksi</b>, lalu <b>Inisialisasi Database</b>.</li>
              <li>Login dengan akun bawaan, lalu <b>SEGERA ganti kata sandi</b> (menu Data Pengguna → edit akun admin/operator → isi password baru). Jangan biarkan kata sandi bawaan aktif.</li>
              <li>Isi identitas instansi &amp; unggah logo di menu Konfigurasi.</li>
            </ol>
          </section>
          <section>
            <h3 className="font-bold text-slate-800 mb-1">2. Hak akses peran</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li><b>Admin</b>: akses penuh — kelola data, template, konfigurasi, backup/restore, hapus pengguna.</li>
              <li><b>Guru / Pegawai / Operator</b>: kelola data pengguna &amp; cetak kartu (tidak bisa hapus pengguna, tidak bisa buka Konfigurasi/Backup).</li>
              <li><b>Siswa</b>: hanya melihat data &amp; mencetak kartunya sendiri.</li>
            </ul>
          </section>
          <section>
            <h3 className="font-bold text-slate-800 mb-1">3. Mengisi data massal</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li><b>Impor Excel</b>: unduh template, isi Nama | Username | Password | Role | Kelas | ID, unggah, periksa pratinjau, simpan baris valid. Username = Nama Lengkap (boleh berisi spasi); bila Username dikosongkan, otomatis diisi dari Nama. Password boleh dikosongkan — dibuat acak dan ditampilkan sekali di pratinjau/hasil impor. Username duplikat dilewati.</li>
              <li><b>Upload Foto Massal</b>: nama file harus sama dengan username atau ID (mis. <code>Budi Santoso.jpg</code>, <code>KID-0001.png</code>). Periksa pratinjau &amp; pasangan sebelum memproses. Foto lama tidak ditimpa kecuali mode timpa diaktifkan.</li>
            </ul>
          </section>
          <section>
            <h3 className="font-bold text-slate-800 mb-1">4. Template &amp; cetak kartu</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Buat beberapa template di <b>Desain Kartu</b> (mis. Kartu Siswa, Kartu Guru, Kartu Pegawai). Template default per role otomatis dipakai saat cetak.</li>
              <li>Di <b>Cetak Kartu</b>: filter per kelas/role, ceklis pengguna, atur kolom × baris per lembar A4, lalu <b>Cetak / Simpan PDF</b>. Di dialog cetak pilih <i>Save as PDF</i>, skala 100%, aktifkan <i>Background graphics</i>.</li>
              <li>Setelah mencetak, klik <b>Tandai Sudah Dicetak</b> agar status tercatat.</li>
            </ul>
          </section>
          <section>
            <h3 className="font-bold text-slate-800 mb-1">5. Keamanan &amp; penyimpanan</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Password disimpan sebagai hash SHA-256 + garam di Google Sheets — tidak pernah plaintext dan tidak pernah dikirim ke frontend.</li>
              <li>Data tersimpan di Google Sheets (cloud), bukan localStorage. Yang tersimpan di browser hanya URL backend &amp; token sesi (7 hari).</li>
              <li>Unduh backup JSON berkala di menu <b>Backup &amp; Restore</b>.</li>
            </ul>
          </section>
        </div>
      </Card>
    </div>
  );
}
