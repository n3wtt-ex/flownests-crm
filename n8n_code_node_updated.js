// 1. Gelen verileri al
const agentOutput = $('3. Personalization Agent').item.json.output;
const originalLead = $('Loop Over Leads').item.json;

// 2. AI çıktısını temizle ve JSON'a çevir
// ```json ... ``` gibi işaretleri kaldır
const jsonString = agentOutput.replace(/```json\n/g, '').replace(/\n```/g, '');
const aiData = JSON.parse(jsonString);

// 3. Orijinal lead verisi ile AI verisini birleştir
const combinedData = {
  ...originalLead, // Orijinal lead'in tüm alanlarını koru
  is_qualified: aiData.qualified,
  qualification_reason: aiData.reason,
  generated_subject: aiData.email_subject,
  generated_subject_step2: aiData.email_subject_step2, // YENİ - 2. e-posta başlığı
  generated_subject_step3: aiData.email_subject_step3, // YENİ - 3. e-posta başlığı
  // AI çıktısındaki yeni alanları veritabanı sütunlarına eşle
  generated_body: aiData.email_body_step1,       // Step 1'i mevcut 'generated_body' alanına ata
  generated_body_step2: aiData.email_body_step2, // Step 2'yi yeni alana ata
  generated_body_step3: aiData.email_body_step3  // Step 3'ü yeni alana ata
};

// 4. Birleştirilmiş veriyi bir sonraki düğüme gönder
return combinedData;
