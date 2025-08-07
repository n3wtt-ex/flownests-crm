# Proje Vizyonu: Anahtar Teslim B2B Satış Otomasyon Platformu

## Vizyon

B2B işletmelerin (özellikle yeni yatırım almış SaaS startup'ları ve KOBİ'ler) insan gücüne veya ek kaynaklara ihtiyaç duymadan, uçtan uca ve akıllı bir otomasyonla potansiyel müşteri bulmasını, onlarla etkileşime geçmesini ve satış sürecini yönetmesini sağlayan bir platform oluşturmak. Karmaşık arka plan süreçlerini, müşterinin basit ve konuşma tabanlı bir arayüzle yönetebileceği, anahtar teslim bir çözüm sunmak.

## Nihai Hedef

Müşterilerin sesli veya yazılı komutlarla etkileşime girdiği, yapay zeka destekli bir asistan botu tarafından yönetilen bir web platformu oluşturmak. Bu bot, müşterinin talebini anlayarak doğru otomasyon motorunu (Apollo veya Google Maps) tetikleyecek, 5 aşamalı satış sürecini yürütecek ve her ana aşamanın sonunda müşteriye net, anlaşılır özetler sunacaktır.

## Temel Felsefe

"Müşteriye bir sorunu çözüp başka bir sorun vermemek." Tekerleği yeniden icat etmek yerine, her alandaki en iyi ve en uzmanlaşmış araçları (Apify, BrightData, Instantly, OpenAI, Supabase vb.) bir orkestra şefi gibi yöneterek, müşteriye kusursuz bir deneyim sunmak.

## Yol Haritası (Genel)

1.  **Çekirdek Otomasyonları Geliştirme:** 5 ana satış otomasyonu adımını (Lead Bulma, Kampanya Oluşturma, Yanıt Takibi, Toplantı Ayarlama, CRM Entegrasyonu) modüler n8n iş akışları olarak tamamlamak.
2.  **Motorları Birleştirme:** 1. Aşamada (Lead Bulma) kullanılan iki farklı motoru (Apollo ve Google Maps) tek bir mantık altında birleştirmek.
3.  **Arayüz Entegrasyonu:** n8n iş akışlarını, bir web arayüzü (bolt.ai) ile entegre ederek dışarıdan tetiklenebilir ve yönetilebilir hale getirmek.
4.  **AI Asistanı Geliştirme:** Platformun beyni olacak, açık kaynak bir dil modelini projenin dökümantasyonu ve yetenekleri üzerine eğiterek (fine-tuning), kullanıcı taleplerini anlayan ve doğru iş akışlarını yöneten bir asistan botu oluşturmak ve web sitesine entegre etmek.
