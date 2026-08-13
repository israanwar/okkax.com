# OKKAX

OKKAX adalah aplikasi FastAPI + React dengan MongoDB. Pengembangan lokal selalu memakai database
`okkax_local`; jangan menggunakan URI database Emergent/produksi di komputer lokal.

## Prasyarat macOS Apple Silicon

```bash
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
brew tap mongodb/brew
brew trust mongodb/brew
brew install mongodb-community@8.0 gh yarn python@3.12
```

MongoDB dipasang dari tap resmi MongoDB. Verifikasi server lokal:

```bash
brew services start mongodb/brew/mongodb-community@8.0
mongosh --quiet --eval 'JSON.stringify(db.adminCommand({ ping: 1 }))'
```

Hasil harus memuat `"ok":1`.

## Setup dan menjalankan aplikasi

```bash
./scripts/setup-local.sh
./scripts/dev.sh
```

- Frontend: <http://localhost:3000>
- Backend API: <http://127.0.0.1:8001>
- Health: <http://127.0.0.1:8001/api/health>
- MongoDB: `mongodb://127.0.0.1:27017`, database `okkax_local`

`setup-local.sh` membuat `backend/.env` dan `frontend/.env` dari file contoh. Nilai rahasia lokal
dibuat secara acak dan kedua file tersebut diabaikan Git. Integrasi AI Emergent dan Stripe bersifat
opsional; tanpa credential, AI memakai compiler deterministik dan pembayaran internal tetap sandbox.

## Test dan build

Dengan backend lokal pada port 8001:

```bash
./scripts/test-all.sh
./scripts/check-build.sh
./scripts/check-secrets.sh
```

`test-all.sh` menolak berjalan jika `DB_NAME` bukan `okkax_local` atau MongoDB bukan localhost. Seeder
demo memakai ID deterministik dan upsert; menjalankannya ulang tidak menghapus record lain atau membuat
duplikat katalog.

## Alur rilis aman

1. Edit dan test di branch `development`.
2. Push `development`; GitHub Actions menjalankan backend test, test katalog Discover, frontend build,
   serta pemeriksaan file environment/secret.
3. Buat PR `development` ke `main` dan merge hanya setelah review serta CI hijau.
4. GitHub tidak dianggap otomatis men-deploy Emergent. Di dashboard Emergent lakukan GitHub/Export →
   Pull, periksa Preview dan Health Check, lalu Re-publish tepat satu kali setelah semuanya benar.

Rollback Git yang aman setelah sebuah commit ter-push menggunakan commit baru:

```bash
git revert <commit-hash>
git push origin development
```
