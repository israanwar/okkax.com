# OKKAX.COM MASTER SEO + GEO + AEO ARCHITECTURE

## Search, Answer, Generative & Entity Visibility Constitution

**Domain:** okkax.com\
**Scope:** Website publik OKKAX\
**Version:** 1.0 --- August 2026\
**Status:** Master Implementation Specification\
**Objective:** Membuat OKKAX mudah ditemukan, dipahami, diindeks,
diranking, dikutip, dan direkomendasikan oleh search engine, answer
engine, AI search, serta generative search tanpa mengorbankan performa,
UX, atau integritas data.

------------------------------------------------------------------------

# 1. NORTH STAR

OKKAX harus memiliki satu search architecture yang melayani tiga lapisan
sekaligus:

1.  **SEO --- Search Engine Optimization**\
    Memaksimalkan crawlability, indexability, relevance, authority,
    internal discovery, rich results, local/event discovery, dan organic
    search performance.

2.  **AEO --- Answer Engine Optimization**\
    Membuat setiap halaman mampu menjawab intent secara eksplisit,
    singkat, terstruktur, faktual, dan dapat diekstrak oleh mesin
    pencari/answer engine.

3.  **GEO --- Generative Engine Optimization**\
    Membuat OKKAX menjadi sumber yang mudah dipahami, diverifikasi,
    dikutip, dan direferensikan oleh AI-powered search dan generative
    systems.

Prinsip utama:

> SEO adalah fondasi. AEO dan GEO bukan pengganti SEO, melainkan lapisan
> information architecture, entity clarity, answerability, evidence, dan
> machine accessibility di atas fondasi search yang sehat.

Tidak ada klaim "100% ranking guarantee". Target "100%" dalam dokumen
ini berarti **100% coverage terhadap checklist implementasi yang dapat
dikendalikan OKKAX**, bukan jaminan ranking atau citation oleh pihak
ketiga.

------------------------------------------------------------------------

# 2. TARGET DISCOVERY ECOSYSTEM

OKKAX harus siap ditemukan melalui:

-   Google Search
-   Google AI Overviews
-   Google AI Mode
-   Bing Search
-   Microsoft Copilot/Bing grounding experiences
-   ChatGPT Search
-   Search assistants dan browser agents yang menggunakan web publik
-   Traditional SERP
-   Event discovery queries
-   Local/city discovery
-   Brand/entity queries
-   Informational queries
-   Transactional ticket queries
-   Navigational queries
-   Commercial investigation
-   Sponsor/vendor/talent/venue discovery
-   Long-tail conversational queries

------------------------------------------------------------------------

# 3. SEARCH ENTITY DEFINITION

Entity utama harus konsisten di seluruh situs.

## Organization Entity

**Name:** OKKAX\
**Canonical Domain:** https://okkax.com/\
**Category:** Live Event Operating Network / Event Technology Platform\
**Core Proposition:** Platform yang menghubungkan discovery,
perencanaan, talent, venue, vendor, workforce, sponsor, tenant,
ticketing, live operations, dan settlement dalam satu jaringan ekonomi
live event.

Entity relationship yang harus dapat dipahami mesin:

``` text
OKKAX
├── Events
├── Cities
├── Organizers / Promoters
├── Talent / Artists / Bands
├── Venues
├── Vendors
├── Workforce
├── Sponsors
├── Tenants
├── Tickets / LivePass
├── Event Calendar
├── Event Map
└── Editorial / Knowledge
```

Gunakan terminologi ini secara konsisten. Hindari mengganti nama entity
secara acak antarhalaman.

------------------------------------------------------------------------

# 4. INFORMATION ARCHITECTURE

Arsitektur URL publik harus human-readable, stable, canonical, dan
crawlable.

``` text
/
├── /discover
├── /events/
│   └── /events/{event-slug}
├── /cities/
│   └── /cities/{city-slug}
├── /calendar
├── /peta
├── /talents/
│   └── /talents/{talent-slug}
├── /venues/
│   └── /venues/{venue-slug}
├── /vendors/
│   └── /vendors/{vendor-slug}
├── /workforce/
├── /sponsors/
├── /tenants/
├── /news/ atau /insights/
│   ├── /events/
│   ├── /music/
│   ├── /industry/
│   ├── /guides/
│   └── /cities/
├── /about
├── /how-it-works
├── /pricing
├── /contact
├── /privacy
├── /terms
└── /refund-policy
```

Dashboard/member routes seperti `/app/**`, authentication, internal
tools, checkout-sensitive URLs, preview, debug, dan admin tidak boleh
masuk organic index.

------------------------------------------------------------------------

# 5. INDEXATION POLICY

## INDEX

Prioritaskan index untuk:

-   homepage
-   discover
-   canonical event detail
-   city landing pages berkualitas
-   public talent profiles
-   public venue profiles
-   public vendor profiles yang memiliki substantive content
-   editorial/news/guides
-   about
-   relevant evergreen landing pages

