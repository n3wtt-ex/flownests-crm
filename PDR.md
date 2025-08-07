# Proje Geliştirme Yol Haritası (PDR)

Bu döküman, Anahtar Teslim B2B Satış Otomasyon Platformu'nun geliştirme adımlarını ve ilerlemesini takip etmek için kullanılır.

---

## 🎯 Aşama 1: Lead Bulma (Lead Generation)

Bu aşama, farklı müşteri segmentlerine yönelik potansiyel müşteri verilerinin toplanmasını ve zenginleştirilmesini içerir.

- [x] **Motor 1: Apollo (Dijital/Kurumsal Odaklı)**
- [x] **Analiz:** "AI-Powered Lead Generation..." otomasyonunun incelenmesi ve en iyi pratiklerin belirlenmesi.
- [x] **Geliştirme:** Otomasyonun, proje standartlarına (SQL veritabanı vb.) uygun hale getirilmesi.
- [x] **Test:** Farklı arama kriterleriyle test edilerek veri kalitesinin ve tutarlılığının doğrulanması.
    - [ ] **Stratejik Not (API vs. Kazıma):** Mevcut implementasyon, maliyet verimliliği sağlamak amacıyla Apollo verilerini Apify üzerinden web kazıma (scraping) yöntemiyle almaktadır. Bu yaklaşım, Apollo arayüzünde gelecekte yapılabilecek değişikliklere karşı hassas olabilir. Bu nedenle, daha yüksek bütçeli veya maksimum operasyonel güvenilirlik talep eden müşteriler için, Apollo'nun resmi API'si ile çalışacak alternatif bir "premium" motor versiyonu geliştirilmesi planlanmaktadır. API tabanlı bu versiyon, ilk müşteri sermayesi elde edildikten sonra geliştirilip test edilecek ve müşterilere opsiyonel bir yükseltme olarak sunulacaktır.
- [ ] **Gelecek Geliştirmeleri (Motor 1):**
    - [ ] **Veritabanı Şeması Doğrulama:** Apollo'dan gelen verilerin (hem kazıma hem de gelecekteki API versiyonu için) merkezi veri modelimizle tam uyumlu olduğundan emin olunması ve gerekirse Supabase tablo yapısının güncellenmesi.
    - [ ] **Gelişmiş Hata Yönetimi:** Kazıma (scraping) işlemi başarısız olduğunda veya hiç veri döndürmediğinde, iş akışının çökmesini engelleyecek ve kullanıcıya (örn: Telegram üzerinden) anlamlı bir hata mesajı iletecek bir mantık eklenmesi.
    - [ ] **Kapsamlı Canlı Test:** Apify veya alternatif bir servise bütçe ayrıldıktan sonra, farklı ve karmaşık arama sorgularıyla canlı testler yaparak veri kalitesinin, tutarlılığının ve hata yönetiminin beklendiği gibi çalıştığının doğrulanması.
- [ ] **Motor 2: Google Maps (Yerel/KOBİ Odaklı)**
- [x] **Analiz:** "Google Maps Business Scraper" otomasyonunun incelenmesi ve en iyi pratiklerin belirlenmesi.
    - [ ] **Geliştirme:** Otomasyonun, proje standartlarına (SQL veritabanı vb.) uygun hale getirilmesi ve kazıma servislerinin (BrightData, Firecrawl) güvenilirliğinin artırılması.
    - [ ] **Test:** Farklı lokasyon ve mekan türleri için test edilerek veri zenginleştirme kalitesinin doğrulanması.
- [ ] **Gelecek Geliştirmeleri (Motor 2):**
    - [ ] **Veritabanı Standardizasyonu:** Mevcut Baserow entegrasyonunu, projenin merkezi SQL veritabanı (Supabase/Postgres) ile değiştirerek veri bütünlüğünü sağlama.
    - [ ] **Gelişmiş Hata Yönetimi:** Harici kazıma servislerinden (BrightData, Firecrawl) bir hata döndüğünde veya veri alınamadığında iş akışının çökmesini engelleyecek ve hatayı bildirecek mekanizmalar ekleme.
    - [ ] **Maliyet Optimizasyonu Stratejisi:** Mevcut durumda Google Haritalar için BrightData ve web siteleri için Firecrawl kullanılmaktadır. Yapılan analiz sonucunda, web sitesi kazıma işleminin de BrightData'nın "Web Unlocker" ürünüyle daha uygun maliyetle yapılabileceği tespit edilmiştir. Projenin ilerleyen optimizasyon aşamasında, Firecrawl'u devreden çıkarıp tüm kazıma operasyonlarını tek bir servis olan BrightData altında birleştirme hedefi belirlenmiştir.
    - [ ] **Kapsamlı Canlı Test:** Gerekli geliştirmeler ve servis birleştirmesi yapıldıktan sonra, farklı lokasyon ve mekan türleriyle canlı testler yaparak veri kalitesini, hata yönetimini ve veritabanı kaydının doğruluğunu kontrol etme.
