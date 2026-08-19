# OKKAX MEMBER DASHBOARD MASTER ARCHITECTURE

**Status:** Locked Product Architecture Reference  
**Domain:** OKKAX Member Dashboard  
**Purpose:** Single source of truth untuk struktur menu, submenu, fungsi utama, dan deskripsi detail seluruh role member OKKAX.

---

# 1. ORGANIZER

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Operational Summary | Executive command view | Menampilkan kondisi event aktif dalam satu layar: progress, ticket sales, budget utilization, network readiness, upcoming deadlines, unresolved issues, approval, settlement, dan aktivitas terbaru. Tujuannya agar organizer mengetahui kondisi event tanpa membuka banyak modul. |
|  | Priority Tasks | Pusat tindakan prioritas | Mengumpulkan pekerjaan yang membutuhkan tindakan organizer seperti approval quotation, kontrak menunggu persetujuan, pembayaran jatuh tempo, requirement belum terpenuhi, konflik jadwal, dan masalah operasional. Setiap item harus memiliki severity, deadline, event terkait, owner, dan CTA langsung. |
|  | Upcoming Deadlines | Deadline control | Menampilkan seluruh deadline penting seperti pembayaran talent, venue confirmation, permit, produksi, marketing launch, ticket sales phase, technical meeting, load-in, soundcheck, dan event day. |
|  | Event Health | Early-warning system | Memberikan health score per event berdasarkan budget, schedule, ticket sales, resource readiness, outstanding requirements, contract, dan operational risk. Bukan dekorasi AI, tetapi indikator yang dapat ditelusuri ke data sumber. |
| **Event Studio** | Event → Brief | Event definition | Menentukan fondasi event: nama, konsep, kategori, tujuan, kota, venue preference, tanggal, kapasitas, target audience, budget ceiling, revenue target, format event, dan informasi penting lainnya. |
|  | Event → Identity & Details | Identitas event | Mengelola nama resmi, description, artwork, organizer identity, event code, venue, address, dates, opening hours, contact information, legal information, dan metadata publik. |
|  | Event → Audience | Audience planning | Mendefinisikan target audience, segmentasi, estimated attendance, capacity, demographic/interest assumptions, geographic reach, dan demand target sebagai input ticketing, sponsor, venue, serta marketing. |
|  | Event → Budget | Budget planning | Mengelola budget ceiling, allocation per kategori, committed cost, estimated cost, actual cost, contingency, projected revenue, variance, dan break-even sehingga keputusan event memiliki dasar finansial. |
|  | Event → Requirements | Requirement engine | Daftar seluruh kebutuhan event: talent, venue, stage, sound, lighting, security, medical, workforce, permit, transport, accommodation, catering, documentation, sponsorship, ticketing, dan kebutuhan lainnya. Setiap requirement memiliki priority, owner, status, deadline, budget, dependency, dan supplier. |
|  | Event → Teams | Event organization | Membentuk struktur tim event: event director, project manager, production, ticketing, finance, sponsorship, marketing, security, liaison officer, stage management, dan posisi lain. Setiap anggota memiliki role, responsibility, permission, assignment, dan accountability. |
|  | Event → Blueprint | Event master plan | Menggabungkan Brief, Requirements, Network, Budget, Team, Calendar, Deals, Ticketing, dan dependencies menjadi satu operational blueprint yang menjadi single source of truth event. |
|  | Network → Talent | Talent orchestration | Mencari, shortlist, membandingkan, mengundang, melakukan booking, melihat availability, fee range, rider, rating, kontrak, dan status talent yang terkait dengan event aktif. |
|  | Network → Venue | Venue orchestration | Menyeleksi venue berdasarkan kapasitas, lokasi, availability, fasilitas, technical specification, harga, curfew, accessibility, dan kecocokan dengan kebutuhan event. |
|  | Network → Vendor | Vendor procurement | Mengelola kebutuhan vendor seperti production, sound, lighting, LED, stage, decoration, documentation, catering, transport, equipment, security provider, dan kategori pendukung lainnya. |
|  | Network → Workforce | Workforce allocation | Mencari dan menugaskan crew berdasarkan skill, availability, lokasi, rate, certification, work history, rating, dan kebutuhan shift event. |
|  | Network → Sponsor | Sponsorship orchestration | Mencari sponsor yang relevan, membuat sponsorship inventory, mengirim proposal, menerima interest, melakukan negosiasi, mengelola rights dan memastikan sponsorship deliverables terpenuhi. |
|  | Network → Tenant | Tenant management | Mengelola tenant F&B, merchandise, UMKM, exhibition booth, pop-up store atau kategori tenant lain apabila karakter event membutuhkan tenant. |
|  | Calendar → Schedule | Event scheduling | Menampilkan aktivitas event secara kalender dengan owner, waktu, status, location, dan hubungan terhadap workstream event. |
|  | Calendar → Timeline | Master timeline | Menampilkan perjalanan event dari planning sampai post-event dalam chronological timeline sehingga organizer dapat memahami keseluruhan execution flow. |
|  | Calendar → Dependencies | Dependency control | Memetakan pekerjaan yang tidak dapat dimulai sebelum pekerjaan lain selesai, misalnya venue confirmation sebelum production layout final. |
|  | Calendar → Deadlines | Deadline monitoring | Mengonsolidasikan seluruh deadline dari requirement, deal, payment, ticketing, sponsor, production dan operations. |
|  | Calendar → Conflicts | Conflict detection | Mendeteksi benturan talent, venue, workforce, resource, timeline, booking, setup, load-in, soundcheck, dan jadwal penting lainnya. |
| **Ticketing** | Ticket Maker | Ticket generation | Membuat tiket dengan QR Code, barcode dan identifier unik yang dapat divalidasi serta dikaitkan dengan order, event, tier dan pemilik tiket. |
|  | Ticket Designer | Ticket visual system | Mendesain tiket digital maupun fisik dengan identitas event, organizer, tier, seat/zone, barcode/QR, terms, sponsor, dan informasi akses. |
|  | Ticket Tiers | Ticket product management | Membuat Regular, VIP, VVIP, Presale, Early Bird, OTS, Group, One Day Pass, Multi-Day Pass, complimentary dan custom tier beserta harga, kuota, periode penjualan, benefits dan purchase limits. |
|  | Inventory | Capacity control | Mengelola total capacity, allocation, reserved inventory, sold, available, hold, complimentary, partner allocation dan quota setiap ticket tier. |
|  | Sales | Sales monitoring | Menampilkan unit sold, GMV, net revenue, conversion, velocity, sales channel, ticket tier performance dan progress terhadap break-even/target. |
|  | Orders | Transaction management | Menampilkan order, buyer, quantity, payment status, ticket issuance, cancellation, refund dan audit trail. |
|  | Distribution | Controlled distribution | Mengelola invitation, complimentary ticket, sponsor allocation, media, crew, guest list, artist allocation dan partner distribution tanpa merusak inventory control. |
|  | Validation | Access management | Mengatur gate, validator, QR/barcode scanning, validation status, duplicate detection, offline handling dan access zone. |
|  | Refund & Transfer | Post-purchase management | Mengelola refund sesuai policy, cancellation, reschedule dan transfer kepemilikan tiket dengan audit trail. |
|  | Analytics | Ticket intelligence | Menganalisis sales velocity, tier performance, purchase patterns, attendance conversion, revenue, refund rate dan gate utilization. |
| **Live Operations** | Command Center | Show-day command | Mengubah dashboard menjadi pusat operasi hari-H dengan status gate, attendance, crew, schedule, incidents, venue occupancy, technical issue dan escalation. |
|  | Gate Monitor | Entrance monitoring | Monitoring scan rate, accepted/rejected ticket, duplicate scan, gate throughput, queue dan abnormal access secara real-time. |
|  | Attendance | Occupancy control | Membandingkan tiket terjual dengan check-in aktual serta kapasitas venue untuk memberikan occupancy awareness. |
|  | Team Status | Personnel readiness | Menampilkan crew on-duty, checked-in, absent, assigned position dan operational availability. |
|  | Incident Center | Incident management | Mencatat incident, severity, location, timestamp, responsible team, escalation, resolution dan audit trail. |
|  | Live Timeline | Real-time rundown | Menampilkan actual execution dibandingkan planned schedule agar keterlambatan atau perubahan rundown cepat terlihat. |
| **Opportunities** | Invitations | Collaboration requests | Menampung invitation dari talent, vendor, sponsor, venue, partner atau pihak lain sebelum hubungan komunikasi profesional dibuka. |
|  | Incoming Opportunities | Business opportunities | Menampilkan partnership, sponsorship, supplier, venue dan opportunity lain yang relevan terhadap portfolio organizer. |
| **Deals** | Offers | Commercial proposal | Mengelola seluruh penawaran komersial yang masuk/keluar dan menghubungkannya dengan event serta counterpart. |
|  | Negotiations | Structured negotiation | Menyimpan perubahan harga, scope, deliverables, terms, counter-offer dan keputusan sehingga negosiasi tidak tercecer di email/chat. |
|  | Agreements | Accepted terms | Menyimpan hasil negosiasi yang telah disepakati sebelum/bersama proses kontrak formal. |
|  | Contracts | Contract management | Mengelola kontrak, pihak terkait, nilai, tanggal, terms, attachment, signature status dan kewajiban kontraktual. |
|  | Milestones | Commercial milestones | Menghubungkan pekerjaan dengan deliverable dan termin pembayaran sehingga pembayaran mengikuti progress yang dapat diverifikasi. |
| **Finance** | Overview | Financial command center | Memberikan gambaran budget, revenue, expense, payable, receivable, protected funds, upcoming settlement dan financial variance seluruh event. |
|  | Protected Balance | Protected fund visibility | Menampilkan dana yang sedang berada dalam mekanisme protected settlement dan alasan dana belum dapat dicairkan. |
|  | Payables | Accounts payable | Menampilkan kewajiban pembayaran kepada talent, vendor, workforce, venue dan pihak lainnya. |
|  | Receivables | Accounts receivable | Menampilkan pendapatan atau pembayaran yang belum diterima dari sponsor, partner, ticket settlement dan counterpart lainnya. |
|  | Payout Schedule | Settlement planning | Menampilkan siapa menerima pembayaran, nominal, milestone, due date, status approval dan settlement status. |
|  | Transactions | Financial ledger | Ledger seluruh transaksi dengan event, counterpart, category, reference, amount, status dan timestamp. |
|  | Invoices | Invoice management | Membuat, menerima, mengirim dan memantau invoice yang berhubungan dengan event. |
|  | Tax | Tax management | Menyediakan breakdown pajak dan dokumen pendukung berdasarkan transaksi dan kebijakan perpajakan yang berlaku. |
|  | Reports | Financial reporting | Menghasilkan laporan event budget vs actual, cashflow, settlement, revenue, expense dan export untuk kebutuhan administrasi. |
| **Intelligence** | Event Intelligence | Decision support | Mengidentifikasi risiko, bottleneck, kesiapan dan peluang optimasi berdasarkan data aktual event. |
|  | Network Intelligence | Resource intelligence | Memberikan ranking/matching resource berdasarkan requirement, lokasi, availability, budget, reputation dan kecocokan event. |
|  | Financial Intelligence | Financial forecasting | Memproyeksikan cost pressure, cash-flow gap, break-even dan potensi budget overrun. |
|  | Audience Intelligence | Demand intelligence | Membantu memahami demand, segmentasi dan performa audience berdasarkan data yang tersedia. |
|  | Scenario Simulation | What-if analysis | Membandingkan skenario seperti perubahan kapasitas, ticket price, talent, venue, sponsor atau budget sebelum keputusan dibuat. |
| **Settings** | Organization | Organization identity | Mengatur identitas perusahaan/organisasi yang menjadi basis workspace, invoice, kontrak dan dokumen resmi. |
|  | Members & Teams | Organization membership | Mengundang anggota dan mengatur struktur organisasi. |
|  | Roles & Permissions | Access control | Menentukan siapa boleh melihat, membuat, menyetujui atau mengubah data tertentu. |
|  | Payments & Payouts | Financial destination | Mengatur rekening bank, payout destination dan informasi settlement. |
|  | Billing | OKKAX subscription | Mengelola paket, billing cycle, invoice subscription dan usage. |
|  | Documents & Branding | Document identity | Mengatur logo, legal identity, signature, footer dan template sehingga dokumen OKKAX tidak terlihat generik. |
|  | Integrations | Connected systems | Mengelola integrasi payment, accounting, calendar atau layanan eksternal yang didukung. |
|  | Security | Account protection | Password, MFA, active session, trusted devices dan security activity. |

