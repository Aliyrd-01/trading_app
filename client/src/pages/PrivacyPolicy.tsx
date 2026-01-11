import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useLanguage } from '@/lib/i18n';

export default function PrivacyPolicy() {
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
            {t('privacy.title')}
          </h1>
          
          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.section1.title')}</h2>
              <p>
                {t('privacy.section1.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.section2.title')}</h2>
              <p>
                {t('privacy.section2.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.section3.title')}</h2>
              <p>
                {t('privacy.section3.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.section4.title')}</h2>
              <p>
                {t('privacy.section4.text')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.section5.title')}</h2>
              <p>
                {t('privacy.section5.text')}{' '}
                <a href="mailto:cryptoanalyzpro@gmail.com" className="text-primary hover:underline">
                  cryptoanalyzpro@gmail.com
                </a>
              </p>
            </section>

            <section>
              <p className="text-sm text-muted-foreground/70">
                {t('privacy.lastUpdated')}
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

