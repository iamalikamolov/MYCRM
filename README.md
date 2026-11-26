# MYCRM

Shaxsiy mijoz topish va sotuvlarni kuzatish uchun CRM (Next.js).

## Ishga tushirish

```bash
npm install
npm run dev
```

Keyin brauzerda oching: http://localhost:3000

## Bulutda ishlatish (telefon + kompyuter bir xil ma'lumot)

Vercel'da quyidagi muhit o'zgaruvchilari kerak:

| O'zgaruvchi | Nima |
|---|---|
| `DATABASE_URL` | Neon Postgres ulanishi (Vercel → Storage → Neon qo'shilganda avtomatik) |
| `SESSION_SECRET` | 32+ belgili tasodifiy matn |
| `SETUP_CODE` | Birinchi marta parol o'rnatishda so'raladigan kod |

Ma'lumotlar brauzerda parolingiz bilan shifrlanadi, serverga faqat shifrlangan holda boradi.
`DATABASE_URL` bo'lmasa, ilova faqat shu brauzerda ishlaydi (lokal rejim).