---

# 2. PROMOTER

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Portfolio Summary | Multi-event command center | Menampilkan seluruh portfolio event, status produksi, revenue, ticketing, budget, sponsorship, outstanding action dan event health dalam satu executive view. |
|  | Priority Tasks | Portfolio action center | Mengurutkan pekerjaan lintas event berdasarkan urgency, financial impact, deadline dan operational risk. |
|  | Portfolio Performance | Business performance | Membandingkan event berdasarkan revenue, ticket sales, profitability, readiness, attendance dan performa komersial. |
| **Event Studio** | Event | Event orchestration | Seluruh proses perencanaan event dari Brief, Identity, Audience, Budget, Requirements, Teams sampai Blueprint. |
|  | Network | Supply orchestration | Menghubungkan event dengan Talent, Venue, Vendor, Workforce, Sponsor dan Tenant yang diperlukan. |
|  | Calendar | Portfolio execution | Schedule, Timeline, Dependencies, Deadlines dan Conflicts untuk menjaga eksekusi event tepat waktu. |
| **Ticketing** | Ticket Maker | Ticket infrastructure | Membuat tiket dan identifier yang dapat divalidasi. |
|  | Ticket Designer | Ticket presentation | Membuat desain tiket sesuai identitas masing-masing event. |
|  | Ticket Tiers | Product architecture | Mengelola kelas tiket, harga, benefits, quota dan sales period. |
|  | Inventory | Capacity management | Mengontrol kapasitas dan distribusi inventory. |
|  | Sales | Revenue monitoring | Membandingkan performa penjualan lintas event/channel. |
|  | Orders | Order operations | Mengelola transaksi pembeli. |
|  | Distribution | Allocation control | Mengelola guest, sponsor, partner dan complimentary allocation. |
|  | Validation | Access infrastructure | Mengatur gate dan validasi tiket. |
|  | Refund & Transfer | Customer transaction service | Mengelola refund dan ticket ownership transfer. |
|  | Analytics | Portfolio ticket analytics | Membandingkan sales velocity, tier dan attendance lintas event. |
| **Live Operations** | Command Center | Multi-event live monitoring | Monitoring event yang sedang berlangsung dan mengarahkan perhatian pada event yang mengalami masalah. |
|  | Gate Monitor | Access performance | Monitoring throughput dan ticket validation. |
|  | Attendance | Crowd visibility | Melihat attendance dan occupancy aktual. |
|  | Incident Center | Operational escalation | Mengelola incident dan escalation selama event berlangsung. |
| **Opportunities** | Event Opportunities | Pipeline event | Menyimpan peluang event baru yang berpotensi masuk ke portfolio promoter. |
|  | Partnership | Strategic partnerships | Mengelola peluang venue, sponsor, institutional dan strategic partnership. |
| **Deals** | Offers | Commercial pipeline | Mengelola penawaran komersial lintas event. |
|  | Negotiations | Deal negotiation | Mengelola term, harga dan counter-offer. |
|  | Contracts | Legal commitment | Mengelola kontrak dan kewajiban pihak terkait. |
|  | Milestones | Execution-linked payment | Menghubungkan pekerjaan, deliverable dan pembayaran. |
| **Finance** | Portfolio Finance | Financial portfolio | Menggabungkan kondisi finansial seluruh event yang dikelola promoter. |
|  | Protected Balance | Fund protection | Memantau dana yang belum memasuki tahap settlement. |
|  | Payables | Payment obligations | Kewajiban pembayaran lintas event. |
|  | Receivables | Incoming funds | Dana sponsor, partner, ticketing atau sumber lain yang belum diterima. |
|  | Settlement | Fund settlement | Monitoring pencairan dan settlement. |
|  | Reports | Management reporting | Laporan finansial per event maupun portfolio. |
| **Intelligence** | Portfolio Intelligence | Portfolio decision engine | Membandingkan health, risk dan opportunity seluruh event. |
|  | Market Intelligence | Market opportunity | Mengidentifikasi opportunity berdasarkan kota, kategori, demand dan network. |
|  | Financial Intelligence | Portfolio forecasting | Forecast revenue, cash requirement dan financial exposure. |
| **Settings** | Organization | Corporate identity | Profil promoter dan legal entity. |
|  | Members | Team management | Mengelola anggota organisasi. |
|  | Roles & Permissions | Governance | Hak akses lintas portfolio. |
|  | Billing | Subscription | Paket OKKAX organisasi. |
|  | Integrations | External systems | Integrasi sistem pihak ketiga. |
|  | Security | Security management | Proteksi akun dan organisasi. |

