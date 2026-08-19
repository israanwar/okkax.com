# OKKAX Revenue Architecture

**Status:** Business & Revenue Constitution\
**Dokumen:** Arsitektur Model Bisnis dan Monetisasi OKKAX\
**Prinsip:** *Zero Commission on Labor & Talent --- We Monetize
Infrastructure, Not People's Work.*

------------------------------------------------------------------------

## 1. Prinsip Dasar Monetisasi

OKKAX dibangun sebagai **Live Event Operating Network**, bukan sekadar
marketplace yang mengambil persentase dari nilai kerja para pelaku
industri event.

Prinsip ekonominya adalah:

> **OKKAX tidak mengambil komisi persentase dari honor talent, upah
> workforce, jasa vendor produksi, atau nilai sewa venue. OKKAX
> memonetisasi infrastruktur digital, transaksi, intelligence, akses,
> distribusi, dan layanan enterprise yang membuat ekosistem live event
> dapat beroperasi secara terkoordinasi.**

Konsekuensinya, pertumbuhan pendapatan OKKAX tidak harus bergantung pada
pemotongan pendapatan pelaku industri. Monetisasi tumbuh seiring
meningkatnya jumlah event, tiket, pengguna profesional, transaksi
terlindungi, penggunaan intelligence, kebutuhan enterprise, dan
integrasi ekosistem.

Model ini dirancang untuk menghasilkan kombinasi:

-   **Recurring Revenue** melalui SaaS subscription dan enterprise
    licensing.
-   **Transactional Revenue** melalui ticketing, LivePass, settlement,
    dan payment infrastructure.
-   **Usage-Based Revenue** melalui OKKAX Intelligence dan komputasi
    tingkat lanjut.
-   **Visibility Revenue** melalui premium discovery dan sponsored
    inventory.
-   **Infrastructure Revenue** melalui API, hardware integration, dan
    partner ecosystem.

------------------------------------------------------------------------

# 2. Peta Revenue Stream

OKKAX memiliki tujuh mesin pendapatan utama yang saling terhubung:

  --------------------------------------------------------------------------------
  No.            Revenue Engine  Model Pendapatan  Pembayar Utama Sifat Pendapatan
  -------------- --------------- ----------------- -------------- ----------------
  1              Primary         Fee per tiket,    Audience,      Transactional
                 Ticketing &     lisensi           Organizer      
                 LivePass        validator,                       
                                 administrasi                     
                                 transfer                         

  2              Protected       Fixed tiered      Organizer,     Transactional
                 Payment &       infrastructure    pihak          
                 Settlement      fee, payment      transaksi      
                                 routing                          

  3              Multi-Role SaaS Langganan         7 role         Recurring
                 Subscription    bulanan/tahunan   profesional    

  4              OKKAX           Credits,          Profesional,   Usage-Based
                 Intelligence    compilation,      Organizer,     
                                 analytics report  Enterprise     

  5              Enterprise &    Lisensi, kontrak, Enterprise,    Recurring +
                 Institutional   implementation    pemerintah,    Contract
                 Solutions       fee               institusi      

  6              Premium         Placement,        Event, brand,  Visibility /
                 Discovery &     verification,     profesional    Marketplace
                 Sponsored       inventory                        
                 Inventory       services                         

  7              Developer &     API access,       Mitra          B2B
                 Partner API     integration,      teknologi,     Infrastructure
                 Ecosystem       infrastructure    hardware,      
                                 licensing         aggregator     
  --------------------------------------------------------------------------------

Ketujuh mesin ini membentuk model pendapatan berlapis. Pengguna dapat
memasuki ekosistem melalui produk gratis, kemudian menghasilkan
monetisasi ketika membutuhkan kapabilitas operasional, transaksi,
intelligence, distribusi, atau integrasi yang lebih tinggi.

------------------------------------------------------------------------

# 3. Revenue Engine 1 --- Primary Ticketing & LivePass

## 3.1 Posisi dalam Ekosistem

Ticketing merupakan salah satu mesin transaksi utama OKKAX karena berada
langsung pada titik konversi antara event dan audience.

OKKAX menyediakan infrastruktur dari penerbitan tiket sampai validasi
akses, bukan hanya halaman checkout.

Cakupannya meliputi:

-   ticket tier management;
-   inventory dan quota;
-   checkout;
-   pembayaran;
-   penerbitan e-ticket;
-   Dynamic QR LivePass;
-   transfer kepemilikan;
-   gate validation;
-   anti-duplicate validation;
-   attendance reconciliation;
-   settlement reporting.

## 3.2 Sumber Pendapatan

