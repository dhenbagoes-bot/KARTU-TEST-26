/**
 * BACKEND — Manajemen Data & Cetak Kartu Identitas (wwn-kartu-identitas-80) v1.0.1
 * Google Apps Script + Google Sheets + Google Drive
 *
 * PENTING (baca dulu):
 *  1. Buat Google Spreadsheet baru (mis. "Database Kartu Identitas").
 *  2. Dari DALAM spreadsheet itu: menu Extensions > Apps Script.
 *     JANGAN buat project di script.google.com langsung (standalone),
 *     karena getActiveSpreadsheet() akan null dan semua aksi gagal.
 *  3. HAPUS seluruh isi editor, lalu PASTE seluruh isi file ini. Simpan.
 *  4. Project Settings (roda gigi) > centang "Show appsscript.json
 *     manifest file in editor", lalu GANTI isi appsscript.json dengan
 *     file backend/appsscript.json dari repo ini (izin Drive diperlukan
 *     untuk unggah foto/logo).
 *  5. Jalankan fungsi "authorizeDriveAccess" dari editor, setujui izin.
 *  6. Deploy > New deployment > Web app: Execute as Me, Who has access
 *     Anyone. Setiap perubahan kode: Deploy > Manage deployments >
 *     New version (BUKAN New deployment baru).
 *  7. Salin URL /exec ke menu Konfigurasi aplikasi, klik Uji Koneksi,
 *     lalu klik Inisialisasi Database.
 *
 * Sheet yang dibuat (4): Pengguna, Pengaturan, TemplateKartu, LogAktivitas.
 * Header dibuat HANYA bila sheet kosong; data yang sudah ada TIDAK PERNAH
 * dihapus/di-reset oleh initDatabase.
 *
 * KONTRAK API:
 *  - POST JSON { action, token?, ...params } dengan
 *    Content-Type text/plain (hindari preflight CORS).
 *  - Envelope SELALU: { success, message?, data?, error? }.
 *  - Tanggal di wire: yyyy-MM-dd; datetime: yyyy-MM-dd HH:mm:ss.
 *  - Password TIDAK PERNAH disimpan plaintext: SHA-256(garam+password).
 *    Hash/garam/token TIDAK PERNAH dikirim ke frontend.
 *  - Token sesi kedaluwarsa 7 hari; logout menghapus token.
 *  - Akun bawaan (dibuat HANYA saat sheet Pengguna masih kosong):
 *    admin / admin123 (Admin), operator / operator123 (Operator).
 *    SEGERA ganti kata sandi setelah inisialisasi! Halaman login
 *    TIDAK menampilkan kredensial ini.
 *  - ID pengguna: bila kosong saat tambah/impor, dibuat otomatis
 *    KID-0001, KID-0002, ... (berurutan, tidak memakai ID yang sudah ada).
 *  - Foto massal: pencocokan username/ID dilakukan di frontend dari nama
 *    file; backend hanya menerima pasangan userId + file yang sudah cocok.
 */

var APP_VERSION = '1.0.1';

var SHEET_PENGGUNA = 'Pengguna';
var SHEET_PENGATURAN = 'Pengaturan';
var SHEET_TEMPLATE = 'TemplateKartu';
var SHEET_LOG = 'LogAktivitas';

var SEMUA_SHEET = [SHEET_PENGGUNA, SHEET_PENGATURAN, SHEET_TEMPLATE, SHEET_LOG];

var HEADERS = {};
HEADERS[SHEET_PENGGUNA] = ['ID', 'Nama', 'Username', 'PasswordHash',
  'PasswordSalt', 'Role', 'Kelas', 'FotoUrl', 'Status', 'Dicetak',
  'DibuatPada', 'DiubahPada'];
HEADERS[SHEET_PENGATURAN] = ['Kunci', 'Nilai'];
HEADERS[SHEET_TEMPLATE] = ['ID', 'Nama', 'RoleTarget', 'DesainJson',
  'IsDefault', 'DibuatPada', 'DiubahPada'];
HEADERS[SHEET_LOG] = ['ID', 'Waktu', 'Username', 'Aksi', 'Detail'];

var DEFAULT_PENGATURAN = [
  ['namaInstansi', 'Nama Instansi'],
  ['alamatInstansi', ''],
  ['teleponInstansi', ''],
  ['kepalaInstansi', ''],
  ['tahun', '2026/2027'],
  ['logoUrl', '']
];

var KUNCI_PENGATURAN = ['namaInstansi', 'alamatInstansi',
  'teleponInstansi', 'kepalaInstansi', 'tahun', 'logoUrl'];

var PERAN_VALID = ['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'];
var PERAN_RANK = { Siswa: 0, Pegawai: 1, Guru: 1, Operator: 1, Admin: 2 };
var TOKEN_MASA_BERLAKU_MS = 7 * 24 * 60 * 60 * 1000;
var FOLDER_DRIVE = 'Kartu Identitas';
var MIME_FOTO = ['image/png', 'image/jpeg', 'image/jpg'];