---

# 3. ARTIST / TALENT / BAND

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Career Summary | Professional command center | Menampilkan booking aktif, show berikutnya, pending offer, contract, rider, payment dan pendapatan dalam satu layar. |
|  | Next Show | Show readiness | Countdown dan checklist event terdekat: venue, call time, soundcheck, travel, accommodation, rider dan contact person. |
|  | Pending Actions | Required actions | Kontrak belum ditandatangani, rider belum disetujui, offer menunggu jawaban, atau pembayaran yang memerlukan tindakan. |
| **Opportunities** | Booking Requests | Incoming booking | Permintaan tampil yang dikirim Organizer/Promoter lengkap dengan event, tanggal, venue, fee, scope dan status. |
|  | Invitations | Professional invitation | Invitation untuk event, collaboration, appearance atau aktivitas profesional lainnya. |
|  | Recommended Opportunities | Opportunity matching | Menampilkan opportunity berdasarkan genre/category, lokasi, fee expectation dan availability. |
| **Bookings** | Requests | Booking pipeline | Booking yang masih menunggu keputusan. |
|  | Confirmed | Confirmed engagement | Booking yang telah disetujui dengan informasi event dan kontrak. |
|  | Completed | Work history | Riwayat pertunjukan yang telah selesai. |
|  | Cancelled | Cancellation records | Booking yang dibatalkan beserta alasan dan status settlement. |
| **Calendar** | Availability | Availability management | Talent/management membuka atau menutup tanggal untuk booking. |
|  | Confirmed Shows | Performance schedule | Seluruh jadwal pertunjukan yang sudah confirmed. |
|  | Blocked Dates | Protected dates | Tanggal yang tidak dapat menerima booking karena aktivitas pribadi, travel atau commitment lain. |
| **Rider** | Technical Rider | Technical requirements | Input stage, sound, backline, microphone, lighting, power dan technical requirement lainnya. |
|  | Hospitality Rider | Hospitality requirements | Dressing room, catering, security, credential dan kebutuhan hospitality. |
|  | Travel | Travel requirements | Flight, ground transport, airport transfer dan travel party. |
|  | Accommodation | Lodging requirements | Hotel, room type, room quantity, check-in/out dan kebutuhan akomodasi. |
| **Deals** | Offers | Fee proposal | Menampilkan fee, scope dan term yang ditawarkan. |
|  | Negotiations | Commercial negotiation | Counter-offer dan perubahan term tercatat secara profesional. |
|  | Contracts | Contract management | Kontrak performance dan status signature. |
|  | Milestones | Payment milestones | DP, pelunasan dan deliverable terkait pembayaran. |
| **Wallet** | Balance | Financial balance | Ringkasan pendapatan yang tersedia. |
|  | Pending | Pending earnings | Dana yang belum memenuhi syarat pencairan. |
|  | Protected | Protected earnings | Dana yang telah dibayar pihak organizer tetapi masih dalam mekanisme perlindungan settlement. |
|  | Payouts | Payout history | Riwayat dana yang telah dicairkan. |
|  | Withdrawal | Fund withdrawal | Mengirim dana tersedia ke bank/e-wallet yang didukung. |
| **Performance** | Booking Analytics | Career analytics | Frekuensi booking, kota, kategori event dan perkembangan aktivitas. |
|  | Earnings | Income analytics | Pendapatan berdasarkan periode dan event. |
|  | Ratings & Reviews | Professional reputation | Feedback dari counterpart setelah pekerjaan selesai. |
| **Settings** | Professional Profile | Public professional identity | Profil talent, genre/category, bio, portfolio, rate guidance dan management contact. |
|  | Members | Band/management access | Mengatur personel dan management yang memiliki akses workspace. |
|  | Availability | Booking preferences | Default availability dan booking rules. |
|  | Payments & Payouts | Payout destination | Bank/e-wallet tujuan pencairan. |
|  | Documents | Professional documents | Contract template, rider, legal dan dokumen pendukung. |
|  | Security | Account protection | Password, MFA, session dan device. |

