import { useEffect } from "react";
import { ArrowRight, Bell, Bot, ChartLine, GraduationCap, LineChart, Settings2, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useLocation } from "wouter";

export default function LearnMore() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const screenshots = [
    {
      titleKey: "learnMore.screens.shot1",
      src: "/learn-more-assets/beginner-mode.jpg",
      aspectClass: "aspect-[16/10]",
    },
    {
      titleKey: "learnMore.screens.shot2",
      src: "/learn-more-assets/advanced-mode.jpg",
      aspectClass: "aspect-[16/10]",
    },
    {
      titleKey: "learnMore.screens.shot3",
      src: "/learn-more-assets/auto-signals.jpg",
      aspectClass: "aspect-[3/4]",
    },
    {
      titleKey: "learnMore.screens.shot4",
      src: "/learn-more-assets/real-time-chart.jpg",
      aspectClass: "aspect-[16/10]",
    },
  ] as const;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {t("learnMore.title")}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-3xl">
              {t("learnMore.subtitle")}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setLocation("/demo")} className="w-full sm:w-auto">
                {t("learnMore.openDemo")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setLocation("/download")} className="w-full sm:w-auto">
                {t("learnMore.download")}
              </Button>
            </div>
          </div>

          <section className="grid lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-6">
              <Card className="p-6 border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <LineChart className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {t("learnMore.trading.title")}
                    </h2>
                    <p className="mt-2 text-muted-foreground">{t("learnMore.trading.description")}</p>
                    <p className="mt-3 text-muted-foreground">{t("learnMore.trading.description2")}</p>
                    <p className="mt-3 text-muted-foreground">{t("learnMore.trading.indicatorsCount")}</p>
                  </div>
                </div>

                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Settings2 className="h-4 w-4 text-primary" />
                      {t("learnMore.trading.feature1.title")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("learnMore.trading.feature1.text")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <ChartLine className="h-4 w-4 text-primary" />
                      {t("learnMore.trading.feature2.title")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("learnMore.trading.feature2.text")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      {t("learnMore.trading.feature3.title")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("learnMore.trading.feature3.text")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Bell className="h-4 w-4 text-primary" />
                      {t("learnMore.trading.feature4.title")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("learnMore.trading.feature4.text")}
                    </p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Bot className="h-4 w-4 text-primary" />
                      {t("learnMore.trading.feature5.title")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("learnMore.trading.feature5.text")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Settings2 className="h-4 w-4 text-primary" />
                    {t("learnMore.advanced.title")}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("learnMore.advanced.description")}</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{t("learnMore.advanced.bullet1")}</li>
                    <li>{t("learnMore.advanced.bullet2")}</li>
                    <li>{t("learnMore.advanced.bullet3")}</li>
                    <li>{t("learnMore.advanced.bullet4")}</li>
                    <li>{t("learnMore.advanced.bullet5")}</li>
                    <li>{t("learnMore.advanced.bullet6")}</li>
                  </ul>
                </div>

                <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <ChartLine className="h-4 w-4 text-primary" />
                    {t("learnMore.analysis.title")}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("learnMore.analysis.description")}</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{t("learnMore.analysis.bullet1")}</li>
                    <li>{t("learnMore.analysis.bullet2")}</li>
                    <li>{t("learnMore.analysis.bullet3")}</li>
                    <li>{t("learnMore.analysis.bullet4")}</li>
                  </ul>
                </div>
              </Card>

              <Card className="p-6 border-secondary/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {t("learnMore.arbitrage.title")}
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      {t("learnMore.arbitrage.description")}
                    </p>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p>{t("learnMore.arbitrage.bullet1")}</p>
                      <p>{t("learnMore.arbitrage.bullet2")}</p>
                      <p>{t("learnMore.arbitrage.bullet3")}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  {screenshots.map((shot) => (
                    <div key={shot.src} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                      <div className="text-sm font-medium text-foreground">{t(shot.titleKey)}</div>
                      <div
                        className={`mt-3 ${shot.aspectClass} overflow-hidden rounded-lg border border-border/40 bg-muted/30`}
                      >
                        <img
                          src={shot.src}
                          alt={t(shot.titleKey)}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
