import { useEffect } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import TradingAnalyzerSection from "@/components/TradingAnalyzerSection";
import ArbitrageToolSection from "@/components/ArbitrageToolSection";
import StatsSection from "@/components/StatsSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export default function Home() {
  useEffect(() => {
    // Обработка якорей при загрузке страницы
    const hash = window.location.hash;
    if (hash) {
      const elementId = hash.substring(1); // Убираем #
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // Небольшая задержка для рендеринга
    }
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <TradingAnalyzerSection />
      <ArbitrageToolSection />
      <StatsSection />
      <CTASection />
      <Footer />
      <ScrollToTop />
    </div>
  );
}
