/* =========================================================================
   LODER VIDEO — oEmbed proxy (sunucusuz fonksiyon)
   Netlify Functions / Vercel API route uyumlu.
   Anahtar GEREKMEZ, ücret GEREKMEZ. Yalnızca genel meta bilgi döndürür.
   ========================================================================= */
'use strict';

var ZAMAN_ASIMI_MS = 8000;
var MAKS_YANIT_BAYT = 200000;

var SAGLAYICILAR = {
  youtube: {
    ad: 'YouTube',
    desenler: [
      /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\/watch\?/i,
      /^https?:\/\/(www\.|m\.)?youtube\.com\/shorts\//i,
      /^https?:\/\/youtu\.be\//i,
      /^https?:\/\/(www\.)?youtube-nocookie\.com\/embed\//i
    ],
    uc: function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); }
  },
  tiktok: {
    ad: 'TikTok',
    desenler: [
      /^https?:\/\/(www\.|m\.)?tiktok\.com\/@[^\/]+\/video\/\d+/i,
      /^https?:\/\/(www\.|m\.)?tiktok\.com\/@[^\/]+\/photo\/\d+/i,
      /^https?:\/\/vt\.tiktok\.com\/[A-Za-z0-9]+/i,
      /^https?:\/\/vm\.tiktok\.com\/[A-Za-z0-9]+/i
    ],
    uc: function (u) { return 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(u); }
  },
  instagram: {
    ad: 'Instagram',
    desenler: [ /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i ],
    uc: function () { return null; }
  }
};

var YASAKLI_ADLAR = ['localhost','localhost.localdomain','ip6-localhost','ip6-loopback','metadata','metadata.google.internal','instance-data'];
var YASAKLI_ONEKLER = ['10.','127.','169.254.','192.168.','0.','172.16.','172.17.','172.18.','172.19.','172.20.','172.21.','172.22.','172.23.','172.24.','172.25.','172.26.','172.27.','172.28.','172.29.','172.30.','172.31.'];

function adGuvenliMi(host) {
  if (!host) return false;
  var h = String(host).toLowerCase().replace(/^\[|\]$/g,'');
  if (YASAKLI_ADLAR.indexOf(h) !== -1) return false;
  if (h.indexOf('.') === -1) return false;
  if (/\.local$|\.localhost$/.test(h)) return false;
  for (var i = 0; i < YASAKLI_ONEKLER.length; i++) { if (h.indexOf(YASAKLI_ONEKLER[i]) === 0) return false; }
  if (/^(::1|fc|fd|fe80)/.test(h)) return false;
  if (/^(0x[0-9a-f]+|\d{8,})$/i.test(h)) return false;
  return true;
}

function saglayiciBul(link) {
  if (typeof link !== 'string') return null;
  var temiz = link.trim();
  if (!temiz || temiz.length > 2048) return null;
  var u; try { u = new URL(temiz); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!adGuvenliMi(u.hostname)) return null;
  var anahtarlar = Object.keys(SAGLAYICILAR);
  for (var i = 0; i < anahtarlar.length; i++) {
    var k = anahtarlar[i], s = SAGLAYICILAR[k];
    for (var j = 0; j < s.desenler.length; j++) { if (s.desenler[j].test(temiz)) return { anahtar:k, saglayici:s }; }
  }
  return null;
}

function json(govde, durum) {
  return {
    statusCode: durum || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600'
    },
    body: JSON.stringify(govde)
  };
}

function hata(kod, mesaj, durum) { return json({ ok:false, kod:kod, mesaj:mesaj }, durum || 200); }