## NOINDEX

Terapkan `noindex` pada:

-   `/app/**`
-   `/login`
-   `/register` bila tidak memiliki acquisition value
-   `/checkout/**`
-   payment callback
-   account pages
-   admin
-   debug
-   test
-   sandbox
-   preview
-   internal search results dengan kombinasi parameter tak terbatas
-   duplicate filtered URLs
-   empty profile pages
-   thin generated pages
-   private invitation/deal URLs

Jangan memblokir URL dengan robots.txt bila crawler perlu membaca
`noindex`. Gunakan robots.txt untuk crawl control, bukan sebagai
substitusi universal untuk index control.

------------------------------------------------------------------------

# 6. TECHNICAL SEO FOUNDATION

## 6.1 Crawlability

Setiap halaman penting harus:

-   dapat dicapai melalui `<a href="">` crawlable
-   tidak bergantung hanya pada click handler JavaScript
-   memiliki canonical URL
-   memiliki status HTTP yang benar
-   tidak diblokir CDN/WAF secara keliru
-   memiliki content penting dalam rendered HTML
-   tidak memerlukan login

## 6.2 HTTP Status

Gunakan:

-   `200` halaman valid
-   `301/308` permanent canonical redirect
-   `404` resource tidak ditemukan
-   `410` resource sengaja dihapus permanen bila relevan
-   hindari soft-404
-   hindari redirect chains
-   hindari `200` untuk error page

## 6.3 Canonical

Setiap indexable page harus mempunyai self-referencing canonical.

Contoh:

``` html
<link rel="canonical" href="https://okkax.com/events/java-jazz-festival-2027">
```

Filtered/sorted duplicate pages canonical ke versi utama jika memang
bukan landing page independen.

## 6.4 Sitemap Architecture

Gunakan sitemap index:

``` text
/sitemap.xml
├── sitemap-pages.xml
├── sitemap-events.xml
├── sitemap-cities.xml
├── sitemap-talents.xml
├── sitemap-venues.xml
├── sitemap-vendors.xml
├── sitemap-news.xml
└── sitemap-images.xml (jika diperlukan)
```

Rules:

-   hanya canonical indexable URLs
-   `lastmod` harus mencerminkan perubahan nyata
-   hapus URL deleted/redirected
-   update otomatis saat event/profile/article berubah
-   jangan memasukkan dashboard/private URLs
-   jangan membuat fake freshness

## 6.5 Robots.txt

Baseline:

``` text
User-agent: *
Allow: /
Disallow: /app/
Disallow: /admin/
Disallow: /checkout/
Disallow: /api/
Disallow: /debug/
Disallow: /test/

User-agent: OAI-SearchBot
Allow: /

Sitemap: https://okkax.com/sitemap.xml
```

Aturan final harus disesuaikan dengan routes aktual. Jangan memblokir
asset JS/CSS yang dibutuhkan renderer.

Keputusan `GPTBot` harus dipisahkan dari OAI-SearchBot. Search
visibility dan model-training controls bukan hal yang sama.

------------------------------------------------------------------------

# 7. JAVASCRIPT SEO / RENDERING

Karena OKKAX adalah React application, public SEO pages tidak boleh
mengandalkan client-only rendering untuk seluruh content kritis.

Prioritas:

1.  SSR/SSG/prerender untuk public landing pages jika arsitektur
    memungkinkan.
2.  Critical title, description, canonical, H1, event facts, date,
    venue, city, price, availability, description harus tersedia pada
    initial rendered document.
3.  Event Graph interaktif boleh client-rendered, tetapi fakta event
    yang relevan untuk search harus tersedia dalam semantic HTML.
4.  Ticker bukan sumber utama content SEO.
5.  Jangan menaruh informasi penting hanya di canvas, graph, modal,
    tooltip, atau animation.
6.  Setiap content screen yang layak dicari harus memiliki URL stabil.

------------------------------------------------------------------------

# 8. PERFORMANCE & CORE WEB VITALS

Search architecture tidak boleh memperlambat situs.

Performance budget:

-   LCP target ≤ 2.5 s
-   INP target ≤ 200 ms
-   CLS target ≤ 0.1
-   critical public content harus muncul tanpa menunggu external APIs
-   lazy-load below-the-fold modules
-   code splitting per route
-   responsive image sizing
-   WebP/AVIF jika kompatibel
-   width/height image eksplisit
-   font subset/preload hanya yang critical
-   cache immutable static assets
-   CDN untuk public assets
-   gzip/brotli
-   API payload projection
-   pagination
-   stale-while-revalidate untuk public discovery data
-   hindari request waterfall
-   hindari duplicate fetch

Event Graph dan ticker tidak boleh memblokir LCP.

------------------------------------------------------------------------

# 9. PAGE-LEVEL METADATA CONTRACT

Setiap indexable page wajib memiliki:

-   unique `<title>`
-   unique meta description
-   canonical
-   one clear primary H1
-   logical H2--H6 hierarchy
-   Open Graph metadata
-   X/Twitter card metadata jika digunakan
-   robots directives
-   structured data yang sesuai
-   descriptive image alt
-   breadcrumb jika hierarchy relevan

## Title Patterns

Homepage:

``` text
OKKAX — Live Event Operating Network
```

Event:

``` text
{Event Name} {Year} — Tiket, Jadwal & Venue | OKKAX
```

City:

``` text
Event di {City} — Konser, Festival & Acara Terbaru | OKKAX
```

Talent:

``` text
{Talent Name} — Jadwal Event & Profil | OKKAX
```

Venue:

``` text
{Venue Name}, {City} — Event & Informasi Venue | OKKAX
```

Hindari keyword stuffing.

------------------------------------------------------------------------

# 10. STRUCTURED DATA MASTER PLAN

JSON-LD harus mencerminkan visible content. Jangan membuat schema untuk
informasi yang tidak ada di halaman.

## Homepage

-   `Organization`
-   `WebSite`

## Event Detail

-   `Event`
-   `BreadcrumbList`
-   `Offer` jika tiket benar-benar tersedia
-   `Place`
-   performer entity bila tersedia

Fields penting:

-   name
-   description
-   startDate
-   endDate
-   eventStatus
-   eventAttendanceMode
-   location
-   image
-   organizer
-   performer
-   offers
-   url

## Article / News

-   `Article` atau `NewsArticle`
-   author
-   datePublished
-   dateModified
-   headline
-   image
-   publisher

## Talent

Gunakan entity yang paling semantically sesuai, misalnya `Person` atau
`MusicGroup`, bukan schema palsu.

## Venue

-   `Place` atau subtype yang relevan
-   address
-   geo jika valid
-   image
-   URL

## Breadcrumb

`BreadcrumbList` untuk hierarchy publik.

## FAQ

Gunakan FAQ content terutama untuk UX/AEO. Jangan menganggap FAQ markup
menjamin rich result.

------------------------------------------------------------------------

# 11. EVENT SEO ENGINE

Event adalah acquisition engine utama OKKAX.

Setiap event detail harus mempunyai content server-accessible:

1.  nama event
2.  event type
3.  tanggal mulai
4.  tanggal selesai
5.  timezone
6.  venue
7.  kota
8.  alamat bila publik
9.  lineup/talent
10. organizer/promoter
11. ticket status
12. ticket tiers
13. price range
14. event description
15. age restriction jika ada
16. doors/opening time jika ada
17. accessibility information jika ada
18. official updates
19. refund/cancellation policy reference
20. related events

Expired events tidak otomatis dihapus. Jika memiliki historical/search
value, pertahankan sebagai historical event page dan tandai status
secara benar.

------------------------------------------------------------------------

# 12. CITY SEO ENGINE

Buat city landing page hanya jika memiliki substantive value.

Contoh:

``` text
/events/jakarta   [atau canonical city architecture yang dipilih]
/cities/jakarta
```

Jangan memiliki dua landing pages dengan intent identik.

City page dapat berisi:

-   upcoming events
-   this week
-   this month
-   music
-   conferences
-   exhibitions
-   sports
-   family
-   venues
-   event calendar
-   editorial city guide
-   FAQs berbasis fakta
-   internal links ke event dan venue

Jangan menghasilkan ribuan city pages kosong.

------------------------------------------------------------------------

# 13. CONTENT CLUSTER STRATEGY

## Cluster 1 --- Event Discovery

-   konser di Jakarta
-   festival musik Indonesia
-   event akhir pekan
-   event gratis
-   event keluarga
-   conference
-   exhibition
-   sports event

## Cluster 2 --- Ticket Intelligence

-   cara membeli tiket
-   jenis tiket
-   transfer tiket
-   refund
-   QR ticket
-   anti-fraud
-   gate validation

## Cluster 3 --- Event Industry

-   event organizer
-   promoter
-   production
-   venue
-   sponsorship
-   event workforce
-   event technology

## Cluster 4 --- Talent

-   artist schedule
-   band schedule
-   booking ecosystem
-   rider education
-   performance logistics

## Cluster 5 --- Sponsor & Brand Activation

-   sponsorship guide
-   sponsorship inventory
-   event ROI
-   brand activation
-   audience fit

## Cluster 6 --- Venue & Vendor

-   venue guides
-   production vendors
-   sound
-   lighting
-   stage
-   logistics

## Cluster 7 --- Local Event Economy

-   event economic impact
-   tourism
-   hospitality
-   UMKM
-   local workforce

Setiap cluster harus mempunyai pillar page dan supporting content yang
saling terhubung.

------------------------------------------------------------------------

# 14. CONTENT QUALITY CONSTITUTION

Tidak boleh melakukan programmatic publishing tanpa substantive value.