### Platform / Convenience Fee

Biaya tetap atau bertingkat yang dikenakan pada transaksi tiket.

Contoh struktur awal:

  Kelas Tiket                           Infrastructure Fee
  ----------------------------------- --------------------
  Tiket bernilai rendah                            Rp2.500
  Tiket reguler                                    Rp5.000
  Tiket premium                                    Rp7.500
  Tiket high-value / special access               Rp10.000

Nilai final dapat dikonfigurasi berdasarkan economics masing-masing
event tanpa mengubah prinsip transparansi biaya.

### LivePass & Gate Infrastructure

Pendapatan dari penggunaan sistem validasi akses, antara lain:

-   validator account;
-   scanner licensing;
-   multi-gate management;
-   offline verification;
-   fraud/duplicate detection;
-   attendance synchronization;
-   access analytics.

### Official Ticket Ownership Transfer

OKKAX dapat mengenakan biaya administrasi tetap untuk transfer
kepemilikan tiket melalui sistem resmi.

Tujuannya adalah menciptakan jalur transfer yang:

-   dapat diverifikasi;
-   memiliki audit trail;
-   mengurangi tiket palsu;
-   mengurangi transaksi informal;
-   menjaga validitas LivePass.

------------------------------------------------------------------------

# 4. Revenue Engine 2 --- Protected Payment & Settlement Infrastructure

## 4.1 Fungsi

Event memiliki transaksi yang jauh lebih kompleks daripada pembayaran
tiket.

Satu event dapat melibatkan:

-   talent;
-   venue;
-   vendor;
-   workforce;
-   tenant;
-   sponsor;
-   organizer;
-   supplier tambahan.

OKKAX menyediakan lapisan orkestrasi pembayaran agar kontrak, termin,
bukti pembayaran, status pekerjaan, dan pencairan dapat dilacak dalam
satu sistem.

## 4.2 Fixed Tiered Infrastructure Fee

OKKAX menggunakan **fixed tiered fee**, bukan mengambil persentase tanpa
batas dari nilai pekerjaan.

Contoh:

-   settlement kecil → fixed fee level 1;
-   settlement menengah → fixed fee level 2;
-   settlement besar → fixed fee level 3;
-   enterprise settlement → negotiated infrastructure pricing.

Struktur final harus mengikuti biaya aktual payment infrastructure,
risiko operasional, regulasi, dan partner settlement yang digunakan.

## 4.3 Payment Channel Routing

Pendapatan juga dapat berasal dari economics pemrosesan pembayaran
melalui:

-   QRIS;
-   Virtual Account;
-   kartu;
-   e-wallet;
-   transfer bank;
-   kanal pembayaran lain yang didukung.

OKKAX bertindak sebagai orchestration layer. Implementasi produksi harus
mengikuti regulasi pembayaran yang berlaku dan menggunakan mitra
pembayaran berizin jika fungsi tersebut membutuhkan penyelenggara jasa
pembayaran.

------------------------------------------------------------------------

# 5. Revenue Engine 3 --- Multi-Role SaaS Subscription

OKKAX memiliki tujuh kelompok pengguna profesional. Setiap role dapat
menggunakan platform secara gratis pada tingkat dasar dan meningkatkan
kapabilitas melalui paket berlangganan.

## 5.1 Struktur Harga Awal

  ------------------------------------------------------------------------------
  Role                 Free  Pro Bulanan  Pro Tahunan  Max Bulanan   Max Tahunan
  ------------ ------------ ------------ ------------ ------------ -------------
  Organizer /           Rp0     Rp99.000    Rp990.000    Rp199.000   Rp1.990.000
  Promoter                                                         

  Sponsor               Rp0     Rp99.000    Rp990.000    Rp199.000   Rp1.990.000

  Venue                 Rp0     Rp69.000    Rp690.000    Rp139.000   Rp1.390.000
  Management                                                       

  Vendor                Rp0     Rp59.000    Rp590.000    Rp119.000   Rp1.190.000
  Produksi                                                         

  Talent /              Rp0     Rp39.000    Rp390.000     Rp79.000     Rp790.000
  Musisi /                                                         
  Artis                                                            

  Tenant /              Rp0     Rp29.000    Rp290.000     Rp59.000     Rp590.000
  UMKM                                                             

  Workforce /           Rp0     Rp19.000    Rp190.000     Rp39.000     Rp390.000
  Crew                                                             
  ------------------------------------------------------------------------------

Harga di atas merupakan struktur produk yang dapat menjadi baseline.
Perubahan harga selanjutnya harus dilakukan berdasarkan
willingness-to-pay, usage data, conversion rate, retention, dan unit
economics.

