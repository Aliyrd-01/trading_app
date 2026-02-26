import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Download from "@/pages/Download";
import Prices from "@/pages/Prices";
import VerifyEmail from "@/pages/VerifyEmail";
import ResetPassword from "@/pages/ResetPassword";
import DemoRedirect from "@/pages/DemoRedirect";
import LearnMore from "@/pages/LearnMore";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import FAQ from "@/pages/FAQ";
import NotFound from "@/pages/not-found";
import { DemoVideoProvider } from "@/lib/demoVideoContext";

function TitleUpdater() {
  const { language } = useLanguage();
  const [location] = useLocation();

  useEffect(() => {
    const titles: Record<string, { en: string; uk: string; ru: string }> = {
      '/': {
        en: 'Cryptoanaliz - Smart Trading Tools for Crypto Markets',
        uk: 'Cryptoanaliz - Розумні Торгові Інструменти для Крипторинків',
        ru: 'Cryptoanaliz - Умные Торговые Инструменты для Крипторынков'
      },
      '/auth': {
        en: 'Sign In - Cryptoanaliz',
        uk: 'Вхід - Cryptoanaliz',
        ru: 'Вход - Cryptoanaliz'
      },
      '/dashboard': {
        en: 'Dashboard - Cryptoanaliz',
        uk: 'Панель - Cryptoanaliz',
        ru: 'Панель - Cryptoanaliz'
      },
      '/prices': {
        en: 'Pricing - Cryptoanaliz',
        uk: 'Тарифи - Cryptoanaliz',
        ru: 'Тарифы - Cryptoanaliz'
      },
      '/download': {
        en: 'Download - Cryptoanaliz',
        uk: 'Завантажити - Cryptoanaliz',
        ru: 'Скачать - Cryptoanaliz'
      },
      '/learn-more': {
        en: 'Learn More - Cryptoanaliz',
        uk: 'Детальніше - Cryptoanaliz',
        ru: 'Узнать больше - Cryptoanaliz'
      },
      '/verify-email': {
        en: 'Verify Email - Cryptoanaliz',
        uk: 'Підтвердити Email - Cryptoanaliz',
        ru: 'Подтвердить Email - Cryptoanaliz'
      },
      '/reset-password': {
        en: 'Reset Password - Cryptoanaliz',
        uk: 'Скинути Пароль - Cryptoanaliz',
        ru: 'Сбросить Пароль - Cryptoanaliz'
      },
      '/privacy-policy': {
        en: 'Privacy Policy - Cryptoanaliz',
        uk: 'Політика Конфіденційності - Cryptoanaliz',
        ru: 'Политика Конфиденциальности - Cryptoanaliz'
      },
      '/terms-of-service': {
        en: 'Terms of Service - Cryptoanaliz',
        uk: 'Умови Використання - Cryptoanaliz',
        ru: 'Условия Использования - Cryptoanaliz'
      },
      '/faq': {
        en: 'FAQ - Cryptoanaliz',
        uk: 'FAQ - Cryptoanaliz',
        ru: 'FAQ - Cryptoanaliz'
      }
    };

    const pageTitle = titles[location]?.[language] || titles['/'][language];
    document.title = pageTitle;
  }, [location, language]);

  return null;
}

function ScrollToTopOnRouteChange() {
  const [location] = useLocation();

  useEffect(() => {
    // Прокручиваем страницу в самый верх при изменении маршрута
    try {
      const hasHash = !!(window.location.hash || "").trim();
      if (!hasHash) {
        window.scrollTo(0, 0);
      }
    } catch {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
      <TitleUpdater />
      <ScrollToTopOnRouteChange />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/download" component={Download} />
        <Route path="/prices" component={Prices} />
        <Route path="/demo" component={DemoRedirect} />
        <Route path="/learn-more" component={LearnMore} />
        <Route path="/faq" component={FAQ} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <DemoVideoProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </DemoVideoProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
