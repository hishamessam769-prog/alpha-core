# ALPHA PLATFORM V3.3

إعادة هندسة كاملة للواجهة وتجربة الاستخدام فوق نسخة V3.2 الحالية، مع الحفاظ على قاعدة البيانات والـBackend والحسابات والـAuthentication والـRoutes القديمة.

## مهم قبل الرفع

- **لا يوجد SQL جديد في V3.3.**
- لا تشغّل أي Migration لهذا التحديث.
- اترك متغيرات Vercel الحالية كما هي:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- ملف `supabase/upgrade-v3.1.sql` موجود داخل المشروع فقط للحفاظ على هيكل النسخة السابقة، ولا يحتاج لإعادة التشغيل إذا كانت قاعدة V3.1 تعمل بالفعل.

## طريقة الرفع

1. فك ضغط `alpha-platform-v3.3.zip`.
2. ارفع محتويات المجلد إلى مستودع GitHub الحالي واستبدل ملفات الواجهة القديمة.
3. نفّذ Redeploy على Vercel.
4. امسح Cache المتصفح أو نفّذ Hard Refresh بعد اكتمال النشر.

## ما تم تنفيذه

### إعادة تصميم الواجهة

- نظام ألوان جديد High-Tech يعتمد على Navy وCyan وViolet بدل الشكل الأسود والذهبي القديم.
- Navigation جديدة واضحة للمستخدم والمحلل والإدارة.
- بطاقات وأقسام وجداول ونماذج موحدة بصريًا.
- Micro-interactions وScroll Reveal مبنية بـIntersectionObserver وCSS animations بدون Dependency إضافية قد تؤثر على الاستقرار.
- Floating market tickers وAnimated market graph وحركات هادئة تراعي `prefers-reduced-motion`.
- دعم Dark وLight mode في كل الموديولات الجديدة.

### Responsive وإصلاح التخطيط

- إصلاح الـoverlap والـbroken grids في Desktop وTablet وMobile.
- جميع الـCSS grids تستخدم `minmax(0, 1fr)` مع حماية من overflow.
- الجداول داخل Scroll Containers مستقلة، مع Sticky Headers على مستوى خلايا `th` لمنع تداخل الرأس مع البيانات.
- تحسين التفاف النصوص، أحجام العناوين، الـcharts، الـforms والـnavigation على الشاشات الصغيرة.

### Navigation ورحلة المستخدم

- فصل واضح بين:
  - Stock Recommendations
  - News & Analysis
  - Research Reports
  - Portfolios
- إزالة الالتباس القديم بين Recommendations وResearch.
- المستخدم يصل لأهم مساحة مناسبة لدوره مباشرة.
- الـSuper Admin يختار دور العضو أثناء إرسال الدعوة، ويتم تطبيقه فورًا إذا كان الحساب موجودًا بالفعل.
- المحلل أو المساهم يصل إلى Publishing Studio من الهيدر أو من ملفه الشخصي.

### RBAC وصلاحيات الفريق

- Super Admin يستطيع تعيين:
  - Member
  - Contributor
  - Analyst
  - Instructor
  - Admin
  - Super Admin
- كل Role له Preset واضح للصلاحيات والـnavigation والأدوات المتاحة.
- Granular Permission Matrix تستخدم حقل `permissions` تلقائيًا إذا كان موجودًا بالفعل.
- إذا لم يوجد حقل `role` لكن يوجد `title` أو `position`، يتم استخدامه بصورة توافقية لحفظ Analyst / Instructor / Contributor بدون تغيير Schema.
- لا يمكن للمستخدم العادي تفعيل صلاحيات إدارية بمجرد تغيير بيانات ملفه؛ وجود `is_admin` الحالي يظل شرطًا أساسيًا.
- Professional Role أصبح Read-only داخل الملف الشخصي ويتم تعيينه من Team & Access بواسطة Super Admin.

### Creator / Publishing Studio

Route جديد:

- `/admin/publishing`

يحتوي على:

- إنشاء Market News.
- إنشاء Economic Updates.
- حفظ Draft أو Publish مباشرة.
- دعم النص المنسق والصور وروابط YouTube وVimeo والفيديو المباشر.
- Author Attribution تلقائي باستخدام `created_by` الحالي.
- Live Preview.
- Publishing Library لعرض المواد المنشورة والمسودات.
- تعديل المادة الحالية وإعادة نشرها.
- فتح المقال المنشور مباشرة.
- حذف المادة بواسطة Super Admin فقط عبر آلية حذف التقرير الحالية.
- اختصارات مباشرة إلى Portfolio Changes وStock Recommendations وWeekly Reports حسب الصلاحيات.

تم تنفيذ الأخبار الاقتصادية داخل جدول `weekly_reports` الموجود بالفعل باستخدام Slug واضح يبدأ بـ:

- `market-news-`
- `economic-update-`

وبذلك لا يوجد جدول جديد ولا Migration جديد. هذه المواد تظهر داخل News & Analysis ويتم فصلها عن أرشيف Weekly Research Reports في الواجهة.

### Homepage وMarket Intelligence

- Latest Market News وEconomic Highlights وPortfolio Benchmarks في Cards مستقلة.
- Animated Market Pulse graphic.
- Performance highlights وhover/scroll interactions.
- واجهة Landing وMember Dashboard أكثر وضوحًا وقابلية للمسح البصري.

## التوافق الأمني

قاعدة البيانات لم يتم تعديلها بناءً على التعليمات. لذلك:

- `is_admin` و`is_super_admin` يظلان مصدر الصلاحية الأساسي على مستوى الـBackend/RLS.
- Role وPermission persistence المتقدمة تعمل فقط عند وجود حقول متوافقة أصلًا مثل `role`, `permissions`, `title`, أو `position`.
- الواجهة لا تحاول إنشاء أعمدة أو تجاوز RLS أو استخدام Service Role داخل المتصفح.

## Routes

كل Routes V3.2 وعددها 27 محفوظة كما هي، وتمت إضافة Route واحد فقط:

- `/admin/publishing`

## الملفات الحساسة المحفوظة حرفيًا

- `src/lib/calculations.js`
- `src/lib/recommendations.js`
- `src/lib/reporting.js`
- `src/lib/supabase.js`
- `src/lib/zip.js`
- Auth / Language / Settings / Theme contexts
- `supabase/upgrade-v3.1.sql`
