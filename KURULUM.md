# LODER VIDEO — Yayına Alma ve Gerçek Veri Katmanı

Bu paket iki parçadan oluşur:

1. **Statik site** — `index.html`, `loder-core.js`, `oembed-client.js`
2. **Sunucusuz fonksiyon** — `netlify/functions/oembed.js` (anahtar gerektirmez, ücretsiz)

Statik siteyi tek başına yayınlarsanız da çalışır; fonksiyon yüklüyse **gerçek başlık, yayıncı ve küçük resim** gelir.

---

## Neden sunucusuz fonksiyon gerekiyor?

oEmbed servisleri (YouTube, TikTok) tarayıcıdan çağrılamaz — CORS başlığı göndermiyorlar. Fonksiyon araya girip isteği sunucu tarafında yapar ve sonucu siteye döndürür. Bu, hem ücretsiz hem anahtarsız çalışan tek gerçek yoldur.

---

## Netlify'da kurulum (önerilen)

1. **app.netlify.com** adresine gidin, GitHub ile giriş yapın.
2. **Add new site** → **Import an existing project** → **GitHub** seçin.
3. `loder-video` reposunu seçin.
4. Ayarlar:
   - **Branch to deploy**: `gh-pages`
   - **Build command**: boş bırakın
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
5. **Deploy**'a basın.

Site adresiniz `https://XXX.netlify.app` şeklinde olur. Fonksiyon otomatik olarak `/.netlify/functions/oembed` yolunda çalışır ve site onu kendisi bulur.

---

## Vercel'da kurulum

1. Projeyi içe aktarın.
2. `netlify/functions/oembed.js` dosyasını `api/oembed.js` olarak kopyalayın ve sonundaki `module.exports` satırını şu şekilde değiştirin:

```js
module.exports = handler;
```

3. Deploy edin. Site `/api/oembed` yolunu kendisi dener.

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

**Süre ve çözünürlük neden yok?** oEmbed sözleşmesi bu alanları tanımlamaz. Uydurmak yerine alan boş bırakılır ve arayüz "Alınamadı" yazar.

**Video indirme neden yok?** YouTube, TikTok ve Instagram'ın resmî API'leri üçüncü taraf video indirmeye izin vermiyor. Üçüncü taraf indiriciler erişim kontrollerini aşarak çalışır ve eklenmedi.

---

## Testler

```bash
# Çekirdek motor (85 test)
node loder-core.test.js

# oEmbed fonksiyonu (32 test, ağ gerektirmez)
node netlify/functions/oembed.test.mjs
```

---

## Sorun giderme

**Başlık gelmiyor, "Meta bilgi alınamadı" yazıyor.** Fonksiyon yüklenmemiş olabilir. Tarayıcıda `https://SITENIZ/.netlify/functions/oembed?url=https://youtu.be/dQw4w9WgXcQ` adresini açıp JSON görüyor musunuz diye bakın. Görmüyorsanız publish/functions klasör ayarlarını kontrol edin.

**TikTok kısa bağlantısında başlık gelmiyor.** `vt.tiktok.com` bağlantıları yönlendirme gerektirir; oEmbed bunu bazen çözemez. Tam video bağlantısı (`tiktok.com/@kullanici/video/...`) daha güvenilirdir.

**Sayfayı dosyadan açtım, hiçbir meta bilgi gelmiyor.** Normaldir: `file://` protokolünde sunucu yoktur, fonksiyon çağrılamaz. Siteyi yayına alın veya yerel sunucu çalıştırın.