Setiap content harus memberikan setidaknya satu dari:

-   original event data
-   verified availability
-   original analysis
-   proprietary OKKAX data
-   expert explanation
-   first-party operational insight
-   unique comparison
-   original visualization
-   documented methodology
-   primary-source quote/data
-   actionable guide

Konten generatif boleh membantu research/structure, tetapi publikasi
massal tanpa nilai tambahan dilarang.

------------------------------------------------------------------------

# 15. AEO --- ANSWER ENGINE ARCHITECTURE

Setiap halaman informational harus mempunyai **Answer Layer**.

Struktur:

``` text
H1
Short direct answer / summary
Key facts
Detailed explanation
Evidence/data
Related entities
FAQ / follow-up questions
Sources/methodology where relevant
```

## Answer Block

Jawab pertanyaan utama dalam 40--80 kata bila cocok secara natural.

Contoh:

``` text
Apa itu OKKAX?

OKKAX adalah Live Event Operating Network yang menghubungkan perencanaan event,
talent, venue, vendor, workforce, sponsor, tenant, ticketing, operasi hari-H,
dan settlement dalam satu sistem terintegrasi.
```

Tidak perlu memaksakan semua halaman menjadi FAQ.

------------------------------------------------------------------------

# 16. QUESTION & INTENT MODEL

Bangun content berdasarkan pertanyaan nyata:

## Audience

-   Event apa yang ada di Jakarta minggu ini?
-   Konser apa yang berlangsung bulan ini?
-   Di mana membeli tiket event X?
-   Berapa harga tiket?
-   Kapan gate dibuka?
-   Apakah tiket dapat dipindahkan?
-   Bagaimana refund?

## Organizer

-   Bagaimana mencari venue?
-   Bagaimana menghitung break-even event?
-   Bagaimana mencari sponsor?
-   Bagaimana memilih vendor?
-   Bagaimana mengelola workforce?

## Talent

-   Bagaimana mendapatkan booking event?
-   Bagaimana rider dikelola?
-   Bagaimana jadwal talent dicek?

## Sponsor

-   Event apa yang cocok untuk brand saya?
-   Berapa sponsorship inventory?
-   Bagaimana mengukur event activation?

## Vendor

-   Bagaimana mendapatkan RFQ event?
-   Bagaimana mengelola quotation?

Gunakan pertanyaan tersebut sebagai input content roadmap, bukan keyword
stuffing.

------------------------------------------------------------------------

# 17. GEO --- GENERATIVE ENGINE ARCHITECTURE

GEO OKKAX harus berorientasi pada **retrievability, factual clarity,
entity consistency, independent verifiability, and
citation-worthiness**.

## GEO Principles

1.  Setiap URL memiliki satu primary intent.
2.  Entity disebut secara eksplisit.
3.  Fakta penting tidak disembunyikan di UI.
4.  Date/time/location memiliki format jelas.
5.  Sumber dan provenance tersedia untuk data analitis.
6.  Claims besar mempunyai evidence.
7.  Content dapat berdiri sendiri tanpa context halaman lain.
8.  Gunakan internal links ke entity terkait.
9.  Update timestamp hanya jika ada substantive update.
10. Hindari fabricated authority signals.

------------------------------------------------------------------------

# 18. AI CITATION-WORTHINESS

Untuk meningkatkan kemungkinan suatu halaman layak dijadikan referensi:

-   berikan data unik
-   definisikan istilah
-   jelaskan metodologi
-   tampilkan tanggal data
-   tampilkan geographic scope
-   tampilkan source/provenance
-   gunakan tabel faktual bila tepat
-   gunakan angka dengan konteks
-   pisahkan fakta dan estimasi
-   tandai simulasi/forecast
-   berikan author/editorial ownership
-   perbarui informasi event yang berubah

Untuk OKKAX Intelligence:

``` text
Metric
Value
As of
Scope
Source
Calculation method
Confidence / limitation
```

Ini jauh lebih kuat daripada paragraph marketing tanpa evidence.

------------------------------------------------------------------------

# 19. OPENAI / CHATGPT SEARCH ACCESS

Untuk content publik yang ingin ditemukan melalui ChatGPT Search:

-   jangan blokir `OAI-SearchBot`
-   pastikan CDN/WAF tidak menghasilkan false 403
-   public content harus dapat diakses tanpa authentication
-   title dan page content harus eksplisit
-   gunakan canonical
-   hindari rendering yang gagal pada crawler
-   track referral `utm_source=chatgpt.com` pada analytics bila tersedia

Kontrol GPTBot harus diputuskan secara terpisah berdasarkan kebijakan
penggunaan content OKKAX untuk training.

------------------------------------------------------------------------

# 20. BING / COPILOT DISCOVERY

Implementasikan:

