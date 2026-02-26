import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download as DownloadIcon, TrendingUp, Repeat } from "lucide-react";
import { useLanguage } from '@/lib/i18n';
import analyzerImage from "@assets/generated_images/Trading_analyzer_clay_character_5152b1a0.png";
import arbitrageImage from "@assets/generated_images/Arbitrage_tool_clay_character_9f75fc74.png";

// Иконки для платформ
const WindowsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V3.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22L10 20.9v-7.15l10 .5z"/>
  </svg>
);

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const LinuxIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.26-.7.47-1.015.47-.442 0-.8-.358-.8-.8 0-.442.358-.8.8-.8.442 0 .8.358.8.8 0 .442-.358.8-.8.8-.315 0-.755-.21-1.015-.47a.424.424 0 00-.11-.135c.123-.805-.01-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491-1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021C.34.01.17.01 0 .01v1.991h.6c.442 0 .8.358.8.8 0 .442-.358.8-.8.8-.442 0-.8-.358-.8-.8 0-.442.358-.8.8-.8H12.504z"/>
  </svg>
);

export default function Download() {
  const { t } = useLanguage();
  
  useEffect(() => {
    // Сначала прокручиваем вверх страницы
    window.scrollTo(0, 0);
    
    // Затем обрабатываем якоря при загрузке страницы
    const hash = window.location.hash;
    if (hash) {
      const elementId = hash.substring(1); // Убираем #
      // Увеличиваем задержку, чтобы страница успела прокрутиться вверх
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          // Учитываем высоту header при прокрутке
          const headerOffset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 300); // Увеличена задержка для корректной прокрутки
    }
  }, []);

  const handleDownload = (product: string, platform: string) => {
    if (product === "trading-analyzer" && platform === "windows") {
      // Путь к exe файлу - нужно будет загрузить его в public папку
      const link = document.createElement("a");
      link.href = "/downloads/cryptotradinganalyzer/CryptoTradingAnalyzer-Setup-latest.exe"; // Путь к файлу
      link.download = "CryptoTradingAnalyzer-Setup-latest.exe";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (product === "arbitrage-tool" && platform === "windows") {
      const link = document.createElement("a");
      link.href = "/downloads/cryptomonitor/CryptoMonitor-Setup-latest.exe";
      link.download = "CryptoMonitor-Setup-latest.exe";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Для других платформ и продуктов - пока заглушка
      console.log(`Download ${product} for ${platform}`);
      alert(`${product} for ${platform} is coming soon!`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="text-center space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t('download.title')}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('download.description')}
              </p>
            </div>
          </div>
        </section>

        {/* Trading Analyzer Download Section */}
        <section id="trading-analyzer" className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <Card className="p-8 lg:p-12 border-primary/20 hover-elevate transition-all duration-300">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/50">
                      {t('trading.badge')}
                    </Badge>
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
                    {t('trading.title')}
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    {t('download.tradingDescription')}
                  </p>
                  
                  <div className="space-y-4 pt-4">
                    <h3 className="font-semibold text-lg">{t('download.downloadFor')}</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-primary/20 hover:border-primary/50"
                        onClick={() => handleDownload("trading-analyzer", "windows")}
                      >
                        <WindowsIcon className="w-8 h-8 text-primary" />
                        <span className="font-semibold">Windows</span>
                        <span className="text-xs text-muted-foreground">.exe</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-primary/20 hover:border-primary/50"
                        onClick={() => handleDownload("trading-analyzer", "mac")}
                      >
                        <AppleIcon className="w-8 h-8 text-primary" />
                        <span className="font-semibold">macOS</span>
                        <span className="text-xs text-muted-foreground">.dmg</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-primary/20 hover:border-primary/50"
                        onClick={() => handleDownload("trading-analyzer", "linux")}
                      >
                        <LinuxIcon className="w-8 h-8 text-primary" />
                        <span className="font-semibold">Linux</span>
                        <span className="text-xs text-muted-foreground">.AppImage</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-3xl blur-3xl" />
                  <Card className="relative p-6 backdrop-blur-sm border-primary/20">
                    <img 
                      src={analyzerImage} 
                      alt="Trading analyzer tool" 
                      className="w-full h-auto rounded-xl"
                    />
                  </Card>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Arbitrage Tool Download Section */}
        <section id="arbitrage-tool" className="py-20 lg:py-32 bg-gradient-to-b from-background to-card">
          <div className="max-w-7xl mx-auto px-6">
            <Card className="p-8 lg:p-12 border-secondary/20 hover-elevate transition-all duration-300">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="relative order-2 lg:order-1">
                  <div className="absolute inset-0 bg-gradient-to-bl from-secondary/20 via-transparent to-accent/20 rounded-3xl blur-3xl" />
                  <Card className="relative p-6 backdrop-blur-sm border-secondary/20">
                    <img 
                      src={arbitrageImage} 
                      alt="Arbitrage trading tool" 
                      className="w-full h-auto rounded-xl"
                    />
                  </Card>
                </div>

                <div className="space-y-6 order-1 lg:order-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                      <Repeat className="w-6 h-6 text-secondary" />
                    </div>
                    <Badge variant="outline" className="text-secondary border-secondary/50">
                      {t('arbitrage.badge')}
                    </Badge>
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
                    {t('arbitrage.title')}
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    {t('download.arbitrageDescription')}
                  </p>
                  
                  <div className="space-y-4 pt-4">
                    <h3 className="font-semibold text-lg">{t('download.downloadFor')}</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-secondary/20 hover:border-secondary/50"
                        onClick={() => handleDownload("arbitrage-tool", "windows")}
                      >
                        <WindowsIcon className="w-8 h-8 text-secondary" />
                        <span className="font-semibold">Windows</span>
                        <span className="text-xs text-muted-foreground">.exe</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-secondary/20 hover:border-secondary/50"
                        onClick={() => handleDownload("arbitrage-tool", "mac")}
                      >
                        <AppleIcon className="w-8 h-8 text-secondary" />
                        <span className="font-semibold">macOS</span>
                        <span className="text-xs text-muted-foreground">.dmg</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 border-secondary/20 hover:border-secondary/50"
                        onClick={() => handleDownload("arbitrage-tool", "linux")}
                      >
                        <LinuxIcon className="w-8 h-8 text-secondary" />
                        <span className="font-semibold">Linux</span>
                        <span className="text-xs text-muted-foreground">.AppImage</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}