## 5.2 Prinsip Tiering

### Free

Berfungsi sebagai pintu masuk network.

Tujuan:

-   membangun supply;
-   membangun demand;
-   memperbesar density network;
-   memungkinkan pengguna membuktikan nilai platform sebelum
    berlangganan.

### Pro

Ditujukan untuk profesional aktif yang membutuhkan:

-   kapasitas lebih besar;
-   operational tools;
-   analytics;
-   automation;
-   document generation;
-   collaboration;
-   visibility;
-   workflow yang lebih lengkap.

### Max

Ditujukan untuk pengguna dengan volume dan kompleksitas tinggi.

Kapabilitas dapat mencakup:

-   advanced intelligence;
-   higher limits;
-   portfolio analytics;
-   advanced automation;
-   priority processing;
-   enhanced reporting;
-   advanced collaboration;
-   premium support.

------------------------------------------------------------------------

# 6. Revenue Engine 4 --- OKKAX Intelligence

OKKAX Intelligence adalah lapisan komputasi yang mengubah data network
dan operasional menjadi rekomendasi yang dapat ditindaklanjuti.

Monetisasinya tidak hanya berbentuk subscription. Kapabilitas komputasi
bernilai tinggi dapat menggunakan model credit atau usage-based pricing.

## 6.1 Deep Matchmaking

Pengguna dapat membeli atau memperoleh credits untuk melakukan
pencocokan supply-demand tingkat lanjut berdasarkan kombinasi seperti:

-   lokasi;
-   tanggal;
-   availability;
-   kapasitas;
-   harga;
-   kategori;
-   kebutuhan teknis;
-   reputasi;
-   pengalaman;
-   kecocokan event;
-   historical performance.

## 6.2 AI Event Blueprint Compilation

Event brief dapat dikompilasi menjadi struktur operasional seperti:

**Brief → Requirements → Network Matching → Calendar → Budget →
Dependencies → Risk → Execution Blueprint**

Kapabilitas komputasi tingkat lanjut dapat menjadi bagian paket premium
atau dikenakan berdasarkan penggunaan.

## 6.3 Economic Ripple Simulation

OKKAX dapat mengembangkan laporan dampak ekonomi event, misalnya:

-   estimasi transaksi tenant/UMKM;
-   kebutuhan workforce;
-   okupansi akomodasi;
-   transportasi;
-   konsumsi lokal;
-   aktivitas vendor;
-   distribusi nilai ekonomi antaraktor.

Produk laporan ini relevan untuk:

-   organizer;
-   sponsor;
-   pemerintah daerah;
-   dinas pariwisata;
-   asosiasi industri;
-   pemilik venue;
-   enterprise.

Estimasi harus memiliki provenance, asumsi, metodologi, dan confidence
level yang jelas. Sistem tidak boleh menampilkan estimasi sebagai fakta
aktual apabila datanya bersifat prediktif.

------------------------------------------------------------------------

# 7. Revenue Engine 5 --- Enterprise & Institutional Solutions

Segmen enterprise ditujukan untuk organisasi yang mengelola banyak
event, venue, kota, atau unit operasional.

## 7.1 Multi-Event Portfolio Command Center

Kapabilitas dapat meliputi:

-   multi-event dashboard;
-   portfolio calendar;
-   cross-event resource allocation;
-   consolidated financial reporting;
-   centralized workforce;
-   centralized vendor network;
-   organization permissions;
-   approval workflow;
-   audit trail;
-   portfolio intelligence.

Baseline komersial dapat dimulai dari sekitar **Rp2.999.000 per bulan**,
kemudian berkembang menjadi kontrak tahunan atau harga kustom
berdasarkan skala implementasi.

## 7.2 Enterprise Security & Compliance

Kapabilitas premium dapat mencakup:

-   SSO/SAML;
-   granular access control;
-   extended audit logs;
-   security policy;
-   ERP/accounting integration;
-   dedicated support;
-   SLA;
-   custom data retention;
-   custom reporting.

## 7.3 Government, MICE & City-Level Infrastructure

OKKAX dapat dikembangkan sebagai operating infrastructure untuk:

-   festival kota;
-   event pemerintah;
-   MICE;
-   pameran;
-   konferensi;
-   event olahraga;
-   activation program;
-   tourism event portfolio.

Model pendapatan dapat berupa:

-   implementation fee;
-   annual license;
-   support contract;
-   infrastructure usage;
-   custom integration.

------------------------------------------------------------------------

# 8. Revenue Engine 6 --- Premium Discovery & Sponsored Inventory

