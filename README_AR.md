# ALPHA CORE MVP V1

النسخة تحتوي على:
- Landing Page وفلسفة ALPHA CORE.
- تسجيل مجاني بالاسم والإيميل والباسورد.
- Newsletter opt-in.
- Member Dashboard بعد التسجيل.
- Portfolio وEGX30 Capped وMonthly Alpha.
- الأداء التراكمي المركب وTrack Record.
- Decision Log.
- PDF Export.
- Admin Panel خاصة بهشام.
- Draft / Publish / Close Month.
- عدد المستخدمين والمشتركين في Newsletter.
- تحديث مباشر بعد النشر.

ترتيب التشغيل:
1. ارفع محتويات الفولدر إلى GitHub.
2. شغّل supabase/upgrade_mvp_v1.sql مرة واحدة.
3. اربط GitHub بـ Vercel.
4. أضف:
   VITE_SUPABASE_URL
   VITE_SUPABASE_PUBLISHABLE_KEY
5. Deploy.

لا تستخدم Secret Key داخل الموقع.
