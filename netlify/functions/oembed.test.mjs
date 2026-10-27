/* =========================================================================
   LODER VIDEO — oEmbed proxy testleri
   Çalıştırma: node netlify/functions/oembed.test.mjs
   Ağ erişimi GEREKTİRMEZ: fetch taklit edilerek çalışır.
   ========================================================================= */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const handler = require('./oembed.js').handler;

let gecen = 0, kalan = 0;
const basarisiz = [];
let grup = '';

function bolum(ad) { grup = ad; console.log('\n── ' + ad + ' ' + '─'.repeat(Math.max(0, 56 - ad.length))); }

async function test(ad, fn) {
  try { await fn(); gecen++; console.log('  ✓ ' + ad); }
  catch (e) { kalan++; basarisiz.push(grup + ' › ' + ad + ' :: ' + e.message); console.log('  ✗ ' + ad + '\n      → ' + e.message); }
}

function esit(g, b, not) { if (g !== b) throw new Error((not ? not + ' — ' : '') + 'beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(g)); }
function dogru(v, not) { if (!v) throw new Error((not || 'doğru olmalı') + ' — gelen ' + JSON.stringify(v)); }
function yanlis(v, not) { if (v) throw new Error((not || 'yanlış olmalı') + ' — gelen ' + JSON.stringify(v)); }

function govdeCoz(y) { return JSON.parse(y.body); }
function istek(link, yontem = 'GET') {
  if (yontem === 'GET') return { httpMethod: 'GET', queryStringParameters: { url: link } };
  return { httpMethod: 'POST', body: JSON.stringify({ url: link }) };
}

const gercekFetch = globalThis.fetch;
let sonIstek = null, sahteYanit = null;

function fetchKur(y) {
  sahteYanit = y;
  globalThis.fetch = async (url, opts) => { sonIstek = { url: String(url), opts }; return typeof sahteYanit === 'function' ? sahteYanit(url, opts) : sahteYanit; };
}
function fetchSifirla() { globalThis.fetch = gercekFetch; sonIstek = null; sahteYanit = null; }
function jsonYanit(veri, durum = 200) {
  return { ok: durum >= 200 && durum < 300, status: durum, statusText: durum === 200 ? 'OK' : 'Error', text: async () => JSON.stringify(veri) };
}

bolum('1. TikTok — anahtarsız oEmbed');

await test('TikTok tam bağlantı tanınır ve servise gidilir', async () => {
  fetchKur(jsonYanit({ title: 'Test başlığı', author_name: 'test_kullanici', thumbnail_url: 'https://p16-sign.tiktokcdn.com/x.jpg', thumbnail_width: 720, thumbnail_height: 1280 }));
  const g = govdeCoz(await handler(istek('https://www.tiktok.com/@kullanici/video/7212345678901234567')));
  esit(g.ok, true); esit(g.baslik, 'Test başlığı'); esit(g.yazar, 'test_kullanici');
  esit(g.kucukResim, 'https://p16-sign.tiktokcdn.com/x.jpg');
  fetchSifirla();
});

await test('TikTok için doğru servis adresine istek atılır', async () => {
  fetchKur(jsonYanit({ title: 'x' }));
  await handler(istek('https://www.tiktok.com/@a/video/7212345678901234567'));
  dogru(sonIstek.url.startsWith('https://www.tiktok.com/oembed?url='), 'TikTok oEmbed adresi bekleniyordu');
  fetchSifirla();
});

await test('TikTok kısa bağlantısı (vt.tiktok.com) kabul edilir', async () => {
  fetchKur(jsonYanit({ title: 'Kısa link başlığı' }));
  const g = govdeCoz(await handler(istek('https://vt.tiktok.com/ZSgqUeLNC/')));
  esit(g.ok, true); esit(g.baslik, 'Kısa link başlığı');
  fetchSifirla();
});

await test('TikTok vm.tiktok.com kısa bağlantısı kabul edilir', async () => {
  fetchKur(jsonYanit({ title: 'vm link' }));
  esit(govdeCoz(await handler(istek('https://vm.tiktok.com/ZMabcdefg/'))).ok, true);
  fetchSifirla();
});

await test('TikTok yanıtında süre/çözünürlük uydurulmaz', async () => {
  fetchKur(jsonYanit({ title: 'x', duration: 42, width: 1080 }));
  const g = govdeCoz(await handler(istek('https://www.tiktok.com/@a/video/7212345678901234567')));
  yanlis('sure' in g, 'süre alanı üretilmemeli');
  yanlis('cozunurluk' in g, 'çözünürlük alanı üretilmemeli');
  fetchSifirla();
});

bolum('2. YouTube — anahtarsız oEmbed');

await test('YouTube watch bağlantısı tanınır', async () => {
  fetchKur(jsonYanit({ title: 'YT başlık', author_name: 'Kanal', thumbnail_url: 'https://i.ytimg.com/vi/x/hq.jpg' }));
  const g = govdeCoz(await handler(istek('https://www.youtube.com/watch?v=dQw4w9WgXcQ')));
  esit(g.ok, true); esit(g.baslik, 'YT başlık');
  fetchSifirla();
});

await test('YouTube youtu.be kısa bağlantısı tanınır', async () => {
  fetchKur(jsonYanit({ title: 'kısa' }));
  esit(govdeCoz(await handler(istek('https://youtu.be/bs7J4bCEFFY?si=abc'))).ok, true);
  fetchSifirla();
});

await test('YouTube shorts tanınır', async () => {
  fetchKur(jsonYanit({ title: 'shorts' }));
  esit(govdeCoz(await handler(istek('https://www.youtube.com/shorts/dQw4w9WgXcQ'))).ok, true);
  fetchSifirla();
});

await test('YouTube için doğru oEmbed adresine gidilir', async () => {
  fetchKur(jsonYanit({ title: 'x' }));
  await handler(istek('https://youtu.be/dQw4w9WgXcQ'));
  dogru(sonIstek.url.startsWith('https://www.youtube.com/oembed'), 'YouTube oEmbed bekleniyordu');
  fetchSifirla();
});

bolum('3. Instagram — anahtar gerektiği bildirilir');

await test('Instagram için API anahtarı yokluğu açıkça söylenir', async () => {
  const g = govdeCoz(await handler(istek('https://www.instagram.com/reel/De-Lt0WOtF9/')));
  esit(g.ok, false); esit(g.kod, 'API_ANAHTARI_YOK');
  dogru(/erişim anahtarı/.test(g.mesaj), 'anahtar gereksinimi belirtilmeli');
});

await test('Instagram için servise istek atılmaz (sahte sonuç yok)', async () => {
  let cagrildi = false;
  fetchKur(() => { cagrildi = true; return jsonYanit({}); });
  await handler(istek('https://www.instagram.com/reel/De-Lt0WOtF9/'));
  yanlis(cagrildi, 'Instagram için ağ isteği yapılmamalı');
  fetchSifirla();
});

bolum('4. Güvenlik — SSRF ve beyaz liste');

await test('Desteklenmeyen platform reddedilir', async () => {
  const g = govdeCoz(await handler(istek('https://vimeo.com/123456')));
  esit(g.ok, false); esit(g.kod, 'DESTEKLENMEYEN');
});

await test('localhost reddedilir', async () => {
  esit(govdeCoz(await handler(istek('http://localhost/video.mp4'))).ok, false);
});

await test('İç ağ adresi (192.168.x) reddedilir', async () => {
  esit(govdeCoz(await handler(istek('http://192.168.1.1/x'))).ok, false);
});

await test('Bulut metadata adresi reddedilir', async () => {
  esit(govdeCoz(await handler(istek('http://metadata.google.internal/latest/'))).ok, false);
});

await test('Youtube.com taklidi alan adı reddedilir', async () => {
  esit(govdeCoz(await handler(istek('https://youtube.com.evil.example/watch?v=x'))).ok, false, 'sahte alan adı kabul edilmemeli');
});

await test('javascript: şeması reddedilir', async () => {
  esit(govdeCoz(await handler(istek('javascript:alert(1)'))).ok, false);
});

await test('Aşırı uzun bağlantı reddedilir', async () => {
  esit(govdeCoz(await handler(istek('https://youtu.be/' + 'a'.repeat(3000)))).ok, false);
});

await test('SSRF: hiçbir güvensiz hedef için fetch çağrılmaz', async () => {
  let sayac = 0;
  fetchKur(() => { sayac++; return jsonYanit({}); });
  for (const u of ['http://127.0.0.1/x','http://10.0.0.1/x','http://169.254.169.254/x','http://[::1]/x','http://sunucu/x','file:///etc/passwd']) await handler(istek(u));
  esit(sayac, 0, 'güvensiz hedefler için istek yapılmamalı');
  fetchSifirla();
});

bolum('5. Girdi doğrulama ve hata yönetimi');

await test('Boş bağlantı → BOS hatası', async () => {
  const g = govdeCoz(await handler({ httpMethod: 'GET', queryStringParameters: {} }));
  esit(g.ok, false); esit(g.kod, 'BOS');
});

await test('link parametresi de kabul edilir', async () => {
  fetchKur(jsonYanit({ title: 'link param' }));
  const g = govdeCoz(await handler({ httpMethod: 'GET', queryStringParameters: { link: 'https://youtu.be/dQw4w9WgXcQ' } }));
  esit(g.ok, true); esit(g.baslik, 'link param');
  fetchSifirla();
});

await test('POST gövdesiyle çalışır', async () => {
  fetchKur(jsonYanit({ title: 'post' }));
  const g = govdeCoz(await handler({ httpMethod: 'POST', body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }) }));
  esit(g.ok, true); esit(g.baslik, 'post');
  fetchSifirla();
});

