import { Mail, Send, Github, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from '@/lib/i18n';

export default function Footer() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  return (
    <footer className="relative border-t border-border/50 bg-card/50 backdrop-blur-sm" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
              Cryptoanaliz
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">
              {t('footer.description')}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-base sm:text-lg break-words">{t('footer.quickLinks')}</h4>
            <div className="flex flex-col space-y-2">
              <Button 
                variant="ghost" 
                className="justify-start px-0 h-auto text-xs sm:text-sm break-words"
                data-testid="link-trading-analyzer"
                onClick={() => {
                  const element = document.getElementById('trading-analyzer');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    setLocation('/');
                    window.location.hash = 'trading-analyzer';
                  }
                }}
              >
                {t('header.tradingAnalyzer')}
              </Button>
              <Button 
                variant="ghost" 
                className="justify-start px-0 h-auto text-xs sm:text-sm break-words"
                data-testid="link-arbitrage-tool"
                onClick={() => {
                  const element = document.getElementById('arbitrage-tool');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    setLocation('/');
                    window.location.hash = 'arbitrage-tool';
                  }
                }}
              >
                {t('header.arbitrageTool')}
              </Button>
              <Button 
                variant="ghost" 
                className="justify-start px-0 h-auto text-xs sm:text-sm break-words"
                data-testid="link-demo"
                onClick={() => setLocation('/demo')}
              >
                {t('hero.demoMode')}
              </Button>

              <Button 
                variant="ghost" 
                className="justify-start px-0 h-auto text-xs sm:text-sm break-words"
                data-testid="link-faq"
                onClick={() => setLocation('/faq')}
              >
                {t('header.faq')}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-base sm:text-lg break-words">{t('footer.contactUs')}</h4>
            <div className="space-y-3">
              <a 
                href="mailto:cryptoanalyzpro@gmail.com" 
                className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors group break-words"
                data-testid="link-email"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <span className="break-all">cryptoanalyzpro@gmail.com</span>
              </a>
              <a 
                href="https://t.me/cryptoanalyzpro" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors group break-words"
                data-testid="link-telegram"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                </div>
                <span className="break-words">@cryptoanalyzpro</span>
              </a>
            </div>

            {/* <div className="flex gap-2 pt-4">
              <Button 
                size="icon" 
                variant="outline"
                data-testid="button-github"
                onClick={() => console.log('GitHub clicked')}
              >
                <Github className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                variant="outline"
                data-testid="button-twitter"
                onClick={() => console.log('Twitter clicked')}
              >
                <Twitter className="w-5 h-5" />
              </Button>
            </div> */}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs sm:text-sm text-muted-foreground">
            <p className="break-words text-center md:text-left">© 2025 Cryptoanaliz. {t('footer.copyright')}</p>
            <div className="flex gap-4 sm:gap-6 flex-wrap justify-center">
              <Button 
                variant="ghost" 
                className="h-auto p-0 text-xs sm:text-sm break-words"
                data-testid="link-privacy"
                onClick={() => setLocation('/privacy-policy')}
              >
                {t('footer.privacy')}
              </Button>
              <Button 
                variant="ghost" 
                className="h-auto p-0 text-xs sm:text-sm break-words"
                data-testid="link-terms"
                onClick={() => setLocation('/terms-of-service')}
              >
                {t('footer.terms')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