// ---------------- Util dasar ----------------

function str(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
  return String(v);
}
function strCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  return String(v);
}
function sekarang() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}
function hashPassword(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(salt) + String(password), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = (bytes[i] & 0xff).toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  return hex;
}
function bacaBaris(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (str(vals[i][0]).trim() !== '') out.push(vals[i]);
  }
  return out;
}
function cariBaris(sheet, kolomIdx, nilai) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var vals = sheet.getRange(2, kolomIdx + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (str(vals[i][0]) === String(nilai)) return i + 2;
  }
  return -1;
}
function pastikanSheet(ss, nama) {
  var sheet = ss.getSheetByName(nama);
  if (!sheet) {
    sheet = ss.insertSheet(nama);
    sheet.getRange(1, 1, 1, HEADERS[nama].length).setValues([HEADERS[nama]]);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS[nama].length).setValues([HEADERS[nama]]);
  }
  return sheet;
}
function catatLog(ss, username, aksi, detail) {
  try {
    var sheet = pastikanSheet(ss, SHEET_LOG);
    sheet.appendRow([Utilities.getUuid(), sekarang(), username || '-', aksi, detail || '']);
  } catch (e) { /* log tidak boleh menggagalkan aksi utama */ }
}
function bacaPengaturan(ss) {
  var sheet = pastikanSheet(ss, SHEET_PENGATURAN);
  var rows = bacaBaris(sheet);
  var out = {};
  for (var i = 0; i < rows.length; i++) out[str(rows[i][0])] = strCell(rows[i][1]);
  return out;
}
function tulisPengaturan(ss, kunci, nilai) {
  var sheet = pastikanSheet(ss, SHEET_PENGATURAN);
  var rn = cariBaris(sheet, 0, kunci);
  if (rn > 0) sheet.getRange(rn, 2).setValue(nilai);
  else sheet.appendRow([kunci, nilai]);
}

// ---------------- Auth ----------------
// Kolom Pengguna: 0 ID, 1 Nama, 2 Username, 3 PasswordHash, 4 PasswordSalt,
// 5 Role, 6 Kelas, 7 FotoUrl, 8 Status, 9 Dicetak, 10 DibuatPada, 11 DiubahPada.
// Token sesi disimpan di PropertiesService (bukan di sheet) agar hash/garam
// tidak bercampur dengan sesi: kunci 'token:<uuid>' -> JSON {username, exp}.
// Catatan: token lama dihapus saat logout / kedaluwarsa.

function getUserFromToken(ss, token) {
  token = str(token);
  if (!token) return null;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('token:' + token);
    if (!raw) return null;
    var sesi = JSON.parse(raw);
    if (!sesi || !sesi.username || Number(sesi.exp) < Date.now()) return null;
    var sheet = ss.getSheetByName(SHEET_PENGGUNA);
    if (!sheet) return null;
    var rows = bacaBaris(sheet);
    for (var i = 0; i < rows.length; i++) {
      if (str(rows[i][2]) === String(sesi.username)) {
        if (str(rows[i][8]) !== 'aktif') return null;
        return { id: str(rows[i][0]), nama: str(rows[i][1]),
          username: str(rows[i][2]), peran: str(rows[i][5]), rowNum: i + 2 };
      }
    }
  } catch (e) { return null; }
  return null;
}
function wajibAuth(ss, payload, peranMin) {
  var user = getUserFromToken(ss, payload && payload.token);
  if (!user) return { ok: false, message: 'Sesi berakhir, silakan login ulang.' };
  if (peranMin && (PERAN_RANK[user.peran] || 0) < (PERAN_RANK[peranMin] || 0)) {
    return { ok: false, message: 'Anda tidak memiliki hak akses untuk aksi ini.' };
  }
  return { ok: true, user: user };
}
function hapusToken(token) {
  try { PropertiesService.getScriptProperties().deleteProperty('token:' + str(token)); } catch (e) {}
}

// ---------------- Pemetaan baris ----------------

function penggunaKeObjek(r) {
  return { id: str(r[0]), nama: str(r[1]), username: str(r[2]),
    role: str(r[5]), kelas: str(r[6]), fotoUrl: str(r[7]),
    status: str(r[8]) || 'aktif', dicetak: str(r[9]) === '1' ? 1 : 0,
    dibuatPada: strCell(r[10]), diubahPada: strCell(r[11]) };
}
function semuaPengguna(ss) {
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return [];
  var rows = bacaBaris(sheet);
  var out = [];
  for (var i = 0; i < rows.length; i++) out.push(penggunaKeObjek(rows[i]));
  return out;
}
function templateKeObjek(r) {
  var desain = {};
  try { desain = JSON.parse(str(r[3]) || '{}'); } catch (e) { desain = {}; }
  return { id: str(r[0]), nama: str(r[1]), roleTarget: str(r[2]) || 'Semua',
    desain: desain, isDefault: str(r[4]) === '1',
    dibuatPada: strCell(r[5]), diubahPada: strCell(r[6]) };
}
function semuaTemplate(ss) {
  var sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) return [];
  var rows = bacaBaris(sheet);
  var out = [];
  for (var i = 0; i < rows.length; i++) out.push(templateKeObjek(rows[i]));
  return out;
}
function idBerikutnya(ss) {
  var maks = 0;
  var list = semuaPengguna(ss);
  for (var i = 0; i < list.length; i++) {
    var m = /^KID-(\d+)$/.exec(list[i].id || '');
    if (m) maks = Math.max(maks, parseInt(m[1], 10) || 0);
  }
  var n = String(maks + 1);
  while (n.length < 4) n = '0' + n;
  return 'KID-' + n;
}
/** Username = Nama Lengkap: rapikan spasi (trim + satu spasi antar kata). */
function normalisasiUsername(s) {
  return str(s).trim().replace(/\s+/g, ' ');
}

