import { Download, PlayCircle, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useLanguage } from '@/lib/i18n';
import bitcoinCoin from "@assets/generated_images/Bitcoin_coin_decorative_element_d72218ff.png";

export default function CTASection() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden" data-testid="section-cta">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/30 via-secondary/30 to-accent/30 rounded-full blur-[150px]" />
      </div>

      <div className="absolute top-10 right-[20%] w-24 h-24 opacity-10 animate-pulse">
        <img src={bitcoinCoin} alt="" className="w-full h-full" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6">
        <Card className="p-12 lg:p-16 text-center border-primary/20 backdrop-blur-sm">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">
                {t('cta.title')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('cta.description')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-base px-8 h-12 group"
                data-testid="button-cta-download"
                onClick={() => setLocation('/download')}
              >
                <Download className="mr-2 h-5 w-5" />
                {t('hero.downloadApp')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base px-8 h-12 backdrop-blur-sm"
                data-testid="button-cta-demo"
                onClick={() => setLocation('/demo')}
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                {t('cta.tryDemo')}
              </Button>
              <Button 
                size="lg" 
                variant="ghost" 
                className="text-base px-8 h-12"
                data-testid="button-cta-learn"
                onClick={() => setLocation('/learn-more')}
              >
                <BookOpen className="mr-2 h-5 w-5" />
                {t('hero.learnMore')}
              </Button>
            </div>

            <div className="pt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span>{t('cta.noCard')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span>{t('cta.freeDemo')}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
