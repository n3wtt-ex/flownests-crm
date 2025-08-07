// Bu kod, farklı AI Agent düğümlerinden gelen girdileri işlemek için evrensel olarak tasarlanmıştır.

// 1. Gelen verileri al
// $input.item, bu düğüme doğrudan bağlanan (TR veya EN Agent) düğümden gelen veriyi temsil eder.
const agentItem = $input.item; 
// $('Loop Over Leads').item, döngünün başlangıcındaki orijinal lead verisini getirir.
const leadItem = $('Loop Over Leads').item;

// Hata kontrolü: Gerekli inputların varlığını kontrol et
if (!agentItem || !agentItem.json || !agentItem.json.output) {
  // Hatanın hangi düğümden kaynaklandığını dinamik olarak belirt
  const sourceNode = $executionContext.getNode();
  const connectedNode = sourceNode.getInputNodes(0)[0];
  throw new Error(`Hata: '${connectedNode.name}' düğümünden geçerli bir AI çıktısı alınamadı.`);
}
if (!leadItem || !leadItem.json) {
  throw new Error("Hata: 'Loop Over Leads' düğümünden geçerli bir lead verisi alınamadı.");
}

const agentOutput = agentItem.json.output;
const originalLead = leadItem.json;

// 2. AI çıktısını temizle ve JSON'a çevir
const jsonString = agentOutput.replace(/```json\n/g, '').replace(/\n```/g, '');
let aiData;
try {
  aiData = JSON.parse(jsonString);
} catch (error) {
  throw new Error(`AI çıktısı JSON formatına çevrilemedi. Hata: ${error.message}. Orijinal Çıktı: ${jsonString}`);
}

// 3. Orijinal lead verisi ile AI verisini birleştir
const combinedData = {
  ...originalLead,
  is_qualified: aiData.qualified,
  qualification_reason: aiData.reason,
  generated_subject: aiData.email_subject,
  generated_subject_step2: aiData.email_subject_step2,
  generated_subject_step3: aiData.email_subject_step3,
  generated_body: aiData.email_body_step1,
  generated_body_step2: aiData.email_body_step2,
  generated_body_step3: aiData.email_body_step3
};

// 4. Birleştirilmiş veriyi bir sonraki düğüme gönder
return combinedData;
