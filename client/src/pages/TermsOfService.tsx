import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useLanguage } from '@/lib/i18n';

export default function TermsOfService() {
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            {t('terms.title')}
          </h1>
          
          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section1.title')}</h2>
              <p>
                {t('terms.section1.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section2.title')}</h2>
              <p>
                {t('terms.section2.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section3.title')}</h2>
              <p>
                {t('terms.section3.text1')}
              </p>
              <p>
                {t('terms.section3.text2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section4.title')}</h2>
              <p>
                {t('terms.section4.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section5.title')}</h2>
              <p>
                {t('terms.section5.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.section6.title')}</h2>
              <p>
                {t('terms.section6.text')}{' '}
                <a href="mailto:cryptoanalyzpro@gmail.com" className="text-primary hover:underline">
                  cryptoanalyzpro@gmail.com
                </a>
              </p>
            </section>

            <section>
              <p className="text-sm text-muted-foreground/70">
                {t('terms.lastUpdated')}
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}

