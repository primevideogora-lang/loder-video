/* =========================================================================
   LODER VIDEO — çekirdek bağlantı analiz motoru
   Tarayıcıda (window.LoderCore) ve Node'da (module.exports) çalışır.
   Saf fonksiyonlar: ağ erişimi YOK, sahte veri ÜRETMEZ.
   ========================================================================= */
(function (root) {
  'use strict';

  var PLATFORMS = { YOUTUBE:'youtube', TIKTOK:'tiktok', INSTAGRAM:'instagram', DIRECT:'direct', UNKNOWN:'unknown' };
  var LABELS = { youtube:'YouTube', tiktok:'TikTok', instagram:'Instagram', direct:'Doğrudan Medya', unknown:'Bilinmeyen' };
  var YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function hata(kod, mesaj, cozum) { return { ok:false, kod:kod, mesaj:mesaj, cozum:cozum||null }; }

  var ENGELLI_ADLAR = ['localhost','localhost.localdomain','ip6-localhost','ip6-loopback','metadata','instance-data','metadata.google.internal','metadata.goog'];
  var ENGELLI_ONEKLER = ['10.','127.','169.254.','192.168.','0.','172.16.','172.17.','172.18.','172.19.','172.20.','172.21.','172.22.','172.23.','172.24.','172.25.','172.26.','172.27.','172.28.','172.29.','172.30.','172.31.'];
  var GUVENLI_SEMALAR = ['http:','https:'];
  var MEDYA_UZANTILARI = ['.mp4','.webm','.m4v','.mov','.ogv'];

  function barindiriciGuvenliMi(hostname) {
    if (!hostname) return false;
    var h = hostname.toLowerCase().replace(/^\[|\]$/g,'');
    if (ENGELLI_ADLAR.indexOf(h) !== -1) return false;
    if (h.indexOf('.') === -1) return false;
    if (h.slice(-6) === '.local') return false;
    if (h.slice(-10) === '.localhost') return false;
    if (h.slice(0,4) === '127.') return false;
    for (var i=0;i<ENGELLI_ONEKLER.length;i++) { if (h.indexOf(ENGELLI_ONEKLER[i])===0) return false; }
    if (h.indexOf('::1')===0 || h.indexOf('fc')===0 || h.indexOf('fd')===0 || h.indexOf('fe80')===0) return false;
    if (/^(0x[0-9a-f]+|\d{8,})$/i.test(h)) return false;
    return true;
  }

  function normalizeMetin(g) { return typeof g==='string' ? g.trim().replace(/^[\s"'<]+|[\s"'>]+$/g,'') : ''; }
  function linkCikar(g) { var m=normalizeMetin(g); if(!m) return ''; var x=m.match(/https?:\/\/[^\s<>"')]+/i); return x?x[0]:m; }

  function urlAyristir(girdi) {
    var link = linkCikar(girdi);
    if (!link) return hata('BOS','Bağlantı alanı boş.','Bir TikTok, YouTube, Instagram veya doğrudan video bağlantısı yapıştırın.');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(link)) link = 'https://'+link;
    var u; try { u = new URL(link); } catch(e) { return hata('GECERSIZ_URL','Bu geçerli bir bağlantı değil.','Bağlantıyı tarayıcı adres çubuğundan kopyalayıp tekrar deneyin.'); }
    if (GUVENLI_SEMALAR.indexOf(u.protocol)===-1) return hata('GECERSIZ_SEMA','"'+u.protocol.replace(':','')+'" bağlantı türü desteklenmiyor.','Yalnızca http ve https bağlantıları kabul edilir.');
    if (!u.hostname) return hata('GECERSIZ_URL','Bağlantıda alan adı bulunamadı.','Bağlantıyı kontrol edip tekrar deneyin.');
    if (!barindiriciGuvenliMi(u.hostname)) return hata('GUVENSIZ_HEDEF','Bu adres güvenlik nedeniyle reddedildi.','Yerel ağ ve özel adreslere yapılan istekler engellenir.');
    return { ok:true, url:u, link:u.href };
  }

  function hostEsit(host,liste){ for(var i=0;i<liste.length;i++){var d=liste[i];if(host===d||host.slice(-(d.length+1))==='.'+d)return true} return false }
  var YT_HOSTLAR=['youtube.com','youtu.be','youtube-nocookie.com','m.youtube.com','music.youtube.com'];
  var TT_HOSTLAR=['tiktok.com','vt.tiktok.com','vm.tiktok.com','m.tiktok.com'];
  var IG_HOSTLAR=['instagram.com','instagr.am','www.instagram.com'];

  function medyaUzantisiMi(yol){ var t=String(yol||'').split('?')[0].split('#')[0].toLowerCase(); for(var i=0;i<MEDYA_UZANTILARI.length;i++){ if(t.slice(-MEDYA_UZANTILARI[i].length)===MEDYA_UZANTILARI[i]) return MEDYA_UZANTILARI[i]; } return null }

  function ytVideoId(url){
    var host=url.hostname.toLowerCase(), yol=url.pathname;
    if (hostEsit(host,['youtu.be'])){ var k=yol.replace(/^\/+/,'').split('/')[0]; return YT_ID_RE.test(k)?k:null; }
    var v=url.searchParams.get('v'); if(v&&YT_ID_RE.test(v))return v;
    var o=['/embed/','/v/','/shorts/','/live/','/e/'];
    for(var i=0;i<o.length;i++){ if(yol.indexOf(o[i])===0){ var id=yol.slice(o[i].length).split('/')[0]; if(YT_ID_RE.test(id))return id; } }
    return null;
  }

  function platformAlgila(url){
    var host=url.hostname.toLowerCase(), yol=url.pathname;
    if (hostEsit(host,YT_HOSTLAR)){
      var vid=ytVideoId(url); if(vid) return { ok:true, platform:PLATFORMS.YOUTUBE, videoId:vid, tur:'video' };
      if(/^\/shorts\//i.test(yol)) return hata('GECERSIZ_VIDEO_ID','YouTube Shorts bağlantısındaki video kimliği geçersiz.','Bağlantının tamamını paylaş menüsünden kopyalayın.');
      if(/^\/(playlist|channel|c\/|@|user\/|feed|results)/i.test(yol)) return hata('VIDEO_DEGIL','Bu bağlantı bir video değil.','Bir YouTube videosunun bağlantısını yapıştırın.');
      return hata('VIDEO_DEGIL','YouTube bağlantısında video kimliği bulunamadı.','Video bağlantısının tamamını kopyaladığınızdan emin olun.');
    }
    if (hostEsit(host,TT_HOSTLAR)){
      if (host==='vt.tiktok.com'||host==='vm.tiktok.com'){
        var kod=yol.replace(/^\/+|\/+$/g,'');
        if(!/^[A-Za-z0-9]{6,20}$/.test(kod)) return hata('GECERSIZ_KISA_LINK','TikTok kısa bağlantısı tanınamadı.','Bağlantıyı TikTok uygulamasındaki paylaş menüsünden yeniden kopyalayın.');
        return { ok:true, platform:PLATFORMS.TIKTOK, videoId:kod, tur:'kisa_link', kisaLink:true };
      }
      var mTT=yol.match(/\/video\/(\d{6,25})/); if(mTT) return { ok:true, platform:PLATFORMS.TIKTOK, videoId:mTT[1], tur:'video' };
      var mTT2=yol.match(/\/photo\/(\d{6,25})/); if(mTT2) return { ok:true, platform:PLATFORMS.TIKTOK, videoId:mTT2[1], tur:'fotograf' };
      return hata('VIDEO_DEGIL','TikTok bağlantısında video numarası bulunamadı.','Video bağlantısının tamamını kopyalayın.');
    }
    if (hostEsit(host,IG_HOSTLAR)){
      var mIG=yol.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,20})/i);
      if(mIG){ var tip=mIG[1].toLowerCase(); return { ok:true, platform:PLATFORMS.INSTAGRAM, videoId:mIG[2], tur:(tip==='reel'||tip==='reels')?'reel':(tip==='tv'?'igtv':'gonderi') }; }
      return hata('VIDEO_DEGIL','Instagram bağlantısında gönderi veya Reels adresi bulunamadı.','Bir Reels veya gönderi bağlantısı yapıştırın.');
    }
    var uzanti=medyaUzantisiMi(yol);
    if(uzanti) return { ok:true, platform:PLATFORMS.DIRECT, videoId:null, tur:'dosya', uzanti:uzanti };
    return hata('DESTEKLENMEYEN_PLATFORM','Bu platform desteklenmiyor: '+host,'Yalnızca TikTok, YouTube, Instagram Reels/gönderi ve doğrudan MP4/WebM bağlantıları desteklenir.');
  }

  function analizEt(girdi){
    var parsed=urlAyristir(girdi); if(!parsed.ok) return parsed;
    var url=parsed.url, det=platformAlgila(url);
    if(!det.ok) return { ok:false, kod:det.kod, mesaj:det.mesaj, cozum:det.cozum, platform:PLATFORMS.UNKNOWN, gecerli:false };
    var platform=det.platform, domain=url.hostname.replace(/^www\./,'');
    var sonuc={ ok:true, gecerli:true, platform:platform, platformAdi:LABELS[platform], domain:domain, link:url.href, videoId:det.videoId, tur:det.tur, kisaLink:!!det.kisaLink, istemciIndirme:platform===PLATFORMS.DIRECT&&!!det.uzanti, sunucuEntegrasyonuGerekli:platform!==PLATFORMS.DIRECT, baslik:null, kucukResim:null, sure:null, cozunurluk:null, formatlar:[], notlar:[] };
    if(platform===PLATFORMS.DIRECT){
      sonuc.baslik=dosyaAdi(url.pathname);
      sonuc.notlar.push('Bu bağlantı bir medya dosyasını doğrudan gösteriyor; indirme tarayıcı üzerinden denenebilir.');
      sonuc.notlar.push('Sunucu CORS başlığı göndermiyorsa tarayıcı indirmeyi engelleyebilir. Bu durumda gerçek hata mesajı gösterilir.');
    } else if(platform===PLATFORMS.YOUTUBE){
      sonuc.kucukResim='https://i.ytimg.com/vi/'+det.videoId+'/hqdefault.jpg';
      sonuc.notlar.push('Küçük resim YouTube genel resim adresinden gelir; oEmbed katmanı varsa gerçek küçük resim tercih edilir.');
      sonuc.notlar.push('Süre ve çözünürlük için YouTube Data API anahtarı gerekir — yapılandırılmadı.');
    } else if(platform===PLATFORMS.TIKTOK){
      sonuc.notlar.push(det.kisaLink?'TikTok kısa bağlantısı algılandı. Meta bilgi oEmbed katmanı üzerinden alınır; kısa bağlantının çözümlenmesi sunucu tarafında yapılır.':'Video numarası bağlantıdan okundu.');
      sonuc.notlar.push('Başlık ve yayıncı bilgisi oEmbed katmanından gelir. Süre ve çözünürlük oEmbed servisinde bulunmaz.');
    } else if(platform===PLATFORMS.INSTAGRAM){
      sonuc.notlar.push('Instagram gönderi kodu bağlantıdan okundu.');
      sonuc.notlar.push('Instagram oEmbed servisi erişim anahtarı gerektirir — yapılandırılmadı.');
    }
    return sonuc;
  }

  function dosyaAdi(yol){ try{ var p=decodeURIComponent(String(yol).split('/').pop()||''); return p||'video'; }catch(e){ return String(yol).split('/').pop()||'video'; } }

  function indirmeDurumu(analiz){
    if(!analiz||!analiz.ok) return { aktif:false, etiket:'İndirme kullanılamıyor', aciklama:'Önce geçerli bir bağlantı analiz edin.' };
    if(analiz.platform===PLATFORMS.DIRECT) return { aktif:true, tip:'istemci', etiket:'İndir', aciklama:'Tarayıcı üzerinden doğrudan indirme denenecek.' };
    return { aktif:false, tip:'yapilandirilmamis', etiket:'İndirme yapılandırılmamış', aciklama:analiz.platformAdi+' için indirme entegrasyonu bu kurulumda mevcut değil. Resmî platform API\'leri üçüncü taraf video indirmeye izin vermiyor.' };
  }

  function sureBicimle(saniye){
    if(typeof saniye!=='number'||!isFinite(saniye)||saniye<0) return null;
    var s=Math.floor(saniye), sa=Math.floor(s/3600), dk=Math.floor((s%3600)/60), sn=s%60;
    var iki=function(n){ return (n<10?'0':'')+n };
    return sa>0 ? sa+':'+iki(dk)+':'+iki(sn) : dk+':'+iki(sn);
  }

  var API = { PLATFORMS:PLATFORMS, LABELS:LABELS, analizEt:analizEt, urlAyristir:urlAyristir, platformAlgila:platformAlgila, ytVideoId:ytVideoId, indirmeDurumu:indirmeDurumu, sureBicimle:sureBicimle, barindiriciGuvenliMi:barindiriciGuvenliMi, linkCikar:linkCikar, normalizeMetin:normalizeMetin, medyaUzantisiMi:medyaUzantisiMi };
  if (typeof module!=='undefined' && module.exports) module.exports = API;
  if (root) root.LoderCore = API;
})(typeof globalThis!=='undefined' ? globalThis : this);
