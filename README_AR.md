# ALPHA PLATFORM V3.1

تحديث Incremental فوق النسخة الحالية V3.0. لم يتم إنشاء مشروع جديد، ولم يتم تغيير منطق المحافظ أو التوصيات أو الحسابات أو تسجيل الدخول أو صلاحيات V2.3.1.

## ترتيب الرفع الصحيح

1. افتح Supabase SQL Editor.
2. شغّل ملف `upgrade-v3.1.sql` مرة واحدة فقط.
3. ارفع محتويات المشروع إلى نفس GitHub repository الحالي.
4. اعمل Redeploy من Vercel باستخدام نفس Environment Variables الحالية.

## ما أضافه SQL

- عمود `investment_thesis` داخل holdings.
- جدول `platform_settings` لإدارة الشعار والفوتر والأسعار وإحصائيات Landing Page.
- Storage bucket باسم `platform-assets` لرفع الشعار.
- جداول `support_threads` و`support_messages` للمحادثات وسجل الدعم.
- جدول `survey_responses` للاستبيان وتحليلاته.
- RLS Policies آمنة: المستخدم يرى محادثاته فقط، والإدارة ترى Inbox كاملًا.
- Public RPC يعرض Highlights من البيانات المنشورة فقط.

كل التغييرات Additive ولا تحذف أو تعيد تسمية أي جدول أو عمود موجود.

## أهم التحديثات

- Investment Thesis لكل سهم داخل المحفظة وفي Admin وPDF.
- إصلاح نهائي لتداخل رؤوس الجداول مع الصفوف، مع Horizontal Scroll متجاوب.
- Admin Settings ديناميكية للشعار والفوتر والتواصل والأسعار والـLanding Highlights.
- الشعار المرفوع يظهر تلقائيًا في Header وFooter وتقارير المحافظ والتقارير الأسبوعية وPDF Report Studio.
- المستخدم المسجل يتحول مباشرة إلى Dashboard بدل Landing Page العامة.
- Performance Highlights عامة في Landing Page.
- Copy Direct Link لكل محفظة عبر `/portfolio/:slug`.
- Contact/Feedback Chat للمستخدم مع إرفاق Name وEmail وUser ID تلقائيًا.
- Admin Messenger Inbox مع الرد داخل المنصة أو عبر البريد وسجل كامل للمحادثة.
- Smart Survey غير مزعج، بحد أقصى مرة كل 14 يومًا لكل مستخدم.
- Survey Analytics داخل Admin.
- Light/Dark Theme محفوظ في LocalStorage.

## التشغيل المحلي

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## ملاحظات

- استخدم ملف SQL الخاص بـV3.1 فقط على قاعدة البيانات الحالية.
- لا تنشئ Supabase project جديدًا.
- لا تغيّر مفاتيح Vercel أو Supabase الحالية.
- روابط المحافظ تظل خاضعة لنظام تسجيل الدخول والصلاحيات الحالي.
