# ALPHA PLATFORM V3.6.1 — Notification Center

هذا تحديث إضافي فوق V3.6 ولا يغيّر حسابات المحافظ أو الجداول أو الرسومات أو منطق التوصيات.

## الجديد

- صفحة Super Admin جديدة: `/admin/notifications`
- إرسال إشعار تجريبي للجهاز الحالي.
- إرسال إعلان لكل الأجهزة المشتركة.
- أنواع جاهزة: تحديث منصة، محفظة جديدة، تغيير محفظة، تحديث أداء، توصية، بحث.
- تحديد الرابط الذي يفتح عند الضغط على الإشعار.
- Preview قبل الإرسال.
- عدد الأجهزة والمستخدمين المشتركين.
- سجل الإرسال وعدد الناجح والفاشل.
- Retry للإشعار الفاشل.
- معالجة التنبيهات الأوتوماتيكية المعلقة.

## لا يوجد SQL جديد

إذا تم تشغيل `upgrade-v3.6.sql` سابقًا فلا تشغله مرة ثانية.

## تشغيل الإرسال — بدون Node.js وبدون Supabase CLI

رفع المشروع إلى GitHub يجعل Vercel ينشر صفحة الإشعارات وAPI الإرسال تلقائيًا.

بعد الـDeploy أضف متغيرين فقط داخل:

Vercel > Project Settings > Environment Variables

1. `SUPABASE_SERVICE_ROLE_KEY`
   - من Supabase > Project Settings > API Keys
   - انسخ Service Role Secret
   - لا تضعه في GitHub أبدًا.

2. `VAPID_PRIVATE_KEY`
   - موجود في الملف المنفصل `alpha-platform-v3.6.1-vapid-keys.txt`
   - لا ترفع ملف المفاتيح إلى GitHub.

متغير اختياري:

`VAPID_SUBJECT=mailto:admin@alpha-egx.com`

بعد إضافة المتغيرات اعمل Redeploy واحد من Vercel.

## الاستخدام

1. افتح Admin Workspace.
2. من Manage اختر Notifications أو افتح `/admin/notifications`.
3. اضغط Enable on this device.
4. اكتب عنوانًا ورسالة ورابطًا.
5. اضغط Send test to me.
6. بعد التأكد اضغط Send to all.

كل عميل يجب أن يوافق على تفعيل الإشعارات مرة واحدة قبل أن يستقبل الرسائل.
