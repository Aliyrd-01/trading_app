import { Download, PlayCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from '@/lib/i18n';
import heroImage from "@assets/generated_images/Hero_clay_trader_character_35407cc4.png";
import bitcoinCoin from "@assets/generated_images/Bitcoin_coin_decorative_element_d72218ff.png";
import ethCoin from "@assets/generated_images/Ethereum_coin_decorative_element_1ec73c3d.png";

export default function HeroSection() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-card pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="absolute top-20 right-[10%] w-16 h-16 opacity-40 animate-bounce" style={{ animationDuration: '3s' }}>
        <img src={bitcoinCoin} alt="" className="w-full h-full" />
      </div>
      <div className="absolute bottom-32 left-[15%] w-12 h-12 opacity-30 animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}>
        <img src={ethCoin} alt="" className="w-full h-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight break-words">
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Cryptoanaliz
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground/90 font-medium break-words">
                {t('hero.title')}
              </p>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 break-words">
                {t('hero.description')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center relative z-10">
              <Button 
                size="lg" 
                className="text-xs sm:text-sm md:text-base px-4 sm:px-6 md:px-8 h-10 sm:h-11 md:h-12 break-words relative z-10"
                data-testid="button-download-app"
                onClick={() => setLocation('/download')}
              >
                <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="break-words">{t('hero.downloadApp')}</span>
              </Button>
              <Button 
                size="default" 
                variant="outline" 
                className="text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 backdrop-blur-sm break-words relative z-10"
                data-testid="button-demo-mode"
                onClick={() => setLocation('/demo')}
              >
                <PlayCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="break-words">{t('hero.demoMode')}</span>
              </Button>
              <Button 
                size="default" 
                variant="ghost" 
                className="text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 break-words relative z-10"
                data-testid="button-learn-more"
                onClick={() => setLocation('/learn-more')}
              >
                <BookOpen className="mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="break-words">{t('hero.learnMore')}</span>
              </Button>
            </div>
          </div>

          <div className="relative z-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-secondary/30 to-accent/30 rounded-3xl blur-3xl" />
            <img 
              src={heroImage} 
              alt="Crypto trading character" 
              className="relative w-full h-auto rounded-2xl z-0"
              data-testid="img-hero-character"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