/** Password acak 6 karakter (huruf + angka, tanpa karakter membingungkan). */
function buatPasswordAcak() {
  var aksara = 'abcdefghjkmnpqrstuvwxyz23456789';
  var out = '';
  for (var i = 0; i < 6; i++) out += aksara.charAt(Math.floor(Math.random() * aksara.length));
  return out;
}

function validasiPengguna(p, daftar, idLama) {
  var errs = [];
  if (!str(p.nama).trim()) errs.push('Nama lengkap wajib diisi.');
  // Username boleh berisi spasi (= Nama Lengkap); bila dikosongkan, diisi dari Nama.
  var username = normalisasiUsername(str(p.username).trim() || str(p.nama).trim());
  if (!username) errs.push('Username wajib diisi.');
  else if (!/^[A-Za-z0-9._\- ']+$/.test(username)) errs.push('Username hanya boleh huruf, angka, spasi, titik, underscore, dash, apostrof.');
  if (PERAN_VALID.indexOf(str(p.role)) < 0) errs.push('Role harus salah satu: ' + PERAN_VALID.join(', ') + '.');
  for (var i = 0; i < daftar.length; i++) {
    if (idLama && daftar[i].id === idLama) continue;
    if (username && normalisasiUsername(daftar[i].username).toLowerCase() === username.toLowerCase()) {
      errs.push('Username ' + username + ' sudah dipakai oleh ' + daftar[i].nama + '.');
    }
    if (str(p.id).trim() && daftar[i].id === str(p.id).trim()) {
      errs.push('ID ' + p.id + ' sudah dipakai oleh ' + daftar[i].nama + '.');
    }
  }
  return errs;
}

// ---------------- Upload ke Drive ----------------

function unggahKeDrive(dataBase64, mimeType, namaFile, user) {
  if (MIME_FOTO.indexOf(str(mimeType)) < 0) {
    return { success: false, message: 'File harus berupa gambar JPG/JPEG/PNG.' };
  }
  var base64 = String(dataBase64 || '');
  var koma = base64.indexOf(',');
  if (koma >= 0) base64 = base64.substring(koma + 1);
  if (!base64) return { success: false, message: 'Data foto kosong.' };
  if (base64.length > 8000000) {
    return { success: false, message: 'Ukuran foto terlalu besar (maksimal sekitar 5 MB).' };
  }
  try {
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType,
      (str(namaFile) || 'foto') + '-' + Date.now());
    var folders = DriveApp.getFoldersByName(FOLDER_DRIVE);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_DRIVE);
    try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e1) {}
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {}
    var url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return { success: true, data: { url: url, fileId: file.getId() } };
  } catch (e) {
    return { success: false, message: 'Gagal mengunggah ke Drive: ' + e.message +
      ' (pastikan izin Drive sudah diotorisasi lewat authorizeDriveAccess).' };
  }
}

// ---------------- Aksi ----------------