await test('Bozuk JSON gövdesi → GECERSIZ_GOVDE', async () => {
  const g = govdeCoz(await handler({ httpMethod: 'POST', body: '{bozuk' }));
  esit(g.ok, false); esit(g.kod, 'GECERSIZ_GOVDE');
});

await test('OPTIONS isteği 204 döner (CORS ön kontrolü)', async () => {
  esit((await handler({ httpMethod: 'OPTIONS' })).statusCode, 204);
});

await test('CORS başlığı her yanıtta var', async () => {
  esit((await handler(istek('https://youtu.be/dQw4w9WgXcQ'))).headers['Access-Control-Allow-Origin'], '*');
});

await test('Servis 404 dönerse anlaşılır hata', async () => {
  fetchKur(jsonYanit({}, 404));
  const g = govdeCoz(await handler(istek('https://www.youtube.com/watch?v=dQw4w9WgXcQ')));
  esit(g.ok, false); esit(g.kod, 'SAGLAYICI_HATASI');
  dogru(/404/.test(g.mesaj), 'durum kodu mesajda olmalı');
  fetchSifirla();
});

await test('Servis geçersiz JSON dönerse hata', async () => {
  fetchKur({ ok: true, status: 200, text: async () => '<html>değil json</html>' });
  const g = govdeCoz(await handler(istek('https://youtu.be/dQw4w9WgXcQ')));
  esit(g.ok, false); esit(g.kod, 'YANIT_COZULEMEDI');
  fetchSifirla();
});