---

# 4. WORKFORCE

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Work Summary | Personal work dashboard | Menampilkan job, shift, income, rating, pending action dan pekerjaan berikutnya. |
|  | Next Assignment | Next-job readiness | Lokasi, call time, supervisor, job description, credential dan requirement pekerjaan berikutnya. |
|  | Pending Actions | Required actions | Contract, attendance confirmation, work proof dan pekerjaan administratif yang belum selesai. |
| **Jobs** | Available Jobs | Event job marketplace | Menampilkan lowongan crew berdasarkan skill, lokasi, tanggal, rate dan event. |
|  | Recommended Jobs | Job matching | Ranking pekerjaan berdasarkan profil, experience, availability dan lokasi. |
|  | Invitations | Direct hiring | Undangan langsung dari organizer/vendor yang harus diterima sebelum hubungan kerja aktif. |
| **My Assignments** | Upcoming | Upcoming work | Pekerjaan yang sudah dikonfirmasi. |
|  | Active | Current assignment | Pekerjaan yang sedang berlangsung. |
|  | Completed | Work history | Riwayat pekerjaan selesai dan pembayaran terkait. |
| **Calendar** | Availability | Work availability | Menentukan tanggal dan jam tersedia. |
|  | Shifts | Shift schedule | Jadwal shift, call time, break dan end time. |
|  | Blocked Dates | Unavailable time | Tanggal yang tidak dapat menerima pekerjaan. |
| **Check-in** | Upcoming Check-in | Attendance preparation | Lokasi check-in, waktu dan credential assignment. |
|  | Attendance | Attendance verification | Mencatat hadir, mulai shift dan selesai shift. |
|  | Work Proof | Completion evidence | Bukti pekerjaan untuk milestone/settlement ketika diperlukan. |
| **Wallet** | Earnings | Earnings summary | Total pendapatan dari pekerjaan OKKAX. |
|  | Pending | Pending payment | Pembayaran menunggu approval atau milestone. |
|  | Protected | Protected payment | Dana yang sudah tersedia tetapi masih dilindungi sampai syarat pekerjaan terpenuhi. |
|  | Available | Withdrawable funds | Dana yang dapat dicairkan. |
|  | Withdrawal | Payout | Pencairan ke rekening/e-wallet. |
| **Performance** | Rating | Reputation | Penilaian profesional dari pekerjaan selesai. |
|  | Completion Rate | Reliability | Persentase pekerjaan yang diselesaikan sesuai commitment. |
|  | Work History | Professional record | Riwayat event, posisi, jam kerja dan counterpart. |
| **Documents** | Work Orders | Assignment documentation | Dokumen penugasan formal. |
|  | Agreements | Employment/project agreement | Persetujuan scope dan terms pekerjaan. |
|  | Payment Proof | Financial records | Bukti pembayaran pekerjaan. |
| **Settings** | Professional Profile | Workforce identity | Skill, pengalaman, lokasi, portfolio dan rate. |
|  | Skills | Competency profile | Skill, sertifikasi dan qualification. |
|  | Availability | Work preference | Waktu, lokasi dan tipe pekerjaan yang diinginkan. |
|  | Payout Methods | Payment destination | Rekening/e-wallet pencairan. |
|  | Security | Account protection | Keamanan akun. |

