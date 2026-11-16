import { QuoteProvider } from '@/components/quote-provider'
import { About } from '@/components/site/about'
import { BrandMarquee } from '@/components/site/brand-marquee'
import { Footer } from '@/components/site/footer'
import { Header } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Partners } from '@/components/site/partners'
import { Products } from '@/components/site/products'
import { QuoteContact } from '@/components/site/quote-contact'
import { Sectors } from '@/components/site/sectors'
import { WhatsAppFloat } from '@/components/site/whatsapp-float'

export default function Home() {
  return (
    <QuoteProvider>
      <Header />
      <main id="main-content">
        <Hero />
        <BrandMarquee />
        <About />
        <Products />
        <Partners />
        <Sectors />
        <QuoteContact />
      </main>
      <Footer />
      <WhatsAppFloat />
    </QuoteProvider>
  )
}