-   Bing Webmaster Tools
-   XML sitemap
-   canonical URLs
-   crawlable internal links
-   structured data
-   accurate `lastmod`
-   IndexNow untuk event/article/profile changes bila sesuai
-   clear entity definitions
-   independently verifiable page content

Event yang berubah cepat sangat cocok menggunakan freshness signaling.

------------------------------------------------------------------------

# 21. INTERNAL LINKING ENGINE

Setiap event:

``` text
Event
→ City
→ Venue
→ Talent
→ Organizer
→ Related Events
→ Relevant Guides
```

Talent:

``` text
Talent
→ Upcoming Events
→ Past Events
→ Cities
→ Relevant editorial
```

Venue:

``` text
Venue
→ Upcoming Events
→ City
→ Venue guides
```

Article:

``` text
Article
→ relevant Event
→ City
→ Talent/Venue
→ pillar page
```

Tidak boleh ada orphan indexable page.

------------------------------------------------------------------------

# 22. BREADCRUMB MODEL

Contoh:

``` text
Home > Events > Jakarta > Event Name
Home > Cities > Jakarta
Home > Talent > Talent Name
Home > Venues > Jakarta > Venue Name
Home > Insights > Music > Article
```

Breadcrumb harus visible dan selaras dengan structured data.

------------------------------------------------------------------------

# 23. IMAGE SEO

Setiap image penting:

-   descriptive filename
-   meaningful alt
-   explicit dimensions
-   responsive `srcset`
-   modern compression
-   lazy loading kecuali LCP
-   image sitemap jika dibutuhkan
-   image URL stabil
-   tidak menyisipkan critical textual information hanya ke image

Event poster alt:

``` text
Poster {Event Name} di {Venue}, {City}, {Date}
```

Bukan:

``` text
image123
```

------------------------------------------------------------------------

# 24. VIDEO SEO

Jika OKKAX mempunyai video:

-   dedicated context
-   title
-   description
-   thumbnail
-   duration jika tersedia
-   upload/publication date
-   transcript/caption bila relevan
-   VideoObject hanya jika memenuhi persyaratan dan content benar-benar
    tersedia

------------------------------------------------------------------------

# 25. LOCAL DISCOVERY

Untuk venue/event location:

-   consistent city naming
-   valid addresses
-   latitude/longitude jika tersedia
-   Place entities
-   internal city pages
-   local editorial
-   transport/accessibility information bila bernilai
-   jangan membuat fake location pages

------------------------------------------------------------------------

# 26. TRUST / E-E-A-T SUPPORT

Bangun trust architecture:

-   About OKKAX
-   Contact
-   editorial policy
-   correction/update policy
-   ticket/refund policy
-   privacy
-   terms
-   security information
-   author/editor pages untuk editorial
-   data methodology untuk intelligence reports
-   timestamps
-   source attribution
-   organization identity yang konsisten

E-E-A-T diperlakukan sebagai quality/trust framework, bukan schema atau
"ranking switch".

------------------------------------------------------------------------

# 27. PROGRAMMATIC SEO GUARDRAILS

OKKAX memiliki banyak event/entity sehingga programmatic pages
potensial, tetapi harus dijaga.

Publish hanya jika page memenuhi threshold:

``` text
has_unique_entity = true
has_substantive_content = true
has_search_value = true
has_valid_canonical = true
not_duplicate = true
not_empty = true
```

Jika tidak:

``` text
noindex
```

Jangan membuat kombinasi indexable tak terbatas:

``` text
?city=
?category=
?date=
?sort=
?page=
?price=
```

Pilih curated landing pages yang memang memiliki search demand dan
unique value.

------------------------------------------------------------------------

# 28. FACETED NAVIGATION

Rules:

-   filter UX boleh banyak
-   indexable facets harus terbatas
-   canonical strategy eksplisit
-   parameter ordering konsisten
-   duplicate combinations noindex/canonical
-   sitemap hanya curated canonical landing pages

------------------------------------------------------------------------

# 29. EVENT EXPIRATION STRATEGY

Status:

``` text
Scheduled
Live
Postponed
Cancelled
Completed
```

SEO behavior:

-   postponed: pertahankan URL, update status/date
-   cancelled: pertahankan URL jika masih dibutuhkan pengguna, tampilkan
    status jelas
-   completed: pertahankan jika memiliki historical value
-   duplicate/replaced: canonical/redirect sesuai kasus
-   deleted invalid event: 404/410

Jangan redirect semua expired events ke homepage.

------------------------------------------------------------------------

# 30. KNOWLEDGE GRAPH STRATEGY

Bangun hubungan entity konsisten melalui:

-   Organization markup
-   canonical profiles
-   sameAs hanya untuk official verified profiles
-   consistent names
-   about pages
-   structured event relationships
-   venue/talent/event connections
-   publisher attribution
-   external authoritative references secara natural

Jangan membuat `sameAs` ke halaman yang bukan representasi resmi entity.

------------------------------------------------------------------------