await test('Ağ hatası yakalanır, çökmez', async () => {
  fetchKur(() => { throw new Error('bağlantı koptu'); });
  const g = govdeCoz(await handler(istek('https://youtu.be/dQw4w9WgXcQ')));
  esit(g.ok, false); esit(g.kod, 'BAGLANTI_HATASI');
  fetchSifirla();
});

await test('Zaman aşımı yakalanır, çökmez', async () => {
  fetchKur(() => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
  const g = govdeCoz(await handler(istek('https://youtu.be/dQw4w9WgXcQ')));
  esit(g.ok, false); esit(g.kod, 'BAGLANTI_HATASI');
  dogru(/zaman aşımı/.test(g.mesaj), 'zaman aşımı belirtilmeli');
  fetchSifirla();
});

await test('Girilen bağlantı servise değiştirilmeden gider', async () => {
  fetchKur(jsonYanit({ title: 'x' }));
  await handler(istek('https://www.tiktok.com/@a/video/7212345678901234567'));
  dogru(sonIstek.url.includes(encodeURIComponent('https://www.tiktok.com/@a/video/7212345678901234567')), 'kullanıcı bağlantısı kodlanmış halde iletilmeli');
  fetchSifirla();
});

await test('Yanıt gövdesi JSON olarak serileştirilmiş', async () => {
  fetchKur(jsonYanit({ title: 'x' }));
  const y = await handler(istek('https://youtu.be/dQw4w9WgXcQ'));
  yanlis(typeof y.body === 'object', 'gövde metin olmalı');
  dogru(typeof JSON.parse(y.body) === 'object', 'gövde çözümlenebilmeli');
  fetchSifirla();
});

await test('oEmbed notu süre/çözünürlük olmadığını söyler', async () => {
  fetchKur(jsonYanit({ title: 'x' }));
  const g = govdeCoz(await handler(istek('https://youtu.be/dQw4w9WgXcQ')));
  dogru(/Süre, çözünürlük ve video dosyası/.test(g.not), 'sınır belirtilmeli');
  fetchSifirla();
});

console.log('\n' + '═'.repeat(62));
console.log('  SONUÇ: ' + gecen + ' geçti, ' + kalan + ' başarısız  (toplam ' + (gecen + kalan) + ')');
console.log('═'.repeat(62));
if (kalan > 0) { console.log('\nBAŞARISIZ TESTLER:'); basarisiz.forEach(b => console.log('  • ' + b)); process.exit(1); }
console.log('\nTüm testler geçti.');