function actionInitDatabase(ss) {
  for (var i = 0; i < SEMUA_SHEET.length; i++) pastikanSheet(ss, SEMUA_SHEET[i]);
  var pengaturan = bacaPengaturan(ss);
  for (var j = 0; j < DEFAULT_PENGATURAN.length; j++) {
    if (!(DEFAULT_PENGATURAN[j][0] in pengaturan)) {
      tulisPengaturan(ss, DEFAULT_PENGATURAN[j][0], DEFAULT_PENGATURAN[j][1]);
    }
  }
  var sheetUser = ss.getSheetByName(SHEET_PENGGUNA);
  if (bacaBaris(sheetUser).length === 0) {
    var salt1 = Utilities.getUuid(), salt2 = Utilities.getUuid();
    sheetUser.appendRow([idBerikutnya(ss), 'Administrator', 'admin',
      hashPassword('admin123', salt1), salt1, 'Admin', '', '', 'aktif', 0, sekarang(), sekarang()]);
    sheetUser.appendRow([idBerikutnya(ss), 'Operator', 'operator',
      hashPassword('operator123', salt2), salt2, 'Operator', '', '', 'aktif', 0, sekarang(), sekarang()]);
  }
  var sheetTmpl = ss.getSheetByName(SHEET_TEMPLATE);
  if (bacaBaris(sheetTmpl).length === 0) {
    var desainSiswa = JSON.stringify({ warnaUtama: '#047857', warnaKedua: '#065f46', warnaAksen: '#d4af37', warnaTeks: '#ffffff', gradasi: 'linear-gradient(135deg,#059669 0%,#047857 55%,#064e3b 100%)', fontKeluarga: 'system-ui', ukuranTeks: 1, orientasi: 'landscape', posisiLogo: 'kiri', posisiFoto: 'kiri', tampilId: true, tampilRole: true, tampilKelas: true, tampilLogo: true, bingkai: true, ornamen: true });
    var desainGuru = JSON.stringify({ warnaUtama: '#78350f', warnaKedua: '#451a03', warnaAksen: '#f59e0b', warnaTeks: '#ffffff', gradasi: 'linear-gradient(135deg,#b45309 0%,#78350f 60%,#451a03 100%)', fontKeluarga: 'system-ui', ukuranTeks: 1, orientasi: 'landscape', posisiLogo: 'kiri', posisiFoto: 'kiri', tampilId: true, tampilRole: true, tampilKelas: true, tampilLogo: true, bingkai: true, ornamen: true });
    sheetTmpl.appendRow([Utilities.getUuid(), 'Kartu Siswa', 'Siswa', desainSiswa, '1', sekarang(), sekarang()]);
    sheetTmpl.appendRow([Utilities.getUuid(), 'Kartu Guru', 'Guru', desainGuru, '1', sekarang(), sekarang()]);
    sheetTmpl.appendRow([Utilities.getUuid(), 'Kartu Pegawai', 'Pegawai', desainSiswa, '1', sekarang(), sekarang()]);
  }
  return { success: true, message: 'Database berhasil diinisialisasi (data lama dipertahankan).',
    data: { sheets: SEMUA_SHEET } };
}

function actionLogin(ss, p) {
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Database belum diinisialisasi. Jalankan Inisialisasi Database dulu.' };
  var rows = bacaBaris(sheet);
  // Username = Nama Lengkap: login tidak peka huruf besar/kecil & spasi ganda.
  var cari = normalisasiUsername(str(p.username)).toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (normalisasiUsername(str(rows[i][2])).toLowerCase() === cari) {
      if (str(rows[i][8]) !== 'aktif') return { success: false, message: 'Akun tidak aktif. Hubungi admin.' };
      if (hashPassword(p.password || '', str(rows[i][4])) !== str(rows[i][3])) {
        return { success: false, message: 'Username atau kata sandi salah.' };
      }
      var token = Utilities.getUuid();
      var exp = Date.now() + TOKEN_MASA_BERLAKU_MS;
      PropertiesService.getScriptProperties().setProperty('token:' + token,
        JSON.stringify({ username: str(rows[i][2]), exp: exp }));
      catatLog(ss, str(rows[i][2]), 'login', 'Login berhasil');
      return { success: true, message: 'Login berhasil.',
        data: { token: token, nama: str(rows[i][1]), username: str(rows[i][2]),
          peran: str(rows[i][5]), id: str(rows[i][0]) } };
    }
  }
  return { success: false, message: 'Username atau kata sandi salah.' };
}

function actionGetAllData(ss, user) {
  var sheetLog = ss.getSheetByName(SHEET_LOG);
  var log = [];
  if (sheetLog) {
    var lrows = bacaBaris(sheetLog);
    for (var k = lrows.length - 1; k >= 0 && log.length < 50; k--) {
      log.push({ id: str(lrows[k][0]), waktu: strCell(lrows[k][1]),
        username: str(lrows[k][2]), aksi: str(lrows[k][3]), detail: str(lrows[k][4]) });
    }
  }
  return { success: true, data: { pengaturan: bacaPengaturan(ss),
    pengguna: semuaPengguna(ss), templates: semuaTemplate(ss),
    log: log, version: APP_VERSION } };
}

function actionGetPengaturan(ss, user) {
  return { success: true, data: bacaPengaturan(ss) };
}

function actionSavePengaturan(ss, user, p) {
  var obj = p.pengaturan || {};
  for (var i = 0; i < KUNCI_PENGATURAN.length; i++) {
    var k = KUNCI_PENGATURAN[i];
    if (k in obj) tulisPengaturan(ss, k, str(obj[k]));
  }
  catatLog(ss, user.username, 'ubah-pengaturan', 'Pengaturan instansi diperbarui');
  return { success: true, message: 'Pengaturan tersimpan.' };
}