# 31. CONTENT FRESHNESS

Freshness berdasarkan perubahan nyata:

Event: - schedule - lineup - ticket availability - venue - status

Article: - substantive editorial update - corrected facts - new data

Jangan mengubah `dateModified` setiap deploy.

------------------------------------------------------------------------

# 32. NEWS / EDITORIAL ENGINE

Editorial template:

``` text
Headline
Dek/subheadline
Author
Published date
Modified date
Key takeaway
Body
Evidence/sources
Related event/entity
Related articles
```

Jenis content:

-   event announcements
-   lineup updates
-   venue guides
-   city event guides
-   ticketing guides
-   live event industry analysis
-   sponsor intelligence
-   economic impact reports
-   organizer education

------------------------------------------------------------------------

# 33. KEYWORD & ENTITY RESEARCH SYSTEM

Jangan hanya menyimpan keyword volume.

Database research minimal:

``` text
query
intent
entity
city
event_type
funnel_stage
SERP_type
content_type
business_value
difficulty
seasonality
target_url
status
```

Prioritas:

``` text
Opportunity Score =
Relevance × Business Value × Intent Fit × Achievability × Freshness Need
```

------------------------------------------------------------------------

# 34. SEARCH INTENT MAPPING

Gunakan empat intent:

-   Informational
-   Navigational
-   Commercial Investigation
-   Transactional

Contoh:

`konser jakarta oktober 2026` → discovery intent

`tiket {event}` → transactional

`venue konser jakarta` → commercial investigation

`cara refund tiket konser` → informational

Satu URL utama per dominant intent.

------------------------------------------------------------------------

# 35. DUPLICATION CONTROL

Audit:

-   duplicate titles
-   duplicate descriptions
-   duplicate event descriptions
-   city/event overlap
-   parameter URLs
-   trailing slash
-   uppercase/lowercase
-   www/non-www
-   HTTP/HTTPS
-   duplicate slug
-   event reschedules
-   pagination

Satu canonical host harus dipilih.

------------------------------------------------------------------------

# 36. REDIRECT GOVERNANCE

Maintain redirect registry:

``` text
old_url
new_url
reason
date
type
```

Hindari:

-   chains
-   loops
-   irrelevant redirects
-   mass redirect deleted content ke homepage

------------------------------------------------------------------------

# 37. INTERNATIONAL SEO

Jika OKKAX berekspansi multi-language:

-   unique localized URLs
-   proper `hreflang`
-   self-referencing hreflang
-   `x-default` jika relevan
-   translated content harus berkualitas, bukan mechanical duplication
-   localized currency/date/context
-   canonical jangan menunjuk semua language variants ke satu bahasa
    jika variants memang independen

Implementasikan hanya ketika content localization benar-benar tersedia.

------------------------------------------------------------------------

# 38. SOCIAL & SEARCH CONSISTENCY

Open Graph:

-   og:title
-   og:description
-   og:image
-   og:url
-   og:type

Event share cards harus mempunyai poster/visual yang benar dan URL
canonical.

Social metadata tidak menggantikan search metadata.

------------------------------------------------------------------------

# 39. ANALYTICS & SEARCH OBSERVABILITY

Integrasikan:

-   Google Search Console
-   Bing Webmaster Tools
-   GA4 atau analytics layer yang dipilih
-   Core Web Vitals/RUM
-   server logs/crawl monitoring jika tersedia
-   referral tracking dari AI/search surfaces

Track:

``` text
organic_sessions
organic_event_views
ticket_clicks
checkout_starts
ticket_purchases
organic_conversion_rate
city_page_sessions
event_page_sessions
non_brand_clicks
brand_clicks
indexed_pages
crawl_errors
CWV
AI_referrals
AI_referral_conversions
```

------------------------------------------------------------------------

# 40. GEO / AEO OBSERVABILITY

Buat query benchmark set.

Contoh:

``` text
event apa di jakarta minggu ini
konser di makassar bulan oktober
platform mencari vendor event indonesia
cara mencari sponsor konser
event management platform indonesia
tempat mencari talent untuk event
```

Secara periodik evaluasi:

-   apakah OKKAX muncul
-   URL mana
-   apakah fakta benar
-   apakah entity dipahami benar
-   apakah citation mengarah ke canonical page
-   competitor cited
-   query coverage

Jangan menggunakan hasil ini sebagai klaim ranking guarantee.

------------------------------------------------------------------------

# 41. SEARCH CONVERSION ARCHITECTURE

SEO traffic harus memiliki next action jelas.

Event page:

``` text
Search
→ Event Detail
→ Ticket Tier
→ Checkout
```

Sponsor:

``` text
Search
→ Sponsorship Guide/Event
→ Inventory
→ Express Interest
```

Vendor:

``` text
Search
→ Vendor/Industry Landing
→ Value Proposition
→ Register
```

Talent:

