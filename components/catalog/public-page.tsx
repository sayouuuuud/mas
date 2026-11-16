'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { About } from '@/components/site/about'
import { Sectors } from '@/components/site/sectors'
import { WhatsAppFloat } from '@/components/site/whatsapp-float'
import { brands, categories, sectors } from '@/lib/demo-data'
import {
  DemoNotice,
  DirectionArrow,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import { Catalog, ProductDetail } from './catalog'
import { RequestForm } from './request-form'

export function PublicPage({ path }: { path: string[] }) {
  const { lang } = useLanguage()
  const c = useCopy()
  const [section, slug] = path
  let body
  if (section === 'products' && slug)
    body = <ProductDetail key={slug} slug={slug} />
  else if (section === 'products') body = <Catalog />
  else if (section === 'categories' && slug) {
    const category = categories.find((t) => t.id === slug)!
    body = (
      <Catalog
        category={slug}
        title={category.name[lang]}
        description={category.description[lang]}
      />
    )
  } else if (section === 'brands' && slug) {
    const brand = brands.find((b) => b.id === slug)!
    body = (
      <Catalog
        brand={slug}
        title={brand.name[lang]}
        description={c(
          'منتجات تجريبية توضح تصفح الكتالوج حسب العلامة. لا تمثل ادعاء توزيع أو اعتماد جديد.',
          'Sample entries showing how to browse by brand. This does not establish a new distribution or approval claim.',
        )}
      />
    )
  } else if (section === 'sectors' && slug) {
    const sector = sectors.find((s) => s.id === slug)!
    body = (
      <Catalog
        sector={slug}
        title={sector.name[lang]}
        description={sector.description[lang]}
      />
    )
  } else if (section === 'request-quote' && slug === 'success')
    body = (
      <>
        <PageIntro title={c('حالة الطلب', 'Request status')} />
        <div className="site-container page-section">
          <div className="panel text-center">
            <h2 className="text-2xl font-bold">
              {c('لا يوجد طلب مرسل', 'No request has been sent')}
            </h2>
            <p className="my-5 text-muted-foreground">
              {c(
                'هذه مرحلة معاينة الواجهات. تأكيد الاستلام سيظهر فقط بعد ربط الحفظ الفعلي.',
                'This is an interface preview. A receipt will only be shown after real submission is connected.',
              )}
            </p>
            <Link href="/request-quote" className="btn-primary">
              {c('العودة للطلب', 'Back to request')}
            </Link>
          </div>
        </div>
      </>
    )
  else if (section === 'request-quote' || section === 'contact')
    body = <RequestForm contact={section === 'contact'} />
  else if (section === 'brands')
    body = (
      <>
        <PageIntro
          eyebrow="M.A.S PARTNERS"
          title={c('العلامات التجارية', 'Brands')}
          description={c(
            'استكشف العلامات الموجودة في موقعنا وتصفح منتجات الكتالوج التجريبي.',
            'Explore the brands featured on our site and browse the demo catalog.',
          )}
        />
        <div className="site-container page-section">
          <DemoNotice />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {brands.map((b) => (
              <Link
                href={`/brands/${b.id}`}
                className="directory-card group"
                key={b.id}
              >
                <div className="relative mb-7 flex h-24 w-full items-center justify-center">
                  {b.logo ? (
                    <Image
                      src={b.logo}
                      alt={b.name[lang]}
                      fill
                      sizes="200px"
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary">
                      {b.name[lang]}
                    </span>
                  )}
                </div>
                <h2 className="font-bold">{b.name[lang]}</h2>
                <span className="mt-3 flex items-center gap-2 text-sm text-primary">
                  {c('تصفح المنتجات', 'Browse products')}
                  <DirectionArrow />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  else if (section === 'categories')
    body = (
      <>
        <PageIntro
          title={c('مجموعات المنتجات', 'Product categories')}
          description={c(
            'ابدأ بمجموعة المنتجات المناسبة لطبيعة استخدامك.',
            'Start with the product category that fits your application.',
          )}
        />
        <div className="site-container page-section">
          <div className="grid gap-6 md:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="catalog-card"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={cat.image}
                    alt={cat.name[lang]}
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h2 className="text-2xl font-bold">{cat.name[lang]}</h2>
                  <p className="my-3 text-muted-foreground">
                    {cat.description[lang]}
                  </p>
                  <DirectionArrow />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  else if (section === 'sectors')
    body = (
      <>
        <PageIntro
          title={c('القطاعات التي نخدمها', 'Sectors we serve')}
          description={c(
            'احتياجات مختلفة، ودعم فني يساعدك على اختيار المواصفة المناسبة.',
            'Different needs, with technical support to help you choose the right specification.',
          )}
        />
        <div className="site-container page-section">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((s, i) => (
              <Link
                href={`/sectors/${s.id}`}
                className="directory-card"
                key={s.id}
              >
                <span className="mb-6 block font-mono text-3xl text-primary/30">
                  0{i + 1}
                </span>
                <h2 className="text-xl font-bold">{s.name[lang]}</h2>
                <p className="my-4 leading-7 text-muted-foreground">
                  {s.description[lang]}
                </p>
                <span className="flex items-center gap-2 text-sm font-bold text-primary">
                  {c('المنتجات المرتبطة', 'Related products')}
                  <DirectionArrow />
                </span>
              </Link>
            ))}
          </div>
        </div>
        <Sectors />
      </>
    )
  else if (section === 'about')
    body = (
      <>
        <PageIntro
          eyebrow="ENGINEERING FOR TRADE"
          title={c(
            'خبرة هندسية قريبة من احتياجك',
            'Engineering expertise, close to your needs',
          )}
          description={c(
            'إم إيه إس للتجارة الهندسية — زيوت وشحوم ورمان بلي للمصانع والأساطيل ومراكز الخدمة.',
            'M.A.S Engineering For Trade — oils, greases and bearings for factories, fleets and service centers.',
          )}
        />
        <About />
        <div className="site-container page-section">
          <div className="rounded-2xl bg-surface-tint p-8 sm:p-12">
            <h2 className="text-2xl font-bold">
              {c(
                'من اختيار المواصفة إلى مناقشة التوريد',
                'From choosing a specification to discussing supply',
              )}
            </h2>
            <p className="my-5 max-w-2xl leading-8 text-muted-foreground">
              {c(
                'تصفح مجموعات المنتجات أو اكتب تفاصيل احتياجك لتجهيز استفسار للفريق الفني.',
                'Browse our categories or describe your requirements to prepare an inquiry for the technical team.',
              )}
            </p>
            <Link className="btn-primary" href="/products">
              {c('استكشف الكتالوج', 'Explore the catalog')}
              <DirectionArrow />
            </Link>
          </div>
        </div>
      </>
    )
  else body = <LegalPage type={section} />
  return (
    <>
      <Header />
      <main id="main-content" className="public-main">
        {body}
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}

function LegalPage({ type }: { type: string }) {
  const c = useCopy()
  const privacy = type === 'privacy'
  const blocks = privacy
    ? [
        [
          c('حالة هذه السياسة', 'Policy status'),
          c(
            'هذه مسودة للمعاينة، تحتاج مراجعة واعتماد الشركة قبل تشغيل استقبال البيانات.',
            'This is a preview draft and needs company review before collecting data.',
          ),
        ],
        [
          c('البيانات والغرض', 'Data and purpose'),
          c(
            'عند تفعيل الخدمة قد يُجمع الاسم وبيانات التواصل والشركة وتفاصيل الطلب بغرض الرد وإعداد عروض الأسعار فقط.',
            'Once enabled, name, contact details, company and request details may be collected to respond and prepare quotations.',
          ),
        ],
        [
          c('الوضع الحالي', 'Current preview'),
          c(
            'النماذج الحالية تتحقق من المدخلات داخل المتصفح ولا ترسلها لخادم. سلة المنتجات تحفظ المعرفات والكميات داخل جلسة المتصفح، دون بيانات تواصل.',
            'Current forms validate locally and do not send information to a server. The cart stores product identifiers and quantities in browser session storage, without contact details.',
          ),
        ],
        [
          c('الخدمات الخارجية', 'External services'),
          c(
            'روابط الهاتف والبريد وواتساب تفتح خدمات خارجية تخضع لسياساتها. قد تعمل إحصاءات Vercel العامة على النسخة المنشورة دون تضمين بيانات النماذج.',
            'Phone, email and WhatsApp links open external services with their own policies. General Vercel analytics may run on the deployed site without form data.',
          ),
        ],
        [
          c('الاحتفاظ والحقوق', 'Retention and rights'),
          c(
            'مدة الاحتفاظ وآلية طلب الاطلاع أو التصحيح أو الحذف ستُعتمد قبل تشغيل الباك إند. لا تُرسل معلومات حساسة أثناء تجربة النماذج.',
            'Retention and access, correction and deletion procedures will be approved before backend activation. Do not enter sensitive information while testing.',
          ),
        ],
      ]
    : [
        [
          c('حدود الكتالوج التجريبي', 'Demo catalog limits'),
          c(
            'المنتجات والأكواد والمواصفات التجريبية مخصصة لتجربة الواجهة. لا تُعد بيانات توريد أو تأكيدًا لتوافق فني.',
            'Sample products, codes and specifications demonstrate the interface. They are not supply data or confirmation of technical compatibility.',
          ),
        ],
        [
          c('طلب السعر والتوريد', 'Quotations and supply'),
          c(
            'طلب عرض السعر ليس شراءً أو حجز مخزون. الأسعار والتوفر ومواعيد التوريد تحتاج مراجعة واتفاقًا منفصلًا مع الشركة.',
            'A quote request is not a purchase or stock reservation. Pricing, availability and lead times require separate company confirmation.',
          ),
        ],
        [
          c('حقوق المحتوى والعلامات', 'Content and brands'),
          c(
            'العلامات تخص أصحابها، وأي ادعاء توزيع أو اعتماد يجب تأكيده بالمستندات المعتمدة من الشركة.',
            'Brands belong to their respective owners. Distribution or approval claims must be verified through approved company documentation.',
          ),
        ],
        [
          c('حالة الشروط', 'Terms status'),
          c(
            'مسودة للمعاينة تحتاج مراجعة الشركة قبل الإطلاق التجاري.',
            'Preview draft requiring company approval before commercial launch.',
          ),
        ],
      ]
  return (
    <>
      <PageIntro
        title={
          privacy
            ? c('سياسة الخصوصية', 'Privacy policy')
            : c('شروط الاستخدام', 'Terms of use')
        }
        description={c(
          'مسودة مراجعة — 16 نوفمبر 2026',
          'Review draft — 16 November 2026',
        )}
      />
      <div className="site-container page-section">
        <article className="mx-auto max-w-3xl space-y-8">
          {blocks.map(([heading, text]) => (
            <section className="border-b pb-8" key={heading}>
              <h2 className="mb-3 text-xl font-bold">{heading}</h2>
              <p className="leading-8 text-muted-foreground">{text}</p>
            </section>
          ))}
        </article>
      </div>
    </>
  )
}
