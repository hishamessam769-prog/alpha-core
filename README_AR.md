# ALPHA CORE V2.2

نسخة عملية مبنية فوق V2.1 وتحتفظ بنفس:

- مشروع Supabase
- المستخدمين وحساب الأدمن
- الشهور والمحفظة الحالية
- GitHub Repository
- Vercel Project
- مفاتيح Environment Variables

## أهم الإضافات

### Multiple Portfolios
من لوحة الأدمن `/admin` تستطيع إنشاء أكثر من محفظة. كل محفظة لها شهور وBenchmark وجراف وأداء تراكمي منفصل.

### Independent Recommendations & Research
من `/admin/recommendations` تستطيع إنشاء توصية مستقلة بسعر بداية ومستهدف واحد خلال 12 شهر، وإضافة قصة الشركة والفرضية والإيجابيات والمخاطر والتقييم والتحديثات.

الأعضاء يشاهدونها في:

- `/research`
- `/research/:id`

### Excel Price Import
من `/admin/prices` تستطيع تنزيل قالب Excel ثم رفع ملف أسعار واحد. النظام يحدث تلقائيًا:

- أسعار الأسهم داخل كل الشهور المفتوحة
- Benchmark لكل شهر مفتوح
- عائد المحفظة وAlpha
- السعر الحالي للتوصيات المستقلة المفتوحة
- أداء التوصية مقابل EGX30 Capped

النتائج المغلقة تظل ثابتة.

## ترتيب التثبيت

### 1. تحديث قاعدة البيانات
شغل الملف كاملًا:

`supabase/upgrade_v2_2.sql`

داخل Supabase SQL Editor.

### 2. رفع ملفات الموقع
ارفع الملفات الموجودة داخل فولدر V2.2 إلى جذر GitHub Repository الحالي، ثم Commit changes.

### 3. Vercel
Vercel سيعمل Deploy تلقائيًا. لا تغير Environment Variables الحالية.

## ملف الأسعار
القالب موجود داخل الموقع في:

`/alpha-core-price-template.xlsx`

ويحتوي على الأعمدة:

- Ticker
- Company
- Close
- Date

أضف `EGX30CAP` كسطر عادي لتحديث المؤشر وحساب Alpha.