function actionAddPengguna(ss, user, p) {
  var daftar = semuaPengguna(ss);
  // Username kosong -> diisi dari Nama Lengkap; password kosong -> dibuat acak.
  var username = normalisasiUsername(str(p.username).trim() || str(p.nama).trim());
  var password = str(p.password);
  var passwordAcak = null;
  if (!password) { password = buatPasswordAcak(); passwordAcak = password; }
  if (password.length < 6) {
    return { success: false, message: 'Password wajib diisi, minimal 6 karakter.' };
  }
  var id = str(p.id).trim() || idBerikutnya(ss);
  var errs = validasiPengguna({ nama: p.nama, username: username, role: p.role, id: id }, daftar, '');
  if (errs.length) return { success: false, message: errs.join(' ') };
  var sheet = pastikanSheet(ss, SHEET_PENGGUNA);
  var salt = Utilities.getUuid();
  sheet.appendRow([id, str(p.nama).trim(), username,
    hashPassword(password, salt), salt, str(p.role), str(p.kelas || ''),
    str(p.fotoUrl || ''), 'aktif', 0, sekarang(), sekarang()]);
  catatLog(ss, user.username, 'tambah-pengguna', 'Tambah pengguna ' + username + ' (' + p.role + ', ID ' + id + ')');
  var hasil = { success: true, message: 'Pengguna ditambahkan (ID ' + id + ').', data: { id: id } };
  if (passwordAcak) hasil.data.passwordAcak = passwordAcak;
  return hasil;
}

function actionUpdatePengguna(ss, user, p) {
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Sheet Pengguna tidak ditemukan.' };
  var rn = cariBaris(sheet, 0, str(p.id));
  if (rn < 0) return { success: false, message: 'Pengguna tidak ditemukan.' };
  var daftar = semuaPengguna(ss);
  var username = normalisasiUsername(str(p.username).trim() || str(p.nama).trim());
  var errs = validasiPengguna({ nama: p.nama, username: username, role: p.role, id: p.id }, daftar, str(p.id));
  if (errs.length) return { success: false, message: errs.join(' ') };
  var lama = sheet.getRange(rn, 1, 1, 12).getValues()[0];
  var hash = str(lama[3]), salt = str(lama[4]);
  if (str(p.password || '').length > 0) {
    if (str(p.password).length < 6) return { success: false, message: 'Password minimal 6 karakter.' };
    salt = Utilities.getUuid();
    hash = hashPassword(p.password, salt);
    hapusTokenUntukUsername(ss, str(lama[2]));
  }
  sheet.getRange(rn, 1, 1, 12).setValues([[str(lama[0]), str(p.nama).trim(),
    username, hash, salt, str(p.role), str(p.kelas || ''),
    str(p.fotoUrl !== undefined && p.fotoUrl !== null ? p.fotoUrl : lama[7]),
    str(lama[8]) || 'aktif', lama[9], lama[10], sekarang()]]);
  catatLog(ss, user.username, 'edit-pengguna', 'Edit pengguna ' + username + ' (ID ' + p.id + ')');
  return { success: true, message: 'Pengguna diperbarui.', data: { id: str(lama[0]) } };
}

function hapusTokenUntukUsername(ss, username) {
  // Token disimpan di ScriptProperties dengan kunci 'token:<uuid>' dan isi
  // JSON {username, exp}: hapus semua token milik username ini agar pemilik
  // akun wajib login ulang setelah password diganti.
  try {
    var props = PropertiesService.getScriptProperties();
    var keys = props.getKeys();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('token:') !== 0) continue;
      try {
        var sesi = JSON.parse(props.getProperty(keys[i]) || '{}');
        if (sesi && sesi.username === username) props.deleteProperty(keys[i]);
      } catch (e2) { /* token rusak: biarkan kedaluwarsa sendiri */ }
    }
  } catch (e) { /* kegagalan membersihkan token tidak menggagalkan ganti password */ }
}

function actionDeletePengguna(ss, user, p) {
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Sheet Pengguna tidak ditemukan.' };
  var rn = cariBaris(sheet, 0, str(p.id));
  if (rn < 0) return { success: false, message: 'Pengguna tidak ditemukan.' };
  if (str(sheet.getRange(rn, 3).getValue()) === user.username) {
    return { success: false, message: 'Akun sendiri tidak boleh dihapus.' };
  }
  var rows = bacaBaris(sheet);
  var adminAktif = 0;
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i][5]) === 'Admin' && str(rows[i][8]) === 'aktif') adminAktif++;
  }
  if (str(sheet.getRange(rn, 6).getValue()) === 'Admin' && adminAktif <= 1) {
    return { success: false, message: 'Admin aktif terakhir tidak boleh dihapus.' };
  }
  var nama = str(sheet.getRange(rn, 3).getValue());
  sheet.deleteRow(rn);
  catatLog(ss, user.username, 'hapus-pengguna', 'Hapus pengguna ' + nama);
  return { success: true, message: 'Pengguna dihapus.' };
}

