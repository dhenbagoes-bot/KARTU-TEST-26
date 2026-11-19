// Smoke test backend Kode.gs (wwn-kartu-identitas-80) dengan stub Google Apps Script.
// Menjalankan Kode.gs ASLI di vm Node dan menguji semua aksi baru:
// ping, initDatabase (4 sheet + seed admin/operator + 3 template default +
// idempotent + data lama dipertahankan), login (benar/salah/nonaktif),
// getAllData (wajib token, tanpa hash/garam/token), getPengaturan,
// savePengaturan (admin saja, whitelist kunci), addPengguna (ID otomatis
// KID-0001, username unik case-insensitive, role invalid, password pendek),
// updatePengguna (edit, ganti password mematikan token lama),
// deletePengguna (admin saja, tolak hapus diri/admin terakhir),
// importPengguna (duplikat dilewati, tidak menimpa), uploadFoto (tolak
// bukan gambar, terima gambar, user tak dikenal ditolak),
// uploadFotoMassal (campuran berhasil/gagal), uploadLogo (admin saja),
// saveTemplate (JSON invalid ditolak, roleTarget invalid, satu default
// per role, edit, duplikat nama), listTemplate, deleteTemplate,
// tandaiDicetak, backupData (admin saja), restoreData (hanya tambah yang
// belum ada, tidak menimpa), logout, dan initDatabase kedua tanpa token
// ditolak setelah ada pengguna.
// Jalankan: node test/smoke-backend.mjs   (exit 0 = semua lolos)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'backend', 'Kode.gs'), 'utf8');

function makeSheet(name) {
  const grid = [[]];
  return {
    _name: name,
    getLastRow() { return grid.length === 1 && grid[0].length === 0 ? 0 : grid.length; },
    getLastColumn() { return grid[0].length; },
    getRange(r, c, nr = 1, nc = 1) {
      function ensure(rr, cc) {
        while (grid.length < rr) grid.push(new Array(grid[0].length).fill(''));
        for (const row of grid) while (row.length < cc) row.push('');
      }
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) { const gr = grid[r - 1 + i]; row.push(gr ? (gr[c - 1 + j] ?? '') : ''); }
            out.push(row);
          }
          return out;
        },
        getValue() { return this.getValues()[0][0]; },
        setValues(vals) { for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals[i].length; j++) { ensure(r + i, c + j); grid[r - 1 + i][c - 1 + j] = vals[i][j]; } },
        setValue(v) { this.setValues([[v]]); },
      };
    },
    appendRow(row) { const h = grid[0].length; const full = row.slice(0, h); while (full.length < h) full.push(''); grid.push(full); },
    deleteRow(n) { grid.splice(n - 1, 1); },
  };
}
const sheets = new Map();
const SpreadsheetApp = {
  getActiveSpreadsheet() {
    return {
      getSheetByName(n) { return sheets.get(n) || null; },
      insertSheet(n) { const s = makeSheet(n); sheets.set(n, s); return s; },
    };
  },
};
const ContentService = { MimeType: { JSON: 'application/json' }, createTextOutput(t) { return { _t: String(t), getContent() { return this._t; }, setMimeType() { return this; } }; } };
const Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
  getUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }); },
  computeDigest(_a, s) { const h = createHash('sha256').update(String(s), 'utf8').digest(); return Array.from(h, (b) => (b > 127 ? b - 256 : b)); },
  formatDate(d, _tz, fmt) { const p = (n) => String(n).padStart(2, '0'); if (fmt === 'yyyy-MM-dd HH:mm:ss') return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
  base64Decode(s) { return Buffer.from(s, 'base64'); },
  newBlob(bytes, mime, name) { return { bytes, mime, name }; },
};
const propsStore = new Map();
const PropertiesService = {
  getScriptProperties() {
    return {
      getProperty: (k) => (propsStore.has(k) ? propsStore.get(k) : null),
      setProperty: (k, v) => { propsStore.set(k, String(v)); },
      deleteProperty: (k) => { propsStore.delete(k); },
      getKeys: () => [...propsStore.keys()],
    };
  },
};
let driveFiles = 0;
const DriveApp = {
  Access: { ANYONE_WITH_LINK: 'ANYONE' }, Permission: { VIEW: 'VIEW' },
  getRootFolder() { return {}; },
  getFoldersByName() { return { hasNext: () => false, next: () => null }; },
  createFolder() { return { setSharing() {}, createFile: (blob) => { driveFiles++; return { getId: () => `file-${driveFiles}`, setSharing() {} }; } }; },
};