Discovery harus tetap berguna secara organik. Monetisasi tidak boleh
membuat hasil pencarian kehilangan kredibilitas.

## 8.1 Featured Event Placement

Organizer dapat membeli visibilitas tambahan pada inventory tertentu,
seperti:

-   homepage;
-   Discover;
-   city discovery;
-   Live Event Map;
-   ticker;
-   category placement.

Semua placement berbayar harus ditandai dengan jelas sebagai
promoted/sponsored placement.

## 8.2 Professional Verification

Verified Pro dapat menjadi layanan verifikasi berbayar atau bagian dari
subscription.

Verifikasi tidak boleh berarti bahwa OKKAX menjamin kualitas pekerjaan.
Badge harus merepresentasikan ruang lingkup verifikasi yang benar-benar
dilakukan.

## 8.3 Sponsorship Inventory Marketplace

Event dapat menerbitkan inventory sponsorship seperti:

-   naming rights;
-   stage sponsorship;
-   booth;
-   digital exposure;
-   content integration;
-   hospitality;
-   merchandise collaboration;
-   experiential activation.

Monetisasi dapat menggunakan:

-   listing fee;
-   premium inventory tools;
-   fixed closing/infrastructure fee;
-   enterprise sponsorship workflow.

------------------------------------------------------------------------

# 9. Revenue Engine 7 --- Developer & Partner API Ecosystem

Ketika OKKAX berkembang menjadi infrastructure layer, sebagian nilai
ekonominya dapat dibuka melalui API dan integrasi B2B.

## 9.1 Access Hardware Integration

API dapat digunakan oleh:

-   QR scanner;
-   turnstile;
-   RFID wristband;
-   accreditation hardware;
-   access-control system.

Model komersial dapat berupa:

-   API subscription;
-   per-device license;
-   per-event integration;
-   enterprise contract.

## 9.2 Tourism & Distribution Integrations

Event inventory dapat dihubungkan dengan ekosistem:

-   hotel;
-   tourism platform;
-   transportation;
-   destination platform;
-   event aggregator;
-   travel ecosystem.

Potensi model pendapatan:

-   API access;
-   data distribution;
-   enterprise integration;
-   partner infrastructure agreement.

------------------------------------------------------------------------

# 10. Revenue Flywheel

Model bisnis OKKAX harus bekerja sebagai flywheel, bukan tujuh produk
pendapatan yang berdiri sendiri.

``` text
Lebih banyak Event
        ↓
Lebih banyak Talent, Venue, Vendor, Workforce, Sponsor & Tenant
        ↓
Network Density meningkat
        ↓
Matching dan Intelligence semakin bernilai
        ↓
Lebih banyak Event berhasil dieksekusi
        ↓
Lebih banyak Ticketing & LivePass
        ↓
Lebih banyak Payment & Settlement
        ↓
Lebih banyak Data Operasional
        ↓
Intelligence semakin kuat
        ↓
Retention & Subscription meningkat
        ↓
Enterprise Adoption meningkat
        ↓
Lebih banyak Event
```

Dengan struktur ini, **network density, transaction volume, operational
data, dan intelligence saling memperkuat**.

------------------------------------------------------------------------

# 11. Revenue Layer berdasarkan Customer Journey

  Tahap       Produk OKKAX                    Monetisasi
  ----------- ------------------------------- ---------------------------------
  Discover    Public Discovery, Map, Ticker   Sponsored Inventory
  Plan        Event Studio                    SaaS / Intelligence
  Source      Network                         SaaS / Deep Matchmaking
  Schedule    Calendar                        SaaS
  Contract    Document & Workflow Engine      SaaS / Enterprise
  Pay         Protected Settlement            Infrastructure Fee
  Sell        Ticketing                       Ticket Infrastructure Fee
  Enter       LivePass                        Gate / Validator Infrastructure
  Operate     Event Operations                SaaS / Enterprise
  Analyze     OKKAX Intelligence              Credits / Premium Analytics
  Scale       Portfolio Command Center        Enterprise License
  Integrate   API Ecosystem                   B2B Infrastructure

------------------------------------------------------------------------

# 12. Pendapatan yang Tidak Boleh Menjadi Model Inti

Untuk menjaga posisi OKKAX sebagai infrastructure partner, model berikut
tidak boleh menjadi fondasi ekonomi utama:

1.  persentase komisi dari honor talent;
2.  persentase komisi dari upah workforce;
3.  persentase komisi dari jasa vendor produksi;
4.  persentase komisi dari sewa venue;
5.  hidden fee yang tidak terlihat sebelum transaksi;
6.  monetisasi yang membuat ranking organik menjadi pay-to-win tanpa
    disclosure;