function actionImportPengguna(ss, user, p) {
  var rows = p.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: 'Tidak ada baris untuk diimpor.' };
  }
  var sheet = pastikanSheet(ss, SHEET_PENGGUNA);
  var daftar = semuaPengguna(ss);
  var ditambah = 0;
  var dilewati = [];
  var passwordAcak = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var errs = [];
    if (!str(r.nama).trim()) errs.push('Nama kosong');
    // Username kosong -> diisi dari Nama Lengkap; password kosong -> dibuat acak.
    var usernameBaris = normalisasiUsername(str(r.username).trim() || str(r.nama).trim());
    if (!usernameBaris) errs.push('Username kosong');
    var passwordBaris = str(r.password);
    var acakBaris = null;
    if (!passwordBaris) { passwordBaris = buatPasswordAcak(); acakBaris = passwordBaris; }
    if (passwordBaris.length < 6) errs.push('Password minimal 6 karakter');
    if (PERAN_VALID.indexOf(str(r.role)) < 0) errs.push('Role tidak valid');
    if (errs.length) { dilewati.push({ baris: i + 1, nama: str(r.nama), alasan: errs.join('; ') }); continue; }
    var id = str(r.id).trim() || idBerikutnya(ss);
    var errs2 = validasiPengguna({ nama: r.nama, username: usernameBaris, role: r.role, id: id }, daftar, '');
    if (errs2.length) { dilewati.push({ baris: i + 1, nama: str(r.nama), alasan: errs2.join(' ') }); continue; }
    var salt = Utilities.getUuid();
    sheet.appendRow([id, str(r.nama).trim(), usernameBaris,
      hashPassword(passwordBaris, salt), salt, str(r.role), str(r.kelas || ''),
      '', 'aktif', 0, sekarang(), sekarang()]);
    daftar.push({ id: id, nama: str(r.nama).trim(), username: usernameBaris });
    if (acakBaris) passwordAcak.push({ nama: str(r.nama).trim(), username: usernameBaris, password: acakBaris });
    ditambah++;
  }
  catatLog(ss, user.username, 'impor-pengguna', 'Impor massal: ' + ditambah + ' ditambah, ' + dilewati.length + ' dilewati');
  return { success: true, message: 'Impor selesai: ' + ditambah + ' ditambah, ' + dilewati.length + ' dilewati.',
    data: { ditambah: ditambah, dilewati: dilewati, passwordAcak: passwordAcak } };
}

function actionUploadFoto(ss, user, p) {
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Sheet Pengguna tidak ditemukan.' };
  var rn = cariBaris(sheet, 0, str(p.userId));
  if (rn < 0) return { success: false, message: 'Pengguna tidak ditemukan (ID ' + p.userId + ').' };
  var up = unggahKeDrive(p.dataBase64, p.mimeType, p.namaFile || ('foto-' + p.userId), user);
  if (!up.success) return up;
  sheet.getRange(rn, 8).setValue(up.data.url);
  sheet.getRange(rn, 12).setValue(sekarang());
  catatLog(ss, user.username, 'unggah-foto', 'Foto pengguna ID ' + p.userId + ' diperbarui');
  return { success: true, message: 'Foto berhasil diunggah.', data: up.data };
}

function actionUploadFotoMassal(ss, user, p) {
  var items = p.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: 'Tidak ada foto untuk diunggah.' };
  }
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Sheet Pengguna tidak ditemukan.' };
  var berhasil = 0;
  var gagal = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var rn = cariBaris(sheet, 0, str(it.userId));
    if (rn < 0) { gagal.push({ namaFile: str(it.namaFile), alasan: 'Pengguna tidak ditemukan (ID ' + it.userId + ').' }); continue; }
    var up = unggahKeDrive(it.dataBase64, it.mimeType, it.namaFile, user);
    if (!up.success) { gagal.push({ namaFile: str(it.namaFile), alasan: up.message }); continue; }
    sheet.getRange(rn, 8).setValue(up.data.url);
    sheet.getRange(rn, 12).setValue(sekarang());
    berhasil++;
  }
  catatLog(ss, user.username, 'unggah-foto-massal', 'Upload foto massal: ' + berhasil + ' berhasil, ' + gagal.length + ' gagal');
  return { success: true, message: 'Upload massal selesai: ' + berhasil + ' berhasil, ' + gagal.length + ' gagal.',
    data: { berhasil: berhasil, gagal: gagal } };
}

function actionUploadLogo(ss, user, p) {
  var up = unggahKeDrive(p.dataBase64, p.mimeType, p.namaFile || 'logo-instansi', user);
  if (!up.success) return up;
  tulisPengaturan(ss, 'logoUrl', up.data.url);
  catatLog(ss, user.username, 'unggah-logo', 'Logo instansi diperbarui');
  return { success: true, message: 'Logo berhasil diunggah.', data: up.data };
}