``` text
Search
→ Talent ecosystem
→ Profile/Opportunity
→ Register
```

SEO bukan hanya traffic; ukur qualified action.

------------------------------------------------------------------------

# 42. SECURITY & SEARCH

Pastikan:

-   private data tidak masuk HTML publik
-   private API tidak crawlable
-   no secret/token di JS
-   no user PII dalam structured data
-   preview pages noindex
-   staging protected
-   query strings tidak membocorkan identifiers sensitif
-   sitemap tidak berisi private routes

------------------------------------------------------------------------

# 43. ACCESSIBILITY AS SEARCH QUALITY

Public content harus:

-   semantic HTML
-   keyboard accessible
-   meaningful labels
-   alt text
-   contrast memadai
-   heading hierarchy
-   no essential text only on hover
-   reduced-motion consideration

Accessibility meningkatkan comprehensibility dan UX, meskipun tidak
boleh diperlakukan sebagai trik ranking.

------------------------------------------------------------------------

# 44. AUTOMATED SEO QA

Tambahkan CI checks untuk:

``` text
missing title
duplicate title
missing description
missing canonical
multiple H1
broken canonical
indexable private route
broken internal link
missing alt
invalid JSON-LD
schema-visible-content mismatch
sitemap invalid URL
robots conflict
redirect chain
404 internal link
```

Build tidak boleh dianggap search-ready jika critical SEO QA gagal.

------------------------------------------------------------------------

# 45. EVENT PUBLISHING SEO GATE

Sebelum event menjadi `published`:

``` text
[ ] unique slug
[ ] canonical
[ ] name
[ ] description
[ ] event type
[ ] date/time/timezone
[ ] venue/city
[ ] image
[ ] organizer
[ ] ticket state
[ ] Event JSON-LD
[ ] Open Graph
[ ] internal links
[ ] sitemap inclusion
[ ] no accidental noindex
```

------------------------------------------------------------------------

# 46. ARTICLE PUBLISHING SEO/GEO/AEO GATE

``` text
[ ] clear search intent
[ ] unique title/H1
[ ] direct answer where appropriate
[ ] substantive original value
[ ] factual claims verified
[ ] sources/provenance
[ ] author
[ ] published/modified dates
[ ] related entities
[ ] internal links
[ ] Article schema
[ ] canonical
[ ] OG metadata
[ ] images optimized
[ ] no keyword stuffing
[ ] no scaled-content abuse
```

------------------------------------------------------------------------

# 47. ENTITY PROFILE PUBLISHING GATE

Talent/Venue/Vendor profile:

``` text
[ ] canonical entity name
[ ] unique slug
[ ] substantive description
[ ] category
[ ] location/service area where relevant
[ ] official image
[ ] upcoming/related events
[ ] relevant structured data
[ ] internal links
[ ] no duplicate profile
[ ] enough content to justify indexation
```

Jika tidak cukup substantive: `noindex` sampai profile lengkap.

------------------------------------------------------------------------

# 48. PRIORITY IMPLEMENTATION ROADMAP

## P0 --- Search Infrastructure

1.  canonical host
2.  robots.txt
3.  sitemap index
4.  public/private indexation rules
5.  metadata engine
6.  canonical engine
7.  public renderability
8.  Event structured data
9.  Organization/WebSite structured data
10. Search Console + Bing Webmaster
11. performance regression fixes
12. crawler/WAF verification

## P1 --- Acquisition Architecture

13. event SEO template
14. city landing architecture
15. talent/venue/vendor canonical profiles
16. internal linking engine
17. breadcrumbs
18. editorial engine
19. content clusters
20. image optimization
21. IndexNow where appropriate

## P2 --- AEO/GEO

22. answer-layer templates
23. entity clarity
24. evidence/provenance blocks
25. methodology pages
26. AI/search crawler verification
27. AI referral analytics
28. benchmark query monitoring

## P3 --- Scale

29. programmatic SEO guardrails
30. automated SEO QA
31. multilingual architecture
32. search opportunity scoring
33. historical event archive
34. large-scale log analysis

------------------------------------------------------------------------

# 49. MASTER KPI SCORECARD

## Technical SEO

-   indexable canonical coverage: target 100%
-   sitemap canonical accuracy: 100%
-   critical structured-data validity: 100%
-   internal broken links: 0
-   redirect loops: 0
-   accidental indexed private URLs: 0
-   critical metadata coverage: 100%

## Content

-   thin indexable pages: target 0
-   duplicate primary intent pages: target 0
-   event pages with complete critical facts: target 100%
-   editorial pages with authorship/provenance: target 100%

## Performance

-   Core Web Vitals pass rate: maximize toward 100%
-   no Event Graph/ticker blocking LCP
-   no critical request waterfall

## AEO

-   direct-answer coverage on applicable informational pages
-   factual consistency
-   entity clarity
-   FAQ/query coverage
-   answer freshness

## GEO