---

# 5. VENDOR

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Business Summary | Vendor command center | Menampilkan project pipeline, quotation, active project, receivable, capacity dan operational alerts. |
| **Opportunities** | RFQ | Request for quotation | Permintaan quotation terstruktur dari organizer/promoter. |
|  | Project Requests | Incoming work | Permintaan layanan yang membutuhkan response vendor. |
|  | Recommended Opportunities | Business matching | Event yang cocok berdasarkan service category, location, availability dan capacity. |
| **Projects** | Upcoming | Upcoming projects | Project yang telah confirmed tetapi belum dimulai. |
|  | Active | Current projects | Project berjalan, milestone, crew, equipment dan deliverable. |
|  | Completed | Project history | Project selesai dan settlement terkait. |
| **Services & Inventory** | Services | Service catalog | Daftar layanan yang dapat dibeli organizer. |
|  | Equipment | Asset inventory | Peralatan, quantity, availability dan specification. |
|  | Capacity | Resource capacity | Kemampuan menangani pekerjaan pada periode tertentu. |
|  | Pricing | Commercial catalog | Harga/rate card layanan dan equipment. |
| **Calendar** | Availability | Resource calendar | Ketersediaan perusahaan, crew dan equipment. |
|  | Booked | Allocated resources | Resource yang sudah dialokasikan ke project. |
| **Deals** | Quotes | Structured quotation | Membuat dan mengelola quotation profesional. |
|  | Negotiations | Commercial negotiation | Perubahan harga, scope dan terms. |
|  | Contracts | Contract management | Kontrak pekerjaan. |
|  | Milestones | Deliverable management | Progress pekerjaan yang menjadi dasar approval dan settlement. |
| **Wallet** | Receivables | Incoming money | Total pembayaran yang harus diterima. |
|  | Protected | Protected settlement | Dana yang telah dialokasikan tetapi belum memenuhi syarat pencairan. |
|  | Available | Available balance | Dana siap dicairkan. |
|  | Payouts | Settlement history | Riwayat pembayaran dan payout. |
| **Documents** | Quotations | Commercial documents | Quotation yang dapat menggunakan branding perusahaan vendor. |
|  | Invoices | Billing documents | Invoice kepada client. |
|  | Contracts | Legal documents | Contract archive. |
|  | Tax Documents | Tax administration | Dokumen pajak terkait transaksi. |
| **Performance** | Revenue | Business analytics | Revenue berdasarkan event, service dan periode. |
|  | Completion | Operational performance | Ketepatan penyelesaian project dan milestone. |
|  | Ratings & Reviews | Reputation | Reputasi berdasarkan project selesai. |
| **Settings** | Company Profile | Vendor identity | Identitas dan profil perusahaan. |
|  | Members | Team access | User dan permission internal vendor. |
|  | Services | Catalog configuration | Konfigurasi layanan dan kategori. |
|  | Payments | Financial destination | Rekening pembayaran. |
|  | Documents & Branding | Brand configuration | Logo dan template dokumen. |
|  | Security | Account security | Proteksi akun organisasi. |