function actionSaveTemplate(ss, user, p) {
  if (!str(p.nama).trim()) return { success: false, message: 'Nama template wajib diisi.' };
  var desain = {};
  try { desain = JSON.parse(str(p.desainJson || '{}')); } catch (e) {
    return { success: false, message: 'Desain template tidak valid (bukan JSON).' };
  }
  if (str(p.roleTarget) !== 'Semua' && PERAN_VALID.indexOf(str(p.roleTarget)) < 0) {
    return { success: false, message: 'Role target template tidak valid.' };
  }
  var sheet = pastikanSheet(ss, SHEET_TEMPLATE);
  var isDefault = p.isDefault ? '1' : '0';
  if (isDefault === '1') {
    // Hanya satu template default per roleTarget.
    var rows = bacaBaris(sheet);
    for (var i = 0; i < rows.length; i++) {
      if (str(rows[i][2]) === str(p.roleTarget) && str(rows[i][4]) === '1' &&
          (!p.id || str(rows[i][0]) !== str(p.id))) {
        sheet.getRange(i + 2, 5).setValue('0');
      }
    }
  }
  if (p.id) {
    var rn = cariBaris(sheet, 0, str(p.id));
    if (rn < 0) return { success: false, message: 'Template tidak ditemukan.' };
    var lama = sheet.getRange(rn, 1, 1, 7).getValues()[0];
    sheet.getRange(rn, 1, 1, 7).setValues([[str(lama[0]), str(p.nama).trim(),
      str(p.roleTarget), str(p.desainJson), isDefault, lama[5], sekarang()]]);
    catatLog(ss, user.username, 'edit-template', 'Edit template ' + p.nama);
    return { success: true, message: 'Template diperbarui.', data: { id: str(lama[0]) } };
  }
  var idBaru = Utilities.getUuid();
  sheet.appendRow([idBaru, str(p.nama).trim(), str(p.roleTarget),
    str(p.desainJson), isDefault, sekarang(), sekarang()]);
  catatLog(ss, user.username, 'tambah-template', 'Tambah template ' + p.nama + ' (' + p.roleTarget + ')');
  return { success: true, message: 'Template tersimpan.', data: { id: idBaru } };
}

function actionDeleteTemplate(ss, user, p) {
  var sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) return { success: false, message: 'Sheet TemplateKartu tidak ditemukan.' };
  var rn = cariBaris(sheet, 0, str(p.id));
  if (rn < 0) return { success: false, message: 'Template tidak ditemukan.' };
  var nama = str(sheet.getRange(rn, 2).getValue());
  sheet.deleteRow(rn);
  catatLog(ss, user.username, 'hapus-template', 'Hapus template ' + nama);
  return { success: true, message: 'Template dihapus.' };
}

function actionListTemplate(ss, user) {
  return { success: true, data: semuaTemplate(ss) };
}

function actionTandaiDicetak(ss, user, p) {
  var ids = p.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: 'Tidak ada kartu yang dipilih.' };
  }
  var sheet = ss.getSheetByName(SHEET_PENGGUNA);
  if (!sheet) return { success: false, message: 'Sheet Pengguna tidak ditemukan.' };
  var n = 0;
  for (var i = 0; i < ids.length; i++) {
    var rn = cariBaris(sheet, 0, str(ids[i]));
    if (rn > 0) {
      sheet.getRange(rn, 10).setValue(1);
      sheet.getRange(rn, 12).setValue(sekarang());
      n++;
    }
  }
  catatLog(ss, user.username, 'tandai-cetak', n + ' kartu ditandai sudah dicetak');
  return { success: true, message: n + ' kartu ditandai sudah dicetak.', data: { jumlah: n } };
}

function actionBackupData(ss, user) {
  var semua = actionGetAllData(ss, user);
  return { success: true, data: semua.data };
}

function actionRestoreData(ss, user, p) {
  var backup = p.backup || {};
  var rows = backup.pengguna || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: 'File backup tidak berisi data pengguna.' };
  }
  var sheet = pastikanSheet(ss, SHEET_PENGGUNA);
  var daftar = semuaPengguna(ss);
  var ditambah = 0;
  var dilewati = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!str(r.username).trim() || !str(r.nama).trim()) { dilewati++; continue; }
    var sudahAda = false;
    for (var j = 0; j < daftar.length; j++) {
      if (daftar[j].username.toLowerCase() === str(r.username).trim().toLowerCase() ||
          (str(r.id).trim() && daftar[j].id === str(r.id).trim())) { sudahAda = true; break; }
    }
    if (sudahAda) { dilewati++; continue; }
    // Password dari backup TIDAK dipulihkan (hash tidak bisa dipakai ulang
    // dengan aman tanpa garam asli di file yang sama) — beri password acak
    // sementara yang wajib diganti admin; catat di log.
    var salt = Utilities.getUuid();
    var pwSementara = 'ganti-' + Utilities.getUuid().substring(0, 8);
    var id = str(r.id).trim() || idBerikutnya(ss);
    sheet.appendRow([id, str(r.nama).trim(), str(r.username).trim(),
      hashPassword(pwSementara, salt), salt, PERAN_VALID.indexOf(str(r.role)) >= 0 ? str(r.role) : 'Siswa',
      str(r.kelas || ''), str(r.fotoUrl || ''), 'aktif', str(r.dicetak) === '1' ? 1 : 0, sekarang(), sekarang()]);
    daftar.push({ id: id, nama: str(r.nama), username: str(r.username).trim() });
    ditambah++;
  }
  if (backup.pengaturan) {
    for (var k = 0; k < KUNCI_PENGATURAN.length; k++) {
      var kunci = KUNCI_PENGATURAN[k];
      if (backup.pengaturan[kunci] !== undefined && backup.pengaturan[kunci] !== null &&
          str(bacaPengaturan(ss)[kunci] || '').trim() === '') {
        tulisPengaturan(ss, kunci, str(backup.pengaturan[kunci]));
      }
    }
  }
  catatLog(ss, user.username, 'restore-backup', 'Restore backup: ' + ditambah + ' ditambah, ' + dilewati + ' dilewati (password pengguna hasil restore wajib direset admin)');
  return { success: true, message: 'Restore selesai: ' + ditambah + ' ditambahkan, ' + dilewati + ' dilewati. Password pengguna hasil restore WAJIB direset oleh admin.',
    data: { ditambah: ditambah, dilewati: dilewati } };
}