function yanitEslе(saglayiciAdi, veri) {
  var cikti = { ok:true, saglayici:saglayiciAdi, baslik:null, yazar:null, kucukResim:null, genislik:null, yukseklik:null, kaynak:'oEmbed' };
  if (veri && typeof veri === 'object') {
    if (typeof veri.title === 'string' && veri.title.trim()) cikti.baslik = veri.title.trim();
    if (typeof veri.author_name === 'string' && veri.author_name.trim()) cikti.yazar = veri.author_name.trim();
    if (typeof veri.thumbnail_url === 'string' && /^https?:\/\//i.test(veri.thumbnail_url)) cikti.kucukResim = veri.thumbnail_url;
    if (typeof veri.thumbnail_width === 'number') cikti.genislik = veri.thumbnail_width;
    if (typeof veri.thumbnail_height === 'number') cikti.yukseklik = veri.thumbnail_height;
  }
  cikti.not = 'oEmbed yalnızca başlık, yazar ve küçük resim sağlar. Süre, çözünürlük ve video dosyası bu serviste mevcut değildir.';
  return cikti;
}

async function handler(olay) {
  var yontem = (olay.httpMethod || olay.method || 'GET').toUpperCase();
  if (yontem === 'OPTIONS') return { statusCode: 204, headers: json({}).headers, body: '' };

  var link = '';
  if (yontem === 'GET') {
    var q = olay.queryStringParameters || {};
    link = q.url || q.link || '';
  } else {
    try {
      var govde = olay.body;
      if (typeof govde === 'string') govde = JSON.parse(govde || '{}');
      link = (govde && (govde.url || govde.link)) || '';
    } catch (e) { return hata('GECERSIZ_GOVDE','İstek gövdesi okunamadı.', 400); }
  }

  if (!link || typeof link !== 'string') return hata('BOS','Bağlantı gönderilmedi.', 400);

  var bulunan = saglayiciBul(link);
  if (!bulunan) return hata('DESTEKLENMEYEN','Bu bağlantı için oEmbed desteği yok.', 400);
  var saglayici = bulunan.saglayici;

  if (bulunan.anahtar === 'instagram') {
    return hata('API_ANAHTARI_YOK','Instagram oEmbed servisi erişim anahtarı gerektiriyor. Anahtar yapılandırılmadığı için Instagram bilgileri alınamıyor.');
  }

  var hedef = saglayici.uc(link);
  if (!hedef) return hata('YAPILANDIRILMAMIS', saglayici.ad + ' entegrasyonu yapılandırılmamış.');

  var hedefHost; try { hedefHost = new URL(hedef).hostname; } catch (e) { return hata('HEDEF_GECERSIZ','Servis adresi çözümlenemedi.', 500); }
  if (!adGuvenliMi(hedefHost)) return hata('HEDEF_GUVENSIZ','Servis adresi güvenlik kontrolünden geçemedi.', 500);

  var denetleyici = new AbortController();
  var zamanlayici = setTimeout(function () { denetleyici.abort(); }, ZAMAN_ASIMI_MS);

  try {
    var yanit = await fetch(hedef, {
      method: 'GET',
      headers: { 'Accept':'application/json', 'User-Agent':'LODER-VIDEO/1.0 (oEmbed proxy)' },
      signal: denetleyici.signal
    });
    clearTimeout(zamanlayici);

    if (!yanit.ok) {
      return hata('SAGLAYICI_HATASI', saglayici.ad + ' servisi ' + yanit.status + ' yanıtı döndürdü. Video silinmiş veya gizli olabilir.');
    }

    var ham = await yanit.text();
    if (ham.length > MAKS_YANIT_BAYT) return hata('YANIT_COK_BUYUK','Servis yanıtı beklenenden büyük.');

    var veri;
    try { veri = JSON.parse(ham); } catch (e) { return hata('YANIT_COZULEMEDI', saglayici.ad + ' servisi geçersiz yanıt döndürdü.'); }

    return json(yanitEslе(saglayici.ad, veri));
  } catch (e) {
    clearTimeout(zamanlayici);
    var neden = (e && e.name === 'AbortError') ? 'Servis zaman aşımına uğradı.' : 'Servise bağlanılamadı: ' + ((e && e.message) || 'bilinmeyen hata');
    return hata('BAGLANTI_HATASI', neden);
  }
}

module.exports = { handler: handler };
module.exports.handler = handler;