- [ ] **Motorları Birleştirme ve Yönetim Mantığı**
    - [ ] Merkezi bir n8n iş akışı tasarlayarak, gelen talebe göre Motor 1 veya Motor 2'yi tetikleyecek mantığın oluşturulması.
    - [ ] Her iki motordan gelen verinin standart bir veri modeline (ortak şema) dönüştürülmesi.

---

## 🎯 Aşama 2: Kampanya Oluşturma (Campaign Creation)

Bu aşama, bulunan lead'ler için kişiselleştirilmiş e-posta kampanyaları hazırlamayı ve bunları gönderme platformuna (Instantly.io) aktarmayı hedefler.

- [x] **E-posta Kişiselleştirme Motoru**
    - [x] **Araştırma ve Kıyaslama:** Farklı e-posta kişiselleştirme otomasyonlarının (mevcut Otomasyon A'nın ilgili kısmı dahil) analizi.
    - [x] **A/B Testi:** En iyi 2-3 adayı belirleyip, aynı lead verisiyle test ederek en kaliteli ve tutarlı kişiselleştirme metinlerini üreten motorun seçilmesi.
    - [x] **V1 Geliştirme (Temel Motor):** Sadece web sitesi verilerini kullanarak kişiselleştirilmiş e-posta taslağı üreten temel motorun (Email_Personalization_Engine.json) oluşturulması ve test edilmesi.
- [x] **V2 Geliştirme (İleri Seviye Kişiselleştirme):**
    - [x] **LinkedIn Veri Entegrasyonu:** BrightData'nın yapısal veri sağlayan "LinkedIn People Profiles" API'si entegre edildi. Bu, ham HTML yerine doğrudan işlenebilir JSON verisi almamızı sağlayarak sürecin güvenilirliğini artırdı.
    - [x] **AI Agent'ı Güçlendirme (Tool & Memory):**
        - [x] **Tool Ekleme:** Geliştirme sırasında, AI Agent'a "tool" vermek yerine, ihtiyaç duyulan tüm verileri (web sitesi ve LinkedIn) en başta proaktif olarak çekip birleştiren daha verimli bir mimariye geçildi. Bu, "tool" ihtiyacını ortadan kaldırarak aynı amaca daha stabil bir yolla ulaştı.
        - [x] **Memory Ekleme:** Mevcut tek seferlik analiz ve e-posta oluşturma görevi için, `systemMessage` içinde sağlanan zengin bağlamın yeterli olduğuna karar verildi. İleride geliştirilecek diyalog bazlı AI özellikleri için bu adım tekrar değerlendirilebilir.
    - [x] **Gelişmiş Hata Yönetimi:** LinkedIn veri çekme süreci, BrightData API'sinin asenkron yapısını yönetmek için bir "durum kontrol döngüsü" (status check loop) ile daha sağlam hale getirildi. Bu, işlemin başarısız olması veya uzun sürmesi gibi durumları daha iyi yönetmemizi sağlar.
    - [x] **Dinamik Yapılandırma:** Otomasyon, artık dışarıdan bir webhook aracılığıyla güncellenebilen ve veritabanında saklanan "şirket profili" bilgisini okuyup kullanacak şekilde geliştirildi. Bu, otomasyonun farklı müşteriler için kolayca uyarlanabilmesini sağlar ve "anahtar teslim" vizyonunu destekler.
- [x] **V3 Geliştirme (Çok Adımlı Kampanya Entegrasyonu):**
    - [x] **Takip E-postası Üretimi:** Mevcut kişiselleştirme motoruna, ilk e-postayı referans alarak 2. ve 3. takip e-postalarını (`body_step2`, `body_step3`) üretecek yeni AI adımlarının eklenmesi.
    - [x] **Veritabanı Şeması Güncellemesi:** Postgres veritabanındaki `Leads` tablosuna, üretilen takip e-postalarını saklamak için `generated_body_step2` ve `generated_body_step3` adında yeni sütunların eklenmesi.
    - [x] **Statü Güncelleme Mantığı:** Kişiselleştirme iş akışının sonunda, tüm e-posta metinleri başarıyla üretilip kaydedildiğinde, lead'in statüsünü `personalized` yerine `ready_for_campaign` olarak güncelleyecek mantığın eklenmesi.
- [x] **Instantly.io Entegrasyonu**
    - [x] **API Araştırması:** Instantly.io API V2'nin incelenerek, tam otomasyon için kampanya oluşturma (`POST /campaigns`) ve bu kampanyaya lead ekleme (`POST /leads`) endpoint'lerinin belirlenmesi.
    - [x] **n8n Entegrasyonu (Planlandı):** Veritabanından `ready_for_campaign` statüsündeki lead'leri çeken, bunlar için tek bir kampanya oluşturan ve ardından her bir lead'i kişiselleştirilmiş verileriyle bu kampanyaya ekleyen `instantly_batch_campaign_workflow_v2.json` iş akışının tasarlanması.
    - [x] **n8n Entegrasyonu (Uygulama):** Tasarlanan iş akışının canlıya alınması ve test edilmesi.

---

## 🎯 Aşama 3: Yanıt Takibi (Reply Management)

**Güncel Durum (04.08.2025):** Aşama 3 tamamlandı. Yanıtlar webhook ile alınıyor, AI ile niyet analizi yapılıyor, veritabanına işleniyor ve aksiyon mantığı çalışıyor.

Bu aşama, gönderilen kampanyalara gelen yanıtları otomatik olarak analiz edip kategorize etmeyi ve ilgili aksiyonları tetiklemeyi amaçlar.

- [x] **E-posta Yanıtlarını Alma (Webhook):**
    - [x] Instantly.io'nun "Reply Webhook" özelliğini kullanarak gelen yanıtları anlık olarak alacak yeni bir n8n iş akışı (`reply_management_workflow.json`) oluşturulması.
- [x] **Yapay Zeka Destekli Yanıt Analizi:**
    - [x] **AI Agent Geliştirme:** Gelen e-posta metnini analiz ederek niyeti (`interested`, `not_interested`, `question` vb.) anlayan ve JSON formatında yapılandırılmış bir çıktı üreten bir OpenAI (veya benzeri LLM) adımı tasarlanması.
    - [x] **Veri Etiketleme:** AI tarafından analiz edilen her yanıtın kategorisinin ve özetinin, veritabanındaki (`Leads` tablosu) ilgili lead kaydına `reply_status` ve `reply_summary` gibi yeni sütunlara işlenmesi.
- [x] **Otomatik Aksiyonlar:**
    - [x] **Aksiyon Mantığı Kurulumu:** n8n "Switch" nodu kullanılarak, gelen `reply_status`'a göre farklı iş akışlarını tetikleyen bir mantık oluşturulması.
    - [x] **"Interested" Senaryosu:** İlgilenen lead'ler için proje sahibine Telegram/e-posta ile bildirim gönderilmesi ve Aşama 4'ün (Toplantı Ayarlama) tetiklenmesi.
    - [x] **"Not Interested" Senaryosu:** İlgilenmeyen lead'lerin Instantly.io kampanyasından otomatik olarak çıkarılması ve veritabanında durumlarının güncellenmesi.

---

## 🎯 Aşama 4: Toplantı Ayarlama (Meeting Scheduling)

Bu aşama, olumlu dönüş yapan potansiyel müşterilerle satış toplantısı ayarlanmasını otomatikleştirir.

- [ ] Not: Toplantı planlama aracı olarak cal.com kullanılacaktır.
- [ ] Not: Tüm veriler Postgres’te tutulmaya devam edecektir (mevcut mimari korunur).
- [ ] Not: CRM modülü hazır olduğunda toplantı için teklif e-postası oluşturulacaktır.

---

## 🎯 Aşama 5: CRM Entegrasyonu

Bu aşama, satış sürecinin son halkası olarak, toplantı ayarlanan müşterilerin CRM sistemine aktarılmasını sağlar.

- [x] **Step E (Instantly Reply → CRM) Tamamlandı**
    - [x] Şema hizalama: deals → pipeline_id + stage_id modeline geçiş; eski `stage` kolonu kaldırıldı.
    - [x] Default pipeline ve 'New' stage tohumlandı (003_seed.sql).
    - [x] Idempotency doğrulaması: İlk POST 200, tekrar POST 409.
    - [x] Dokümantasyon: `crm/docs/STEP2_edge_functions_progress.md`, `crm/docs/crm_webhooks.md`, `crm/docs/PROD_READINESS.md` güncellendi/oluşturuldu.
- [ ] **CRM Seçimi ve API Araştırması:** Kullanılacak CRM'in (HubSpot, Pipedrive vb.) belirlenmesi ve API dökümantasyonunun incelenmesi.
- [ ] **CRM'e Müşteri Aktarımı:** 4. Aşamada toplantı oluşturulduğunda tetiklenen webhook ile, müşteri bilgilerini alıp CRM'de yeni bir "deal" veya "contact" oluşturan bir n8n iş akışı geliştirilmesi.
- [ ] **Süreç Tamamlama:** Müşteri CRM'e aktarıldıktan sonra, e-posta otomasyonu döngüsünden çıkarılması.

---

## 🚀 Platform Geliştirme ve Lansman

- [ ] **Arayüz Entegrasyonu (bolt.ai)**
    - [ ] Tüm n8n iş akışlarının webhook'lar aracılığıyla dışarıdan tetiklenebilir hale getirilmesi.
    - [ ] bolt.ai arayüzü ile n8n webhook'ları arasında köprünün kurulması.
- [ ] **AI Asistan Botu**
    - [ ] **Model Eğitimi (Fine-tuning):** Açık kaynak bir dil modelinin, projenin dökümantasyonu ve yetenekleri üzerine eğitilmesi.
    - [ ] **Bot Mantığı:** Eğitilen modelin, kullanıcı komutlarını yorumlayıp doğru n8n webhook'unu tetikleyecek şekilde web sitesine entegre edilmesi.

---

## 💡 Geliştirme Modülleri (Opsiyonel)

Bu modüller, ana 5 adımlık satış otomasyonu hunisini destekleyen ve platformun değerini artıran, gelecekte eklenebilecek güçlü yeteneklerdir.

- [ ] **Modül 1: Derin Araştırma Asistanı**
    - [ ] **Entegrasyon:** "DeepResearcher" otomasyonunun proje standartlarına (SQL, merkezi yönetim vb.) uygun hale getirilmesi.
    - [ ] **Kullanım Senaryosu 1 (İçerik Pazarlaması):** AI asistan botunun, "X konusu hakkında bir rapor hazırla" gibi komutlarla bu modülü tetikleyerek içerik (blog, whitepaper) üretmesini sağlama.
    - [ ] **Kullanım Senaryosu 2 (Stratejik Müşteri Analizi):** Veritabanına eklenen yüksek potansiyelli (belirli kriterlere uyan) lead'ler için bu modülün otomatik olarak tetiklenmesi.
    - [ ] **CRM Entegrasyonu (Analiz Raporu):** Stratejik analiz senaryosu çalıştığında, üretilen Notion raporunun linkinin, ilgili lead'in CRM kaydındaki özel bir alana otomatik olarak eklenmesi.

- [ ] **Modül 2: Sesli Ön Satış Asistanı (Lead Isıtma)**
    - [ ] **Teknoloji Araştırması:** Web tabanlı sesli AI asistanları için en uygun teknolojilerin (örn: Bland.ai, Vapi.ai) araştırılması ve seçilmesi.
    - [ ] **AI Agent Geliştirme:** Potansiyel müşterinin ihtiyaçlarını anlamak, sık sorulan soruları yanıtlamak ve ilgisini ölçmek için bir "ön satış" senaryosu ile eğitilmiş bir sesli bot geliştirilmesi.
    - [ ] **Entegrasyon:** 3. Aşamada "İlgileniyor" ama "Henüz hazır değil" olarak etiketlenen lead'lere, bu sesli asistanla görüşme yapmaları için bir link gönderilmesi.
    - [ ] **Sonuç Aktarımı:** Sesli görüşmenin özetinin ve lead'in "sıcaklık" skorunun CRM'e not olarak eklenmesi, böylece satış ekibinin sadece en hazır lead'lerle toplantı yapmasının sağlanması.
