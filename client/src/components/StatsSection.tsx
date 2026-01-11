import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useLanguage } from '@/lib/i18n';
import ethCoin from "@assets/generated_images/Ethereum_coin_decorative_element_1ec73c3d.png";
import usdtCoin from "@assets/generated_images/USDT_coin_decorative_element_37b35ab7.png";

function CountUp({ end, duration = 2000 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - percentage, 4);
      setCount(Math.floor(end * easeOutQuart));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function StatsSection() {
  const { t } = useLanguage();

  const stats = [
    { labelKey: "stats.dailyTrades", value: 25000, suffix: "+", prefix: "" },
    { labelKey: "stats.tradingVolume", value: 57, suffix: "%", prefix: "" },
    { labelKey: "stats.activeUsers", value: 10000, suffix: "+", prefix: "" }
  ];

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden" data-testid="section-stats">
      <div className="absolute top-20 right-10 w-20 h-20 opacity-20 animate-spin" style={{ animationDuration: '20s' }}>
        <img src={ethCoin} alt="" className="w-full h-full" />
      </div>
      <div className="absolute bottom-20 left-10 w-16 h-16 opacity-20 animate-spin" style={{ animationDuration: '25s' }}>
        <img src={usdtCoin} alt="" className="w-full h-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            {t('stats.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('stats.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <Card 
              key={index} 
              className="p-8 text-center hover-elevate transition-all duration-300 border-card-border"
              data-testid={`card-stat-${index}`}
            >
              <div className="space-y-2">
                <div className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent font-mono">
                  {stat.prefix}
                  <CountUp end={stat.value} />
                  {stat.suffix}
                </div>
                <div className="text-lg text-muted-foreground font-medium">
                  {t(stat.labelKey)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
