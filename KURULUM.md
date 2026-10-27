# LODER VIDEO — Yayına Alma ve Gerçek Veri Katmanı

Statik site: `index.html`, `loder-core.js`, `oembed-client.js`
Sunucusuz fonksiyon: `netlify/functions/oembed.js` (anahtar gerektirmez, ücretsiz)

---

## Neden sunucusuz fonksiyon gerekiyor?

oEmbed servisleri (YouTube, TikTok) tarayıcıdan çağrılamaz — CORS başlığı göndermiyorlar. Fonksiyon araya girip isteği sunucu tarafında yapar. Bu, hem ücretsiz hem anahtarsız çalışan tek gerçek yoldur.

---

## Netlify kurulumu

1. **app.netlify.com** → **Add new site** → **Import an existing project** → **GitHub**
2. `loder-video` reposunu seçin
3. Ayarlar:
   - **Branch to deploy**: `main`
   - **Build command**: *(boş)*
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
4. **Deploy**

Adresiniz `https://XXX.netlify.app` olur. Fonksiyon `/.netlify/functions/oembed` yolunda çalışır, site onu kendisi bulur.

---

## Doğrulama

Fonksiyon ayakta mı? Tarayıcıda şunu açın:

```
https://SITENIZ/.netlify/functions/oembed?url=https://youtu.be/dQw4w9WgXcQ
```

JSON görüyorsanız çalışıyor. "Not found" görüyorsanız Functions directory yanlış.

---

## Ne çalışır, ne çalışmaz

| Özellik | Durum | Kaynak |
|---|---|---|
| Bağlantı algılama | ✅ | Yerel kod |
| Platform tespiti | ✅ | Yerel kod |
| URL doğrulama + Türkçe hatalar | ✅ | Yerel kod |
| SSRF koruması | ✅ | Yerel + fonksiyon |
| **Başlık** | ✅ | oEmbed (fonksiyon varsa) |
| **Yayıncı / kanal adı** | ✅ | oEmbed (fonksiyon varsa) |
| **Küçük resim** | ✅ | oEmbed (fonksiyon varsa) |
| Süre | ❌ | oEmbed bu alanı vermez |
| Çözünürlük | ❌ | oEmbed bu alanı vermez |
| Video indirme (YT/TT/IG) | ❌ | Resmî API'ler izin vermiyor |
| Doğrudan MP4/WebM indirme | ⚠️ | Kaynağın CORS iznine bağlı |
| Instagram meta bilgisi | ❌ | Erişim anahtarı gerektirir |

**Süre ve çözünürlük neden yok?** oEmbed sözleşmesi bu alanları tanımlamaz. Uydurmak yerine alan boş bırakılır, arayüz "Alınamadı" yazar.

**İndirme neden yok?** YouTube, TikTok ve Instagram'ın resmî API'leri üçüncü taraf video indirmeye izin vermiyor. Üçüncü taraf indiriciler erişim kontrollerini aşarak çalışır ve eklenmedi.

---

## Testler

```bash
node loder-core.test.js                 # 85 test
node netlify/functions/oembed.test.mjs  # 32 test
```

İkisi de ağ erişimi gerektirmez.

---

## Sorun giderme

**Başlık gelmiyor, "Meta bilgi alınamadı" yazıyor.** Fonksiyon yüklenmemiş. Yukarıdaki doğrulama adresini deneyin.

**TikTok kısa bağlantısında başlık gelmiyor.** `vt.tiktok.com` yönlendirme gerektirir; oEmbed bunu bazen çözemez. Tam bağlantı (`tiktok.com/@kullanici/video/...`) daha güvenilir.

**Sayfayı dosyadan açtım, meta bilgi yok.** Normaldir: `file://` protokolünde sunucu yoktur.
