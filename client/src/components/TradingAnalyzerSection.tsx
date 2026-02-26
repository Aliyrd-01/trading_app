import { TrendingUp, Target, BarChart3, Zap, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from '@/lib/i18n';
import analyzerImage from "@assets/generated_images/Trading_analyzer_clay_character_5152b1a0.png";

export default function TradingAnalyzerSection() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const features = [
    {
      icon: TrendingUp,
      titleKey: "trading.feature1.title",
      descriptionKey: "trading.feature1.description"
    },
    {
      icon: Target,
      titleKey: "trading.feature2.title",
      descriptionKey: "trading.feature2.description"
    },
    {
      icon: BarChart3,
      titleKey: "trading.feature3.title",
      descriptionKey: "trading.feature3.description"
    },
    {
      icon: Zap,
      titleKey: "trading.feature4.title",
      descriptionKey: "trading.feature4.description"
    }
  ];
  
  return (
    <section id="trading-analyzer" className="relative py-20 lg:py-32 overflow-hidden" data-testid="section-trading-analyzer">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-3xl blur-3xl" />
            <Card className="relative p-8 backdrop-blur-sm border-card-border">
              <img 
                src={analyzerImage} 
                alt="Trading analyzer tool" 
                className="w-full h-auto rounded-xl"
                data-testid="img-trading-analyzer"
              />
              <div className="absolute -top-4 -right-4">
                <Badge className="px-4 py-2 text-sm bg-primary/90 backdrop-blur-sm">
                  AI Powered
                </Badge>
              </div>
            </Card>
          </div>

          <div className="space-y-8 order-1 lg:order-2">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight break-words">
                {t('trading.title')}
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground break-words">
                {t('trading.description')}
              </p>
            </div>

            <div className="grid gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="p-6 hover-elevate transition-all duration-300 border-card-border"
                  data-testid={`card-feature-${index}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-primary" />
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
                className="w-full sm:w-auto break-words"
                onClick={() => setLocation('/download#trading-analyzer')}
              >
                <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="break-words">{t('trading.downloadButton')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
