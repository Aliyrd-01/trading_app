import { Repeat, Timer, DollarSign, Shield, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from '@/lib/i18n';
import arbitrageImage from "@assets/generated_images/Arbitrage_tool_clay_character_9f75fc74.png";

export default function ArbitrageToolSection() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const features = [
    {
      icon: Repeat,
      titleKey: "arbitrage.feature1.title",
      descriptionKey: "arbitrage.feature1.description"
    },
    {
      icon: Timer,
      titleKey: "arbitrage.feature2.title",
      descriptionKey: "arbitrage.feature2.description"
    },
    {
      icon: DollarSign,
      titleKey: "arbitrage.feature3.title",
      descriptionKey: "arbitrage.feature3.description"
    },
    {
      icon: Shield,
      titleKey: "arbitrage.feature4.title",
      descriptionKey: "arbitrage.feature4.description"
    }
  ];
  
  return (
    <section id="arbitrage-tool" className="relative py-20 lg:py-32 bg-gradient-to-b from-background to-card overflow-hidden" data-testid="section-arbitrage-tool">
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent opacity-50" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight break-words">
                {t('arbitrage.title')}
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground break-words">
                {t('arbitrage.description')}
              </p>
            </div>

            <div className="grid gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="p-6 hover-elevate transition-all duration-300 border-card-border"
                  data-testid={`card-arbitrage-feature-${index}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-secondary" />
                      </div>
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="font-semibold text-base sm:text-lg break-words">{t(feature.titleKey)}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">{t(feature.descriptionKey)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            <div className="pt-4">
              <Button 
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto break-words"
                onClick={() => setLocation('/download#arbitrage-tool')}
              >
                <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="break-words">{t('arbitrage.downloadButton')}</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-bl from-secondary/20 via-transparent to-accent/20 rounded-3xl blur-3xl" />
            <Card className="relative p-8 backdrop-blur-sm border-secondary/20">
              <img 
                src={arbitrageImage} 
                alt="Arbitrage trading tool" 
                className="w-full h-auto rounded-xl"
                data-testid="img-arbitrage-tool"
              />
              <div className="absolute -top-4 -right-4">
                <Badge className="px-4 py-2 text-sm bg-secondary/90 backdrop-blur-sm text-secondary-foreground">
                  24/7 Monitoring
                </Badge>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
