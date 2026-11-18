# إعداد بريد Google لإرسال رسائل الحساب

التطبيق يستخدم Supabase Auth لإرسال دعوات الحساب واستعادة كلمة المرور. لهذا تضبط SMTP في Supabase، وليس في Vercel. إضافة `SMTP_HOST` و`SMTP_PASSWORD` إلى Vercel وحدها لا ترسل بريدًا؛ التطبيق لا يقرأ هذه المتغيرات ولا يحتوي ناقل SMTP مستقلًا.

1. افتح [أمان حساب Google](https://myaccount.google.com/security) وفعل التحقق بخطوتين على حساب Gmail الذي سترسل منه.
2. افتح [App passwords](https://myaccount.google.com/apppasswords)، وسم التطبيق `M.A.S Supabase`، وأنشئ كلمة مرور تطبيق. استخدم الرمز المكوّن من 16 محرفًا، دون مسافات، وليس كلمة مرور حساب Google المعتادة. قد لا يظهر الخيار بسبب إعدادات حساب المؤسسة أو Advanced Protection أو طريقة تفعيل التحقق بخطوتين؛ اتبع [شرح Google](https://support.google.com/accounts/answer/185833?hl=ar).
3. افتح [إعداد SMTP لمشروع MAS DB](https://supabase.com/dashboard/project/tzximtqmzsqirkkpxpgr/auth/smtp)، وفعل Custom SMTP، ثم احفظ:

| الحقل | القيمة |
| --- | --- |
| Host | `smtp.gmail.com` |
| Port | `465` مع SSL/TLS؛ أو `587` إذا كانت الواجهة تطلب STARTTLS |
| Username | عنوان Gmail كاملًا |
| Password | كلمة مرور التطبيق التي أنشأتها |
| Sender email | نفس عنوان Gmail، أو عنوان إرسال بديل تم توثيقه في Google |
| Sender name | `M.A.S` |

4. من [إعداد روابط Auth](https://supabase.com/dashboard/project/tzximtqmzsqirkkpxpgr/auth/url-configuration)، اجعل Site URL هو `https://mas-xi.vercel.app` وأضف `https://mas-xi.vercel.app/api/v1/auth/callback` إلى Redirect URLs. إذا غيرت الدومين، حدثهما بالقيم الجديدة.
5. في Vercel تبقى متغيرات الربط الحالية `SUPABASE_URL` و`SUPABASE_PUBLISHABLE_KEY` و`SUPABASE_SECRET_KEY` (أو أسماؤها البديلة المدعومة)، و`SITE_URL=https://mas-xi.vercel.app`. لا تضف كلمة مرور Gmail كمتغير عام `NEXT_PUBLIC_*`، ولا ترسل كلمة مرور التطبيق في الشات.
6. اختبر «نسيت كلمة المرور» لحساب فعلي تملك صندوق بريده، وتحقق من وصول الرسالة وصلاحية الرابط وتعيين كلمة المرور. `admin@test.com` حساب تجريبي ولا نملك صندوق بريده، لذلك لا يثبت تسليم رسائل الاستعادة.

Gmail له حدود إرسال وسياسات مكافحة إساءة الاستخدام. إذا زاد عدد الرسائل، استخدم خدمة مخصصة للبريد التشغيلي. تغيير كلمة مرور Google قد يلغي كلمات مرور التطبيقات، فتحتاج إنشاء رمز جديد وتحديثه داخل Supabase.

المصادر: [Google App passwords](https://support.google.com/accounts/answer/185833) — [Google SMTP](https://support.google.com/a/answer/176600) — [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
