import { useEffect } from "react";
import { HelpCircle, LineChart, Repeat, Wallet } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLanguage } from "@/lib/i18n";

export default function FAQ() {
  const { t } = useLanguage();

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
              {t("faq.title")}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-3xl">
              {t("faq.subtitle")}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-stretch">
            <Card className="p-6 border-primary/20 h-full flex flex-col">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <LineChart className="w-7 h-7 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold text-foreground break-words">
                    {t("header.tradingAnalyzer")}
                  </h2>
                </div>
              </div>

              <div className="mt-6 flex-1">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="web-autosignals-what">
                    <AccordionTrigger>{t("faq.webApp.q.autosignalsWhat")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.webApp.a.autosignalsWhat")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="web-autosignals-timeframes">
                    <AccordionTrigger>{t("faq.webApp.q.bestTimeframes")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <div className="space-y-2">
                        <div>{t("faq.webApp.a.bestTimeframesIntro")}</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>{t("faq.webApp.a.bestTimeframesScalping")}</li>
                          <li>{t("faq.webApp.a.bestTimeframesDaytrading")}</li>
                          <li>{t("faq.webApp.a.bestTimeframesSwing")}</li>
                          <li>{t("faq.webApp.a.bestTimeframesMedium")}</li>
                          <li>{t("faq.webApp.a.bestTimeframesLong")}</li>
                        </ul>
                        <div>{t("faq.webApp.a.bestTimeframesNote")}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="web-payment">
                    <AccordionTrigger>{t("faq.webApp.q.howToPay")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <div className="space-y-2">
                        <div>{t("faq.webApp.a.howToPayIntro")}</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>{t("faq.webApp.a.howToPayCoinBtc")}</li>
                          <li>{t("faq.webApp.a.howToPayCoinEth")}</li>
                          <li>{t("faq.webApp.a.howToPayCoinTrx")}</li>
                          <li>{t("faq.webApp.a.howToPayCoinUsdc")}</li>
                        </ul>
                        <div className="flex items-center gap-2 pt-2 text-sm">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span>{t("faq.webApp.a.howToPayNote")}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="web-support">
                    <AccordionTrigger>{t("faq.webApp.q.support")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.webApp.a.support")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="desktop-start">
                    <AccordionTrigger>{t("faq.desktopApp.q.howToStart")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.desktopApp.a.howToStart")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="desktop-confirmations">
                    <AccordionTrigger>{t("faq.desktopApp.q.confirmations")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.desktopApp.a.confirmations")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="desktop-settings">
                    <AccordionTrigger>{t("faq.desktopApp.q.settings")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.desktopApp.a.settings")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="desktop-logs">
                    <AccordionTrigger>{t("faq.desktopApp.q.logs")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.desktopApp.a.logs")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="desktop-demo">
                    <AccordionTrigger>{t("faq.desktopApp.q.demo")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.desktopApp.a.demo")}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Card>

            <Card className="p-6 border-secondary/20 h-full flex flex-col">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                  <Repeat className="w-7 h-7 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold text-foreground break-words">
                    {t("header.arbitrageTool")}
                  </h2>
                </div>
              </div>

              <div className="mt-6 flex-1" />
            </Card>
          </div>

          <div className="mt-8">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-muted/30 text-foreground">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold text-foreground break-words">
                    {t("faq.general.title")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground break-words">
                    {t("faq.general.subtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="general-security">
                    <AccordionTrigger>{t("faq.general.q.security")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.general.a.security")}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="general-delete">
                    <AccordionTrigger>{t("faq.general.q.deleteAccount")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("faq.general.a.deleteAccount")}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