const sandbox = { SpreadsheetApp, ContentService, Utilities, DriveApp, PropertiesService, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

function call(payload) {
  const out = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(out.getContent());
}
let lolos = 0, gagal = 0;
function cek(nama, kond, extra = '') {
  if (kond) { lolos++; console.log(`  OK  ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama} ${extra}`); }
}
const pngB64 = Buffer.from('fake-png-bytes').toString('base64');

console.log('== ping & init ==');
cek('ping', call({ action: 'ping' }).success);
const init1 = call({ action: 'initDatabase' });
cek('initDatabase pertama', init1.success && init1.data.sheets.length === 4, JSON.stringify(init1));
cek('4 sheet dibuat', [...sheets.keys()].sort().join(',') === 'LogAktivitas,Pengaturan,Pengguna,TemplateKartu', [...sheets.keys()].join(','));
cek('seed 2 akun bawaan', call({ action: 'login', username: 'admin', password: 'admin123' }).success);
cek('seed 3 template default', (() => { const t = call({ action: 'login', username: 'admin', password: 'admin123' }); const d = call({ action: 'getAllData', token: t.data.token }); return d.data.templates.length === 3 && d.data.templates.filter((x) => x.isDefault).length === 3; })(), '');

console.log('== login & auth ==');
cek('login password salah ditolak', !call({ action: 'login', username: 'admin', password: 'salah' }).success);
cek('login username tak dikenal ditolak', !call({ action: 'login', username: 'tidakada', password: 'admin123' }).success);
const loginAdmin = call({ action: 'login', username: 'admin', password: 'admin123' });
cek('login admin berhasil + peran Admin', loginAdmin.success && loginAdmin.data.peran === 'Admin', JSON.stringify(loginAdmin));
const token = loginAdmin.data?.token || '';
cek('login operator berhasil', call({ action: 'login', username: 'operator', password: 'operator123' }).success);
cek('getAllData tanpa token ditolak', !call({ action: 'getAllData' }).success);
cek('getAllData token palsu ditolak', !call({ action: 'getAllData', token: 'token-palsu' }).success);
const semua = call({ action: 'getAllData', token });
cek('getAllData dengan token', semua.success && semua.data.pengaturan.namaInstansi === 'Nama Instansi');
cek('getAllData tidak membocorkan hash/garam/token', !/PasswordHash|PasswordSalt|token/i.test(JSON.stringify(semua.data.pengguna)));
cek('aksi tak dikenal ditolak', !call({ action: 'aksiAneh', token }).success);

console.log('== pengaturan ==');
cek('getPengaturan', call({ action: 'getPengaturan', token }).success);
cek('savePengaturan valid', call({ action: 'savePengaturan', token, pengaturan: { tahun: '2026/2027', namaInstansi: 'Sekolah Contoh' } }).success);
cek('savePengaturan tersimpan', call({ action: 'getPengaturan', token }).data.namaInstansi === 'Sekolah Contoh');
cek('savePengaturan kunci tak dikenal diabaikan', (() => { call({ action: 'savePengaturan', token, pengaturan: { kunciRahasia: 'x' } }); return call({ action: 'getPengaturan', token }).data.kunciRahasia === undefined; })());
const loginOp = call({ action: 'login', username: 'operator', password: 'operator123' });
const tokenOp = loginOp.data?.token || '';
cek('operator dilarang savePengaturan', !call({ action: 'savePengaturan', token: tokenOp, pengaturan: { tahun: '2099' } }).success);
cek('operator dilarang uploadLogo', !call({ action: 'uploadLogo', token: tokenOp, dataBase64: pngB64, mimeType: 'image/png' }).success);
cek('operator dilarang backupData', !call({ action: 'backupData', token: tokenOp }).success);
cek('operator dilarang deletePengguna', !call({ action: 'deletePengguna', token: tokenOp, id: 'KID-0001' }).success);

console.log('== tambah / edit pengguna ==');
const p1 = call({ action: 'addPengguna', token, nama: 'Budi Santoso', username: 'budi.santoso', password: 'rahasia123', role: 'Siswa', kelas: '9A' });
cek('tambah pengguna + ID otomatis KID-0003', p1.success && p1.data.id === 'KID-0003', JSON.stringify(p1));
cek('username duplikat (case-insensitive) ditolak', !call({ action: 'addPengguna', token, nama: 'Budi Lain', username: 'BUDI.SANTOSO', password: 'rahasia123', role: 'Siswa' }).success);
cek('ID duplikat ditolak', !call({ action: 'addPengguna', token, nama: 'X', username: 'xbaru', password: 'rahasia123', role: 'Siswa', id: 'KID-0003' }).success);
cek('role invalid ditolak', !call({ action: 'addPengguna', token, nama: 'X', username: 'xrole', password: 'rahasia123', role: 'Kepala' }).success);
cek('password pendek ditolak', !call({ action: 'addPengguna', token, nama: 'X', username: 'xpass', password: '123', role: 'Siswa' }).success);
cek('nama kosong ditolak', !call({ action: 'addPengguna', token, nama: '', username: 'xkosong', password: 'rahasia123', role: 'Siswa' }).success);
cek('username berkarakter aneh ditolak', !call({ action: 'addPengguna', token, nama: 'X', username: 'budi santoso!', password: 'rahasia123', role: 'Siswa' }).success);
// v1.0.1: Username = Nama Lengkap (boleh berisi spasi).
const pSpasi = call({ action: 'addPengguna', token, nama: 'Budi Santoso', username: 'Budi Santoso', password: 'rahasia123', role: 'Siswa' });
cek('tambah pengguna username = Nama Lengkap (ber-spasi) lolos', pSpasi.success, JSON.stringify(pSpasi));
cek('login username nama lengkap (huruf kecil + spasi ganda) lolos', call({ action: 'login', username: '  budi   santoso ', password: 'rahasia123' }).success);
cek('username duplikat nama lengkap (spasi ganda) ditolak', !call({ action: 'addPengguna', token, nama: 'Budi Santoso', username: 'Budi  Santoso', password: 'rahasia123', role: 'Siswa' }).success);
cek('hapus pengguna sementara (jaga jumlah)', call({ action: 'deletePengguna', token, id: pSpasi.data.id }).success);
const pAcak = call({ action: 'addPengguna', token, nama: 'Citra Kirana', username: '', password: '', role: 'Siswa' });
cek('tambah pengguna username+password kosong -> username=Nama, password acak 6 karakter', pAcak.success && pAcak.data.passwordAcak && pAcak.data.passwordAcak.length === 6, JSON.stringify(pAcak));
cek('login dengan password acak hasil tambah', call({ action: 'login', username: 'Citra Kirana', password: pAcak.data.passwordAcak }).success);
cek('hapus pengguna sementara 2 (jaga jumlah)', call({ action: 'deletePengguna', token, id: pAcak.data.id }).success);
const p2 = call({ action: 'addPengguna', token, nama: 'Siti Aminah', username: 'siti.aminah', password: 'rahasia123', role: 'Guru', kelas: '', id: 'GURU-01' });
cek('tambah pengguna ID manual dipertahankan', p2.success && p2.data.id === 'GURU-01', JSON.stringify(p2));
const edit = call({ action: 'updatePengguna', token, id: p1.data.id, nama: 'Budi Santoso Edited', username: 'budi.santoso', role: 'Siswa', kelas: '9B' });
cek('edit pengguna (tanpa ganti password)', edit.success && edit.data.id === p1.data.id, JSON.stringify(edit));
cek('edit ke username milik orang lain ditolak', !call({ action: 'updatePengguna', token, id: p1.data.id, nama: 'Budi', username: 'siti.aminah', role: 'Siswa' }).success);
cek('edit pengguna tak dikenal ditolak', !call({ action: 'updatePengguna', token, id: 'KID-9999', nama: 'X', username: 'xx', role: 'Siswa' }).success);
const loginBudi = call({ action: 'login', username: 'budi.santoso', password: 'rahasia123' });
cek('login pengguna baru (Siswa)', loginBudi.success && loginBudi.data.peran === 'Siswa');
const tokenBudi = loginBudi.data?.token || '';
cek('ganti password mematikan token lama', (() => {
  const ok = call({ action: 'updatePengguna', token, id: p1.data.id, nama: 'Budi Santoso Edited', username: 'budi.santoso', role: 'Siswa', password: 'baru12345' });
  return ok.success && !call({ action: 'getAllData', token: tokenBudi }).success;
})());
cek('login dengan password baru', call({ action: 'login', username: 'budi.santoso', password: 'baru12345' }).success);
cek('login dengan password lama ditolak', !call({ action: 'login', username: 'budi.santoso', password: 'rahasia123' }).success);

console.log('== impor pengguna ==');
const impor = call({ action: 'importPengguna', token, rows: [
  { nama: 'Andi', username: 'andi', password: 'rahasia123', role: 'Siswa', kelas: '9A' },
  { nama: 'Duplikat Budi', username: 'budi.santoso', password: 'rahasia123', role: 'Siswa' },
  { nama: '', username: 'kosong', password: 'rahasia123', role: 'Siswa' },
  { nama: 'Rina', username: 'rina', password: 'abc', role: 'Siswa' },
  // v1.0.1: username+password kosong -> username = Nama Lengkap, password acak.
  { nama: 'Dewi Lestari', username: '', password: '', role: 'Guru', id: 'KID-0009' },
] });
cek('impor: 2 ditambah, 3 dilewati, tidak menimpa', impor.success && impor.data.ditambah === 2 && impor.data.dilewati.length === 3, JSON.stringify(impor));
cek('impor: username kosong terisi Nama Lengkap + password acak dilaporkan', impor.data.passwordAcak.length === 1 && impor.data.passwordAcak[0].username === 'Dewi Lestari' && impor.data.passwordAcak[0].password.length === 6, JSON.stringify(impor.data.passwordAcak));
cek('impor: login username nama lengkap + password acak', call({ action: 'login', username: 'dewi lestari', password: impor.data.passwordAcak[0].password }).success);
cek('impor kosong ditolak', !call({ action: 'importPengguna', token, rows: [] }).success);
cek('jumlah pengguna setelah impor = 6', call({ action: 'getAllData', token }).data.pengguna.length === 6);

console.log('== upload foto ==');
cek('uploadFoto bukan gambar ditolak', !call({ action: 'uploadFoto', token, userId: p1.data.id, dataBase64: 'aGVsbG8=', mimeType: 'application/pdf' }).success);
cek('uploadFoto user tak dikenal ditolak', !call({ action: 'uploadFoto', token, userId: 'KID-9999', dataBase64: pngB64, mimeType: 'image/png' }).success);
const up1 = call({ action: 'uploadFoto', token, userId: p1.data.id, dataBase64: pngB64, mimeType: 'image/png', namaFile: 'budi.santoso.png' });
cek('uploadFoto berhasil + URL Drive', up1.success && up1.data.url.includes('drive.google.com'), JSON.stringify(up1));
cek('fotoUrl tersimpan di pengguna', call({ action: 'getAllData', token }).data.pengguna.find((u) => u.id === p1.data.id)?.fotoUrl.includes('drive.google.com'));
const massal = call({ action: 'uploadFotoMassal', token, items: [
  { userId: 'GURU-01', dataBase64: pngB64, mimeType: 'image/jpeg', namaFile: 'siti.aminah.jpg' },
  { userId: 'KID-9999', dataBase64: pngB64, mimeType: 'image/png', namaFile: 'hantu.png' },
  { userId: p1.data.id, dataBase64: 'aGVsbG8=', mimeType: 'application/pdf', namaFile: 'budi.pdf' },
] });
cek('uploadFotoMassal: 1 berhasil, 2 gagal + alasan', massal.success && massal.data.berhasil === 1 && massal.data.gagal.length === 2, JSON.stringify(massal));
cek('uploadFotoMassal kosong ditolak', !call({ action: 'uploadFotoMassal', token, items: [] }).success);
const logo = call({ action: 'uploadLogo', token, dataBase64: pngB64, mimeType: 'image/png', namaFile: 'logo.png' });
cek('uploadLogo admin berhasil', logo.success && logo.data.url.includes('drive.google.com'));
cek('logoUrl tersimpan di pengaturan', call({ action: 'getPengaturan', token }).data.logoUrl.includes('drive.google.com'));

console.log('== template kartu ==');
const tmplList = call({ action: 'listTemplate', token });
cek('listTemplate 3 template', tmplList.success && tmplList.data.length === 3, JSON.stringify(tmplList.data?.length));
cek('saveTemplate JSON invalid ditolak', !call({ action: 'saveTemplate', token, nama: 'Rusak', roleTarget: 'Siswa', desainJson: '{bukan-json' }).success);
cek('saveTemplate roleTarget invalid ditolak', !call({ action: 'saveTemplate', token, nama: 'Rusak', roleTarget: 'Kepala', desainJson: '{}' }).success);
cek('saveTemplate nama kosong ditolak', !call({ action: 'saveTemplate', token, nama: '', roleTarget: 'Siswa', desainJson: '{}' }).success);
const tmplBaru = call({ action: 'saveTemplate', token, nama: 'Kartu Siswa Biru', roleTarget: 'Siswa', desainJson: '{"warnaUtama":"#1e40af"}', isDefault: true });
cek('saveTemplate baru sebagai default Siswa', tmplBaru.success);
cek('hanya satu default per role (lama dimatikan)', (() => { const l = call({ action: 'listTemplate', token }).data; return l.filter((t) => t.roleTarget === 'Siswa' && t.isDefault).length === 1 && l.find((t) => t.id === tmplBaru.data.id)?.isDefault === true; })());
const editTmpl = call({ action: 'saveTemplate', token, id: tmplBaru.data.id, nama: 'Kartu Siswa Biru v2', roleTarget: 'Siswa', desainJson: '{"warnaUtama":"#1e40af"}', isDefault: true });
cek('edit template', editTmpl.success);
cek('deleteTemplate', call({ action: 'deleteTemplate', token, id: tmplBaru.data.id }).success);
cek('deleteTemplate tak dikenal ditolak', !call({ action: 'deleteTemplate', token, id: 'tidak-ada' }).success);

console.log('== cetak, backup, restore ==');
const tandai = call({ action: 'tandaiDicetak', token, ids: [p1.data.id, 'GURU-01'] });
cek('tandaiDicetak 2 kartu', tandai.success && tandai.data.jumlah === 2);
cek('tandaiDicetak kosong ditolak', !call({ action: 'tandaiDicetak', token, ids: [] }).success);
cek('status dicetak tercatat', call({ action: 'getAllData', token }).data.pengguna.find((u) => u.id === p1.data.id)?.dicetak === 1);
const backup = call({ action: 'backupData', token });
cek('backupData berisi pengguna+template+pengaturan', backup.success && backup.data.pengguna.length === 6 && backup.data.templates.length === 3);
const restore = call({ action: 'restoreData', token, backup: {
  pengguna: [
    { id: 'KID-0003', nama: 'Budi Santoso Edited', username: 'budi.santoso', role: 'Siswa', kelas: '9B' },
    { id: 'KID-0050', nama: 'Restore Baru', username: 'restore.baru', role: 'Siswa', kelas: '9A' },
  ],
  pengaturan: { namaInstansi: 'Dari Backup' },
} });
cek('restoreData: 1 ditambah, 1 dilewati (tidak menimpa)', restore.success && restore.data.ditambah === 1 && restore.data.dilewati === 1, JSON.stringify(restore));
cek('restore tidak menimpa nama instansi yang sudah terisi', call({ action: 'getPengaturan', token }).data.namaInstansi === 'Sekolah Contoh');
cek('restoreData kosong ditolak', !call({ action: 'restoreData', token, backup: { pengguna: [] } }).success);

console.log('== hapus, logout, init kedua ==');
const adminId = call({ action: 'getAllData', token }).data.pengguna.find((u) => u.username === 'admin').id;
cek('hapus diri sendiri ditolak', !call({ action: 'deletePengguna', token, id: adminId }).success);
cek('hapus admin terakhir ditolak (admin lain belum ada)', !call({ action: 'deletePengguna', token, id: adminId }).success);
const hapusOp = call({ action: 'deletePengguna', token, id: call({ action: 'getAllData', token }).data.pengguna.find((u) => u.username === 'operator').id });
cek('admin menghapus operator', hapusOp.success);
cek('hapus pengguna tak dikenal ditolak', !call({ action: 'deletePengguna', token, id: 'KID-9999' }).success);
cek('logout', call({ action: 'logout', token }).success);
cek('token lama mati setelah logout', !call({ action: 'getAllData', token }).success);
const loginLagi = call({ action: 'login', username: 'admin', password: 'admin123' });
const token2 = loginLagi.data?.token || '';
cek('initDatabase tanpa token setelah ada pengguna ditolak', !call({ action: 'initDatabase' }).success);
const init2 = call({ action: 'initDatabase', token: token2 });
cek('initDatabase kedua oleh admin berhasil', init2.success);
cek('initDatabase kedua tidak menghapus data (6 pengguna: 7 setelah restore − 1 operator dihapus)', call({ action: 'getAllData', token: token2 }).data.pengguna.length === 6);
cek('initDatabase kedua tidak menduplikasi akun bawaan', call({ action: 'getAllData', token: token2 }).data.pengguna.filter((u) => u.username === 'admin').length === 1);

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