-   AI crawler accessibility
-   independently verifiable facts
-   provenance coverage
-   entity consistency
-   AI referral traffic
-   citation/query benchmark coverage

------------------------------------------------------------------------

# 50. DEFINITION OF DONE

SEO/GEO/AEO implementation hanya dapat dinyatakan **DONE** apabila:

1.  Semua public canonical pages dapat dirayapi.
2.  Private/member pages terlindungi dari index.
3.  Metadata unik dan valid.
4.  Sitemap hanya berisi canonical URLs.
5.  Canonicalization konsisten.
6.  Event structured data sesuai visible content.
7.  Critical content tersedia dalam textual/semantic form.
8.  Tidak ada rendering dependency pada external API untuk content
    utama.
9.  Event Graph/ticker tidak memblokir page performance.
10. Internal linking menghubungkan entity penting.
11. Content mempunyai unique value.
12. Informational pages menjawab intent secara eksplisit.
13. Analytical claims mempunyai provenance.
14. Entity naming konsisten.
15. OAI-SearchBot dapat mengakses public content yang ingin ditemukan.
16. Bing/Google discovery infrastructure terpasang.
17. Search analytics dan AI referral tracking aktif.
18. Automated QA tidak menemukan critical SEO defects.
19. Tidak ada mass-generated thin pages.
20. Runtime performance dan crawl behavior telah diverifikasi, bukan
    hanya build.

------------------------------------------------------------------------

# 51. IMPLEMENTATION RULE FOR ANTIGRAVITY / CODE AGENTS

``` text
MASTER RULE — OKKAX SEO + GEO + AEO

Gunakan dokumen ini sebagai source of truth untuk seluruh public search architecture.

Jangan redesign UI.
Jangan mengubah business logic tanpa kebutuhan search yang sah.
Jangan membuat halaman keyword massal.
Jangan membuat schema yang tidak sesuai visible content.
Jangan index /app/** atau private/member resources.
Jangan membuat SEO implementation yang memperlambat homepage.

Sebelum mengubah kode:
1. audit current implementation
2. map routes
3. map indexability
4. map metadata
5. map canonical
6. map structured data
7. map sitemap/robots
8. map rendering/performance

Implementasikan berdasarkan priority P0 → P1 → P2 → P3.

Setelah setiap phase:
- run production build
- crawl public routes
- validate canonical
- validate robots
- validate sitemap
- validate JSON-LD
- test mobile/desktop
- measure CWV/runtime
- test crawler-accessible HTML
- report PASS/PARTIAL/FAIL

Tidak boleh claim 100% hanya karena build sukses.
100% berarti seluruh controllable checklist phase tersebut telah diverifikasi secara runtime.
Jangan push sebelum review.
```

------------------------------------------------------------------------

# 52. OFFICIAL GUIDANCE ALIGNMENT

Dokumen ini sengaja mengikuti prinsip first-party guidance terbaru:

-   Google menyatakan fundamental SEO tetap menjadi fondasi untuk AI
    Overviews dan AI Mode; tidak ada schema atau file AI khusus yang
    diwajibkan untuk muncul pada fitur tersebut.
-   Google menekankan unique, valuable, people-first content,
    crawlability, internal linking, textual accessibility, page
    experience, dan structured data yang sesuai visible content.
-   Google memperingatkan bahwa produksi content generatif berskala
    besar tanpa nilai tambah dapat melanggar scaled-content-abuse
    policy.
-   Bing menyatakan SEO fundamentals, canonical clarity, sitemap,
    IndexNow, semantic HTML, structured data, entity clarity, dan
    independently verifiable content juga mendukung grounding/Copilot
    visibility.
-   OpenAI menyatakan public sites dapat muncul di ChatGPT Search dan
    menyarankan agar OAI-SearchBot tidak diblokir jika publisher ingin
    content dapat ditemukan, diringkas, dikutip, dan ditautkan.

Karena algoritma dan produk search/AI terus berubah, master ini harus
diaudit ulang secara berkala terhadap dokumentasi first-party terbaru.

------------------------------------------------------------------------

# 53. FINAL PRINCIPLE

OKKAX tidak akan mengejar "trik GEO", "hack AEO", atau volume halaman.

Strategi yang dikunci adalah:

``` text
FAST
+ CRAWLABLE
+ INDEXABLE
+ SEMANTIC
+ ENTITY-CLEAR
+ ORIGINAL
+ EVIDENCE-BASED
+ ANSWERABLE
+ CITABLE
+ TRANSACTION-READY
= OKKAX SEARCH ADVANTAGE
```

Tujuan akhirnya bukan sekadar berada di hasil pencarian.

Tujuannya adalah menjadikan **OKKAX sebagai sumber otoritatif untuk
discovery dan operasi ekonomi live event**, sehingga manusia, search
engine, answer engine, dan AI systems dapat memahami serta mempercayai
informasi OKKAX dengan cara yang sama.