// ---------------- Router ----------------

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = str(payload.action);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Spreadsheet tidak terikat. Buat Apps Script dari dalam spreadsheet (Extensions > Apps Script).');

    if (action === 'ping') {
      return jsonOut({ success: true, data: { version: APP_VERSION, waktu: sekarang() } });
    }
    if (action === 'login') return jsonOut(actionLogin(ss, payload));
    if (action === 'logout') {
      hapusToken(payload.token);
      return jsonOut({ success: true, message: 'Logout berhasil.' });
    }
    if (action === 'initDatabase') {
      // Boleh tanpa token HANYA saat Pengguna masih kosong (setup pertama).
      // Setelah ada pengguna, wajib Admin — mencegah reset oleh sembarang orang.
      var sheetUser = ss.getSheetByName(SHEET_PENGGUNA);
      var kosong = !sheetUser || bacaBaris(sheetUser).length === 0;
      if (!kosong) {
        var cek = wajibAuth(ss, payload, 'Admin');
        if (!cek.ok) return jsonOut({ success: false, message: cek.message });
      }
      return jsonOut(actionInitDatabase(ss));
    }

    // Semua aksi lain wajib login.
    var auth = wajibAuth(ss, payload, null);
    if (!auth.ok) return jsonOut({ success: false, message: auth.message });
    var user = auth.user;

    if (action === 'getAllData') return jsonOut(actionGetAllData(ss, user));
    if (action === 'getPengaturan') return jsonOut(actionGetPengaturan(ss, user));
    if (action === 'savePengaturan') {
      var a1 = wajibAuth(ss, payload, 'Admin');
      if (!a1.ok) return jsonOut({ success: false, message: a1.message });
      return jsonOut(actionSavePengaturan(ss, user, payload));
    }
    if (action === 'addPengguna') return jsonOut(actionAddPengguna(ss, user, payload));
    if (action === 'updatePengguna') return jsonOut(actionUpdatePengguna(ss, user, payload));
    if (action === 'deletePengguna') {
      var a2 = wajibAuth(ss, payload, 'Admin');
      if (!a2.ok) return jsonOut({ success: false, message: a2.message });
      return jsonOut(actionDeletePengguna(ss, user, payload));
    }
    if (action === 'importPengguna') return jsonOut(actionImportPengguna(ss, user, payload));
    if (action === 'uploadFoto') return jsonOut(actionUploadFoto(ss, user, payload));
    if (action === 'uploadFotoMassal') return jsonOut(actionUploadFotoMassal(ss, user, payload));
    if (action === 'uploadLogo') {
      var a3 = wajibAuth(ss, payload, 'Admin');
      if (!a3.ok) return jsonOut({ success: false, message: a3.message });
      return jsonOut(actionUploadLogo(ss, user, payload));
    }
    if (action === 'saveTemplate') return jsonOut(actionSaveTemplate(ss, user, payload));
    if (action === 'deleteTemplate') return jsonOut(actionDeleteTemplate(ss, user, payload));
    if (action === 'listTemplate') return jsonOut(actionListTemplate(ss, user));
    if (action === 'tandaiDicetak') return jsonOut(actionTandaiDicetak(ss, user, payload));
    if (action === 'backupData') {
      var a4 = wajibAuth(ss, payload, 'Admin');
      if (!a4.ok) return jsonOut({ success: false, message: a4.message });
      return jsonOut(actionBackupData(ss, user));
    }
    if (action === 'restoreData') {
      var a5 = wajibAuth(ss, payload, 'Admin');
      if (!a5.ok) return jsonOut({ success: false, message: a5.message });
      return jsonOut(actionRestoreData(ss, user, payload));
    }
    return jsonOut({ success: false, message: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return jsonOut({ success: false, message: 'Terjadi kesalahan server. Coba lagi.', error: String(err && err.message ? err.message : err) });
  }
}

function doGet(e) {
  try {
    return jsonOut({ success: true, data: { version: APP_VERSION, waktu: sekarang() } });
  } catch (err) {
    return jsonOut({ success: false, message: 'Terjadi kesalahan server.', error: String(err && err.message ? err.message : err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan sekali dari editor Apps Script untuk memberi izin Drive. */
function authorizeDriveAccess() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
}
