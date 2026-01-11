import { useState, useEffect } from "react";
import { LogIn, UserPlus, LayoutDashboard, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Header() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHome = location === '/';
  const isPrices = location === '/prices';
  const isFaq = location === '/faq';

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  const handleNavigation = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  const navigationButtons = (
    <>
      <Button 
        variant="ghost" 
        size="sm"
        className={
          "text-xs sm:text-sm break-words" +
          (isHome ? " cursor-default opacity-60 hover:bg-transparent hover:text-inherit" : "")
        }
        onClick={isHome ? undefined : () => handleNavigation(() => setLocation('/'))}
        aria-disabled={isHome}
        tabIndex={isHome ? -1 : 0}
        data-testid="button-home"
      >
        {t('header.home')}
      </Button>
      <Button 
        variant="ghost" 
        size="sm"
        className="text-xs sm:text-sm break-words"
        onClick={() => handleNavigation(() => {
          const element = document.getElementById('trading-analyzer');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            setLocation('/#trading-analyzer');
          }
        })}
        data-testid="button-trading-analyzer"
      >
        {t('header.tradingAnalyzer')}
      </Button>
      <Button 
        variant="ghost" 
        size="sm"
        className="text-xs sm:text-sm break-words"
        onClick={() => handleNavigation(() => {
          const element = document.getElementById('arbitrage-tool');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            setLocation('/#arbitrage-tool');
          }
        })}
        data-testid="button-arbitrage-tool"
      >
        {t('header.arbitrageTool')}
      </Button>
      <Button 
        variant="ghost" 
        size="sm"
        className={
          "text-xs sm:text-sm break-words" +
          (isPrices ? " cursor-default opacity-60 hover:bg-transparent hover:text-inherit" : "")
        }
        onClick={isPrices ? undefined : () => handleNavigation(() => setLocation('/prices'))}
        aria-disabled={isPrices}
        tabIndex={isPrices ? -1 : 0}
        data-testid="button-prices"
      >
        {t('header.prices')}
      </Button>

      <Button 
        variant="ghost" 
        size="sm"
        className={
          "text-xs sm:text-sm break-words" +
          (isFaq ? " cursor-default opacity-60 hover:bg-transparent hover:text-inherit" : "")
        }
        onClick={isFaq ? undefined : () => handleNavigation(() => setLocation('/faq'))}
        aria-disabled={isFaq}
        tabIndex={isFaq ? -1 : 0}
        data-testid="button-faq"
      >
        {t('header.faq')}
      </Button>
      {!isMobile && <LanguageSwitcher />}
    </>
  );

  const authButtons = loading ? (
    <div className="w-24 h-9 bg-muted/50 animate-pulse rounded-lg" />
  ) : user ? (
    <Button 
      size="default"
      className="text-xs sm:text-sm break-words"
      data-testid="button-dashboard"
      onClick={() => handleNavigation(() => setLocation('/dashboard'))}
    >
      <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
      <span className="break-words">{t('header.dashboard')}</span>
    </Button>
  ) : (
    <>
      <Button 
        variant="ghost" 
        size="default"
        className="text-xs sm:text-sm break-words"
        data-testid="button-sign-in"
        onClick={() => handleNavigation(() => setLocation('/auth'))}
      >
        <LogIn className="mr-2 h-4 w-4 shrink-0" />
        <span className="break-words">{t('header.signIn')}</span>
      </Button>
      <Button 
        size="default"
        className="text-xs sm:text-sm break-words"
        data-testid="button-sign-up"
        onClick={() => handleNavigation(() => setLocation('/auth?mode=signup'))}
      >
        <UserPlus className="mr-2 h-4 w-4 shrink-0" />
        <span className="break-words">{t('header.signUp')}</span>
      </Button>
    </>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md" data-testid="header">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setLocation('/')}
            className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hover-elevate px-2 py-1 rounded-lg transition-all break-words"
            data-testid="button-logo"
          >
            Cryptoanaliz
          </button>

          {isMobile ? (
            <>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  data-testid="button-mobile-menu"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
              </div>

              {mobileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 top-[73px] bg-black/20 backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-menu-overlay"
                  />
                  <div className="absolute top-full left-0 right-0 border-b border-border/50 bg-background/95 backdrop-blur-md shadow-lg z-10">
                    <div className="flex flex-col gap-2 p-4 w-full">
                      <div className="flex flex-col gap-2 w-full">
                        {navigationButtons}
                      </div>
                      <div className="border-t border-border/50 my-2" />
                      <div className="flex flex-col gap-2 w-full">
                        {authButtons}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {navigationButtons}
              {authButtons}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
