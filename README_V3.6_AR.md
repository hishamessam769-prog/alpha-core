# ALPHA PLATFORM V3.6 — خطوات التثبيت

## أولًا: تحديث قاعدة البيانات

شغّل الملف التالي مرة واحدة فقط داخل Supabase SQL Editor:

`supabase/upgrade-v3.6.sql`

الملف إضافي وآمن: لا يحذف أو يغيّر الجداول القديمة، ويضيف فقط جداول Web Push وسجل Peak Alpha.

## ثانيًا: إنشاء مفاتيح VAPID

من جهاز عليه Node.js شغّل:

```bash
npx web-push generate-vapid-keys
```

احتفظ بالمفتاح الخاص سرًا ولا ترفعه إلى GitHub.

## ثالثًا: إعداد Vercel

أضف Environment Variable:

- `VITE_VAPID_PUBLIC_KEY` = Public Key الناتج من الخطوة السابقة

ثم اعمل Redeploy.

## رابعًا: نشر Edge Function

باستخدام Supabase CLI:

```bash
supabase functions deploy dispatch-push
supabase secrets set VAPID_PUBLIC_KEY="PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
```

مفاتيح Supabase القياسية `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY` تكون متاحة تلقائيًا داخل Edge Functions المستضافة.

## طريقة العمل

- المستخدم يرى طلبًا واضحًا لتفعيل التنبيهات ويضغط Enable.
- نشر توصية جديدة يضيف Event تلقائيًا ثم يرسل Push.
- نشر أو تعديل شهر محفظة يضيف Event تلقائيًا ثم يرسل Push.
- تحديث الأسعار من Excel يضيف Daily Performance Events ثم يرسل Push.
- Service Worker يعرض الإشعار حتى لو التطبيق مغلق، والضغط عليه يفتح الصفحة المرتبطة.

## Peak Alpha

يتم إنشاء سجل زمني لكل Alpha تراكمية منشورة، مع حفظ أعلى قيمة وتاريخها في `portfolio_peak_alpha`.
البيانات الشهرية القديمة تُعمل لها Backfill عند تشغيل SQL. أي قمة داخل الشهر حدثت قبل تثبيت V3.6 ولا يوجد لها سجل سابق لا يمكن استعادتها تاريخيًا، لكن كل التحديثات بعد V3.6 يتم تسجيلها بدقة.