7.  penjualan data pribadi pengguna;
8.  monetisasi yang menciptakan konflik kepentingan dengan keberhasilan
    pengguna.

------------------------------------------------------------------------

# 13. Economic Characteristics

## Recurring Revenue

SaaS dan enterprise licensing menciptakan basis MRR dan ARR yang lebih
dapat diprediksi.

## Transactional Upside

Ticketing, LivePass, settlement, dan payment infrastructure membuat
pendapatan meningkat seiring aktivitas ekonomi yang melewati network.

## Usage-Based Expansion

Intelligence memungkinkan monetisasi pengguna dengan kebutuhan komputasi
lebih tinggi tanpa harus menaikkan harga untuk seluruh pengguna.

## Network Effects

Pertumbuhan supply dan demand meningkatkan nilai matching, discovery,
dan intelligence.

## Low Marginal Software Cost

Setelah infrastructure matang, peningkatan jumlah pengguna, event, dan
transaksi tidak harus meningkatkan biaya secara linear.

## Revenue Diversification

OKKAX tidak bergantung pada satu sumber pendapatan. Risiko dapat
tersebar antara subscription, transaction, enterprise, intelligence,
discovery, dan API.

------------------------------------------------------------------------

# 14. North-Star Economic Logic

OKKAX tidak seharusnya memaksimalkan **take rate atas pekerjaan
manusia**.

OKKAX harus memaksimalkan:

-   jumlah event yang berhasil dioperasikan;
-   jumlah profesional aktif dalam network;
-   ticket volume;
-   protected transaction volume;
-   subscription retention;
-   intelligence usage;
-   enterprise adoption;
-   API/integration usage;
-   event completion rate;
-   network density antar kota.

Secara konseptual:

``` text
OKKAX Revenue
=
Recurring SaaS Revenue
+ Ticketing Infrastructure Revenue
+ LivePass Revenue
+ Settlement Infrastructure Revenue
+ Intelligence Revenue
+ Enterprise Revenue
+ Discovery Revenue
+ API & Partner Revenue
```

Bukan:

``` text
OKKAX Revenue
=
Persentase dari Honor Talent
+ Persentase dari Upah Workforce
+ Persentase dari Jasa Vendor
+ Persentase dari Sewa Venue
```

------------------------------------------------------------------------

# 15. Strategic Positioning

OKKAX harus diposisikan sebagai:

> **Operating and economic infrastructure for the live-event
> ecosystem.**

Bukan hanya:

-   marketplace talent;
-   marketplace vendor;
-   ticketing platform;
-   event calendar;
-   event management software;
-   AI event planner.

Seluruh produk tersebut merupakan bagian dari satu operating network.

Posisi strategis ini memungkinkan OKKAX memperoleh pendapatan di
berbagai titik rantai nilai tanpa harus mengambil bagian langsung dari
honor dan upah para pelaku event.

------------------------------------------------------------------------

# 16. Konstitusi Revenue OKKAX

Setiap revenue stream baru yang dikembangkan harus memenuhi lima
pertanyaan:

1.  **Value Creation** --- Nilai baru apa yang benar-benar diciptakan
    OKKAX?
2.  **Transparency** --- Apakah pengguna mengetahui biaya sebelum
    melakukan transaksi?
3.  **Alignment** --- Apakah OKKAX memperoleh pendapatan karena membantu
    pengguna berhasil?
4.  **Scalability** --- Apakah model dapat tumbuh lintas event, kota,
    dan negara?
5.  **Fairness** --- Apakah model menjaga prinsip bahwa OKKAX
    memonetisasi infrastructure, bukan mengeksploitasi pendapatan kerja
    manusia?

Jika sebuah revenue stream gagal memenuhi prinsip-prinsip tersebut,
model tersebut tidak boleh menjadi bagian inti dari arsitektur
monetisasi OKKAX.

------------------------------------------------------------------------

## Pernyataan Akhir

**OKKAX monetizes the infrastructure that makes live events possible:
coordination, intelligence, transactions, access, distribution, and
enterprise operations.**

Pertumbuhan ekonomi OKKAX harus mengikuti pertumbuhan dan keberhasilan
ekosistem yang dilayaninya. Semakin banyak event yang dapat
direncanakan, dibiayai, diisi, dijadwalkan, dijual, diakses, dan
diselesaikan melalui satu network, semakin besar nilai ekonomi platform
tanpa harus mengurangi nilai kerja talent, vendor, venue, maupun
workforce.