---

# 6. SPONSOR

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Sponsorship Summary | Sponsorship command center | Menampilkan proposal, active sponsorship, commitment, activation, deliverables, expenditure dan campaign performance. |
| **Discover Events** | Recommended | Event discovery | Event yang sesuai dengan kategori brand dan sponsorship objective. |
|  | Categories | Category exploration | Mencari opportunity berdasarkan musik, olahraga, lifestyle, conference dan kategori lainnya. |
|  | Audience Match | Audience alignment | Membandingkan karakter audience event dengan target audience brand berdasarkan data tersedia. |
| **Opportunities** | Sponsorship Inventory | Commercial inventory | Daftar rights dan inventory sponsorship yang dapat dibeli. |
|  | Naming Rights | Premium rights | Opportunity title/naming sponsorship. |
|  | Stage & Media | Exposure inventory | Stage branding, LED, media placement dan exposure. |
|  | Booth & Activation | Physical activation | Booth, sampling, experience zone dan activation. |
| **Proposals** | Incoming | Organizer proposals | Proposal sponsorship yang dikirim organizer/promoter. |
|  | Outgoing | Sponsor initiatives | Proposal atau expression of interest yang dikirim sponsor. |
| **Deals** | Negotiations | Commercial negotiation | Negosiasi nilai, rights dan deliverables. |
|  | Agreements | Agreed sponsorship | Terms yang sudah disepakati. |
|  | Contracts | Legal agreement | Kontrak sponsorship. |
|  | Commitments | Commitment tracking | Dana maupun in-kind commitment yang harus dipenuhi. |
| **Activations** | Branding | Brand exposure | Semua placement identitas brand. |
|  | Booth | Physical presence | Booth dan brand experience. |
|  | Media | Media deliverables | Media exposure yang dijanjikan. |
|  | Digital | Digital rights | Social, streaming dan digital activation. |
|  | Deliverables | Rights fulfillment | Memastikan seluruh sponsorship rights benar-benar diberikan. |
| **Portfolio** | Active | Active sponsorships | Semua sponsorship berjalan. |
|  | Completed | Historical portfolio | Campaign selesai untuk benchmarking. |
| **Finance** | Commitments | Financial commitments | Total dana sponsorship committed. |
|  | Invoices | Sponsorship billing | Invoice terkait sponsorship. |
|  | Payments | Payment status | Pembayaran yang telah atau belum dilakukan. |
| **Analytics** | Reach | Exposure analytics | Estimasi/aktual reach berdasarkan data yang tersedia. |
|  | Audience | Audience insights | Profil audience event. |
|  | Delivery | Fulfillment analytics | Persentase hak sponsorship yang telah diberikan. |
|  | ROI | Sponsorship effectiveness | Menghubungkan biaya dengan exposure dan KPI yang tersedia tanpa mengklaim metrik yang tidak dapat diverifikasi. |
| **Reports** | Campaign Reports | Executive reporting | Laporan campaign untuk stakeholder internal sponsor. |
|  | Proof of Delivery | Evidence repository | Foto, video, log dan bukti fulfillment sponsorship. |
| **Settings** | Brand Profile | Brand identity | Identitas dan informasi brand. |
|  | Team | Sponsorship team | Anggota dan permission. |
|  | Preferences | Matching preferences | Target audience, event category, geography dan sponsorship interest. |
|  | Billing | OKKAX billing | Subscription dan invoice. |
|  | Security | Account security | Proteksi akun organisasi. |

