/* =========================================================================
   LODER VIDEO — site ile oEmbed katmanını bağlayan istemci betiği
   Sunucu yoksa sessizce devre dışı kalır; sahte veri ÜRETİLMEZ.
   ========================================================================= */
'use strict';

var OEmbed = (function () {
  var UC_NOKTALARI = ['/.netlify/functions/oembed','/api/oembed','/oembed'];
  var secilenUc = null;
  var ZAMAN_ASIMI_MS = 9000;

  function ucBul() {
    if (secilenUc) return Promise.resolve(secilenUc);
    var denemeler = UC_NOKTALARI.map(function (yol) {
      return denemeIstegi(yol).then(function (ok) { return ok ? yol : null; });
    });
    return Promise.all(denemeler).then(function (s) {
      for (var i = 0; i < s.length; i++) { if (s[i]) { secilenUc = s[i]; return secilenUc; } }
      return null;
    });
  }

  function denemeIstegi(yol) {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    if (location.protocol === 'file:') return Promise.resolve(false);
    var denetleyici = null, zaman = null;
    var secenekler = { method:'GET', mode:'cors', credentials:'omit' };
    if (typeof AbortController !== 'undefined') {
      denetleyici = new AbortController();
      secenekler.signal = denetleyici.signal;
      zaman = setTimeout(function () { denetleyici.abort(); }, 4000);
    }
    return fetch(yol + '?url=' + encodeURIComponent('https://youtu.be/dQw4w9WgXcQ'), secenekler)
      .then(function (r) {
        if (zaman) clearTimeout(zaman);
        if (!r.ok) return false;
        return r.json().then(function (g) { return g && typeof g === 'object'; });
      })
      .catch(function () { if (zaman) clearTimeout(zaman); return false; });
  }

  function hazirMi() { return ucBul().then(function (yol) { return !!yol; }); }

  function bilgiAl(link) {
    return ucBul().then(function (yol) {
      if (!yol) return { ok:false, kod:'KATMAN_YOK', mesaj:'oEmbed katmanı bu kurulumda erişilebilir değil. Sunucusuz fonksiyon yüklenmemiş ya da sayfa dosyadan açılmış.' };
      var denetleyici = null, zaman = null;
      var secenekler = { method:'GET', mode:'cors', credentials:'omit' };
      if (typeof AbortController !== 'undefined') {
        denetleyici = new AbortController();
        secenekler.signal = denetleyici.signal;
        zaman = setTimeout(function () { denetleyici.abort(); }, ZAMAN_ASIMI_MS);
      }
      return fetch(yol + '?url=' + encodeURIComponent(link), secenekler)
        .then(function (r) {
          if (zaman) clearTimeout(zaman);
          return r.json().then(function (g) {
            if (!g || typeof g !== 'object') return { ok:false, kod:'GECERSIZ_YANIT', mesaj:'Katman geçersiz yanıt döndürdü.' };
            return g;
          });
        })
        .catch(function (e) {
          if (zaman) clearTimeout(zaman);
          var neden = (e && e.name === 'AbortError') ? 'Meta bilgi isteği zaman aşımına uğradı.' : 'Meta bilgi alınamadı: ' + ((e && e.message) || 'bilinmeyen hata');
          return { ok:false, kod:'BAGLANTI_HATASI', mesaj:neden };
        });
    });
  }

  return { hazirMi:hazirMi, bilgiAl:bilgiAl, _ucBul:ucBul, _sifirla:function(){ secilenUc = null; } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = OEmbed;
if (typeof window !== 'undefined') window.OEmbed = OEmbed;
