# ALPHA PLATFORM V3.2

تحديث واجهة وتجربة استخدام Modular فوق ALPHA PLATFORM V3.1 الحالية.

## مهم جدًا قبل الرفع

- لا يوجد أي SQL جديد في V3.2.
- لا تشغّل Migration إضافي لهذا التحديث.
- قاعدة البيانات والـBackend والـAuthentication والحسابات والـAPIs القديمة لم يتم تغييرها.
- ملف `supabase/upgrade-v3.1.sql` موجود فقط لأنه جزء من المشروع السابق، ولا يحتاج لإعادة التشغيل إذا كانت V3.1 تعمل حاليًا.

## طريقة الرفع

1. فك ضغط الملف.
2. انسخ محتويات المشروع إلى مستودع GitHub الحالي مع استبدال ملفات الواجهة.
3. اترك متغيرات Vercel الحالية كما هي:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. نفّذ Redeploy على Vercel.

## ما الجديد في V3.2

### تجربة بصرية وحركة
- Scroll reveal animations بدون إضافة dependency جديدة.
- Financial market SVG graphics وحركات خفيفة تراعي `prefers-reduced-motion`.
- تحسينات Micro-interactions وحالات Skeleton.
- Responsive كامل للموبايل والتابلت والكمبيوتر.

### الأخبار والتحليل
- Market News & Economic Events widget داخل Dashboard.
- صفحة News & Analysis موحدة.
- Rich Article View يدعم النص المنسق وروابط الصور وYouTube وVimeo.
- الأخبار تستخدم البيانات المنشورة الموجودة بالفعل: التقارير الأسبوعية والتوصيات وتحديثاتها، بدون إنشاء جدول جديد.

### المحافظ
- صفحة Portfolios Index جديدة ببطاقات Performance مرئية.
- Quick return وAlpha وBenchmark وعدد المراكز وآخر شهر.
- اسم وصورة منشئ المحفظة مع رابط الملف العام.
- صفحة المحفظة الداخلية وحساباتها كما هي، مع الحفاظ على Month/Date selector وتحسين وضوح الجداول.

### ملفات المحللين
- صفحة عامة لكل Author تعرض السيرة والدور.
- المحافظ التي أنشأها.
- التوصيات المفتوحة والمغلقة.
- التقارير والأبحاث المنشورة.
- مؤشرات Success Rate وAverage Return وHolding Period وAlpha.

### الفريق والصلاحيات
- صفحة Team & Access للـSuper Admin.
- دعوة حسابات جديدة عبر Supabase OTP القياسي.
- إدارة Member وAdmin وSuper Admin باستخدام الحقول الحالية.
- Analyst وInstructor وGranular Permissions تعمل تلقائيًا فقط إذا كانت الحقول المقابلة موجودة أصلًا في قاعدة البيانات.

## ملاحظة RBAC صريحة

لأن المطلوب يمنع أي تغيير في قاعدة البيانات أو الـBackend، لا يمكن فرض Roles جديدة أو Granular Permissions جديدة على مستوى أمني دائم إذا لم تكن أعمدتها موجودة بالفعل. لذلك V3.2 تعمل بوضع توافق آمن:

- تستخدم `is_admin` و`is_super_admin` الحاليين فعليًا.
- لا تدّعي حفظ Analyst أو Instructor أو Permission Matrix في قاعدة لا تحتوي حقولها.
- تعرض رسالة واضحة داخل Admin بدل إجراء تعديل غير آمن أو كسر النظام.

## Routes المضافة

- `/portfolios`
- `/news`
- `/news/:kind/:id`
- `/analysts/:id`
- `/admin/team`

كل Routes V3.1 القديمة ما زالت موجودة بدون حذف أو تغيير.