---

# 7. TENANT

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Overview** | Tenant Summary | Business overview | Menampilkan application, booking, upcoming event, payment dan action penting. |
| **Discover Events** | Available Events | Tenant opportunity | Event yang sedang menerima aplikasi tenant. |
|  | Recommended | Opportunity matching | Event yang relevan dengan kategori usaha, lokasi dan availability tenant. |
| **Applications** | Draft | Application preparation | Aplikasi booth yang belum dikirim. |
|  | Submitted | Application tracking | Application sedang ditinjau organizer. |
|  | Accepted | Approved applications | Application yang diterima dan siap masuk booking/payment. |
|  | Rejected | Application history | Application yang tidak diterima. |
| **Bookings** | Upcoming | Upcoming participation | Event yang akan diikuti. |
|  | Active | Current participation | Event/booth yang sedang berlangsung. |
|  | Completed | Participation history | Riwayat event selesai. |
| **Calendar** | Event Schedule | Participation calendar | Jadwal seluruh event tenant. |
|  | Setup & Breakdown | Operational schedule | Jadwal loading, booth setup, operating hours dan breakdown. |
| **Payments** | Booth Fees | Participation cost | Biaya booth dan biaya terkait. |
|  | Invoices | Billing | Invoice dari organizer. |
|  | Payment History | Transaction history | Riwayat pembayaran tenant. |
| **Documents** | Agreements | Participation agreement | Perjanjian antara tenant dan organizer. |
|  | Permits | Compliance documents | Dokumen yang diperlukan berdasarkan event. |
|  | Invoices | Financial documents | Arsip invoice. |
| **Performance** | Event History | Participation analytics | Riwayat event dan aktivitas tenant. |
|  | Ratings | Reputation | Feedback organizer terhadap tenant. |
| **Settings** | Business Profile | Tenant identity | Profil bisnis, kategori dan informasi brand. |
|  | Products | Product catalog | Produk/kategori yang akan dijual atau dipamerkan. |
|  | Documents | Business documents | Legal dan compliance documents. |
|  | Payments | Payment configuration | Metode pembayaran. |
|  | Security | Account protection | Keamanan akun. |

---

# 8. AUDIENCE / PENGGUNA BIASA

