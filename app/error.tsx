'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="site-container py-32 text-center">
      <h1 className="text-3xl font-bold">
        تعذر عرض الصفحة / Unable to display this page
      </h1>
      <p className="my-5 text-muted-foreground">
        حاول مرة أخرى. لم يتم إرسال أي نموذج تلقائيًا.
      </p>
      <button className="btn-primary" onClick={reset}>
        إعادة المحاولة / Retry
      </button>
    </main>
  )
}