| Menu | Submenu | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Discover** | For You | Personalized discovery | Event yang relevan berdasarkan preferensi dan interaksi pengguna, jika data tersedia dan pengguna mengizinkan personalisasi. |
|  | Trending | Popular discovery | Event yang sedang mendapatkan perhatian tinggi berdasarkan sinyal aktual platform. |
|  | Nearby | Location discovery | Event berdasarkan lokasi/kota yang dipilih pengguna. |
|  | Upcoming | Future events | Event mendatang berdasarkan tanggal. |
|  | Categories | Category discovery | Musik, festival, olahraga, conference, exhibition dan kategori lainnya. |
| **My Tickets** | Upcoming | Future tickets | Tiket yang telah dimiliki untuk event mendatang. |
|  | Active | Usable tickets | Tiket yang valid dan siap digunakan. |
|  | Used | Used tickets | Tiket yang telah tervalidasi di event. |
|  | Expired | Historical tickets | Tiket yang sudah tidak dapat digunakan. |
| **Orders** | Purchases | Purchase history | Semua transaksi pembelian tiket beserta status payment dan ticket issuance. |
|  | Refunds | Refund tracking | Status permintaan dan penyelesaian refund. |
|  | Transfers | Ownership transfer | Transfer tiket kepada pengguna lain apabila event mengizinkan. |
| **Wallet** | Payment Methods | Payment management | Menyimpan atau mengelola metode pembayaran yang didukung secara aman. |
|  | E-Wallet | E-wallet connection | Akses terhadap GoPay, DANA, OVO atau provider lain sesuai integrasi payment resmi yang tersedia. |
|  | Refund Balance | Refund funds | Menampilkan saldo refund apabila model settlement OKKAX mendukung internal balance. |
|  | Transactions | Financial history | Riwayat pembayaran, refund dan transaksi wallet. |
| **Saved** | Favorite Events | Favorites | Event yang disimpan pengguna. |
|  | Watchlist | Event monitoring | Event yang ingin dipantau untuk ticket release, lineup atau informasi penting. |
| **News & Updates** | Concert News | Event information | Berita dan informasi konser yang relevan. |
|  | Event Updates | Official updates | Announcement resmi event yang diikuti/disimpan. |
|  | Lineup Updates | Artist updates | Perubahan atau penambahan lineup. |
|  | Presale Alerts | Ticket alerts | Informasi pembukaan presale atau ticket release. |
| **Settings** | Account | Account management | Email, nomor telepon dan identitas dasar akun. |
|  | Profile | User preferences | Nama, kota dan preferensi pengalaman. |
|  | Payment Methods | Payment configuration | Metode pembayaran tersimpan. |
|  | Notifications | Notification control | Mengatur jenis informasi yang ingin diterima dan channel yang diizinkan. |
|  | Privacy | Privacy controls | Mengatur penggunaan data dan personalisasi sesuai kapabilitas sistem. |
|  | Security | Account protection | Password, MFA, session dan device management. |

---

# GLOBAL LAYER UNTUK SELURUH DASHBOARD

| Komponen Global | Lokasi | Fungsi Utama | Deskripsi Detail |
|---|---|---|---|
| **Workspace / Role Switcher** | Header kiri | Context switching | Mengganti role/workspace tanpa logout. Seluruh data, navigation dan permission berubah mengikuti workspace aktif. |
| **Global Search / Command** | Header | Universal navigation | Mencari event, talent, vendor, venue, workforce, sponsor, tenant, order, ticket, document atau action yang memang dapat diakses user. |
| **Action Center** | Header | Universal operational inbox | Menyatukan approval, request, deadline, payment, contract dan pekerjaan yang membutuhkan tindakan user. |
| **Messages** | Header | Professional communication | Komunikasi antar-role hanya setelah relationship/request diterima. Conversation harus memiliki konteks event/deal/project sehingga bukan messenger generik. |
| **Notifications** | Header | Awareness layer | Informasi perubahan sistem yang tidak selalu membutuhkan tindakan. Harus dibedakan jelas dari Action Center. |
| **OKKAX Copilot** | Floating / contextual | Intelligence assistant | Membantu user memahami data, menemukan risiko, mencari resource dan menjalankan action yang diizinkan berdasarkan konteks workspace. |
| **Account Menu** | Header kanan | Personal account | Profile, personal preferences, help, workspace switching shortcut dan logout. |
| **Live Mode Indicator** | Header / contextual | Operational state | Ketika event memasuki hari-H, menampilkan status live dan shortcut menuju Live Operations tanpa memenuhi sidebar dengan menu temporer. |

---

# PRINSIP ARSITEKTUR NAVIGASI

- **Sidebar = pekerjaan/domain utama**
- **Header = komunikasi, pencarian, approval, notifikasi dan context**
- **Event Studio = orkestrasi sebuah event**
- **Overview = decision/action surface**
- **Settings = konfigurasi dan governance**
- **OKKAX Copilot = contextual assistant, bukan menu utama**

Dokumen ini harus menjadi sumber referensi utama untuk pengembangan member dashboard OKKAX agar struktur per role, navigasi, terminology, hierarchy, dan responsibility tidak berubah-ubah tanpa keputusan arsitektural yang eksplisit.
