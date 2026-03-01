import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import PaymentModal from '@/components/PaymentModal';

type Plan = 'free' | 'pro' | 'pro_plus';

function normalizePlan(value: unknown): Plan {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!s || s === 'free' || s === 'basic' || s === 'trial') return 'free';
  if (s === 'pro+' || s === 'proplus' || s === 'pro_plus') return 'pro_plus';
  if (s.startsWith('pro')) return 'pro';
  return 'free';
}

export default function Prices() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'pro_plus' | null>(null);
  const [activeProduct, setActiveProduct] = useState<'crypto_analyzer' | 'crypto_monitor'>('crypto_analyzer');

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const response = await apiRequest('POST', '/api/payment/create', { plan });
      return await response.json();
    },
    onSuccess: (data: any) => {
      // Показываем информацию об оплате
      if (data.pay_address && data.pay_amount) {
        const message = `Send ${data.pay_amount} ${data.pay_currency?.toUpperCase() || 'ETH'} to:\n${data.pay_address}`;
        toast({
          title: t('prices.paymentCreated') || 'Payment created',
          description: message,
          duration: 10000,
        });
        // Копируем адрес в буфер обмена
        navigator.clipboard.writeText(data.pay_address).then(() => {
          toast({
            title: t('prices.addressCopied') || 'Address copied',
            description: t('prices.addressCopiedDesc') || 'Payment address copied to clipboard',
          });
        }).catch(() => {
          // Игнорируем ошибку копирования
        });
      } else {
        toast({
          title: t('prices.error') || 'Error',
          description: 'Payment information not received',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || t('prices.errorDesc') || 'Failed to create payment';
      toast({
        title: t('prices.error') || 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      return await apiRequest('PATCH', '/api/user/plan', { plan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: t('prices.success') || 'Plan updated successfully',
        description: t('prices.successDesc') || 'Your plan has been updated',
      });
    },
    onError: () => {
      toast({
        title: t('prices.error') || 'Error',
        description: t('prices.errorDesc') || 'Failed to update plan',
        variant: 'destructive',
      });
    },
  });

  const plansCryptoAnalyzer = [
    {
      id: 'free' as Plan,
      name: t('prices.free'),
      price: '$0',
      features: [
        t('prices.free.feature1'),
        t('prices.free.feature2'),
        t('prices.free.feature3'),
        t('prices.free.feature4'),
        t('prices.free.feature5'),
        t('prices.free.feature6'),
      ],
    },
    {
      id: 'pro' as Plan,
      name: t('prices.pro'),
      price: '$10',
      oldPrice: '$15',
      discount: true,
      features: [
        t('prices.pro.feature1'),
        t('prices.pro.feature2'),
        t('prices.pro.feature11'),
        t('prices.pro.feature3'),
        t('prices.pro.feature4'),
        t('prices.pro.feature12'),
        t('prices.pro.feature5'),
        t('prices.pro.feature6'),
        t('prices.pro.feature7'),
        t('prices.pro.feature8'),
        t('prices.pro.feature9'),
        t('prices.pro.feature10'),
      ],
      popular: true,
    },
    {
      id: 'pro_plus' as Plan,
      name: t('prices.proPlus'),
      price: '$20',
      features: [
        t('prices.proPlus.feature1'),
        t('prices.proPlus.feature3'),
        t('prices.proPlus.feature4'),
        t('prices.proPlus.feature5'),
        t('prices.proPlus.feature6'),
      ],
    },
  ];

  const plansCryptoMonitor = [
    {
      id: 'free' as Plan,
      name: t('prices.free'),
      price: '$0',
      features: [
        t('prices.cryptoMonitor.free.feature1'),
        t('prices.cryptoMonitor.free.feature2'),
        t('prices.cryptoMonitor.free.feature3'),
        t('prices.cryptoMonitor.free.feature4'),
        t('prices.cryptoMonitor.free.feature5'),
      ],
    },
    {
      id: 'pro' as Plan,
      name: t('prices.pro'),
      price: '$10',
      oldPrice: '$15',
      discount: true,
      features: [
        t('prices.cryptoMonitor.pro.feature1'),
        t('prices.cryptoMonitor.pro.feature2'),
        t('prices.cryptoMonitor.pro.feature3'),
        t('prices.cryptoMonitor.pro.feature4'),
        t('prices.cryptoMonitor.pro.feature5'),
        t('prices.cryptoMonitor.pro.feature6'),
        t('prices.cryptoMonitor.pro.feature7'),
      ],
      popular: true,
    },
    {
      id: 'pro_plus' as Plan,
      name: t('prices.proPlus'),
      price: '$20',
      features: [
        t('prices.proPlus.feature1'),
        t('prices.proPlus.feature3'),
        t('prices.proPlus.feature4'),
        t('prices.proPlus.feature5'),
        t('prices.proPlus.feature6'),
      ],
    },
  ];

  const plans = activeProduct === 'crypto_monitor' ? plansCryptoMonitor : plansCryptoAnalyzer;

  const handleSelectPlan = (plan: Plan) => {
    if (!user) {
      toast({
        title: t('prices.loginRequired') || 'Login required',
        description: t('prices.loginRequiredDesc') || 'Please login to select a plan',
        variant: 'destructive',
      });
      return;
    }

    // Если выбран бесплатный план, обновляем напрямую
    if (plan === 'free') {
      selectPlanMutation.mutate(plan);
      return;
    }

    // Для платных планов открываем модальное окно выбора способа оплаты
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
  };

  const planRaw =
    (currentUser as any)?.effective_plan ??
    (currentUser as any)?.plan ??
    (user as any)?.effective_plan ??
    (user as any)?.plan ??
    'free';
  const userPlan: Plan = normalizePlan(planRaw);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent break-words px-4">
              {t('prices.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto break-words px-4">
              {t('prices.description')}
            </p>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto break-words px-4">
              {t('prices.bundleNote')}
            </p>
          </div>

          <Tabs value={activeProduct} onValueChange={(v) => setActiveProduct(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="crypto_analyzer">{t('prices.product.cryptoAnalyzer')}</TabsTrigger>
              <TabsTrigger value="crypto_monitor">{t('prices.product.cryptoMonitor')}</TabsTrigger>
            </TabsList>

            <TabsContent value="crypto_analyzer" className="mt-10">
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`p-8 relative ${
                      plan.popular
                        ? 'border-primary shadow-lg shadow-primary/20'
                        : 'border-card-border'
                    }`}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    {plan.popular && (
                      <Badge
                        className="absolute -top-3 left-1/2 -translate-x-1/2"
                        data-testid="badge-popular"
                      >
                        Popular
                      </Badge>
                    )}

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-2xl font-bold break-words">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 flex-wrap">
                          {plan.oldPrice && (
                            <>
                              <span className="text-lg sm:text-xl line-through text-muted-foreground">
                                {plan.oldPrice}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {t('prices.discount')}
                              </Badge>
                            </>
                          )}
                          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                            {plan.price}
                          </span>
                          {plan.id !== 'free' && (
                            <span className="text-sm sm:text-base text-muted-foreground">/mo</span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-3 list-disc list-outside">
                        {plan.features.map((feature, index) => (
                          <li
                            key={index}
                            className="text-sm text-muted-foreground break-words"
                            data-testid={`feature-${plan.id}-${index + 1}`}
                          >
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={
                          (plan.id !== 'free' && createPaymentMutation.isPending) ||
                          (plan.id === 'free' && selectPlanMutation.isPending) ||
                          userPlan === plan.id
                        }
                        data-testid={`button-select-${plan.id}`}
                      >
                        {userPlan === plan.id
                          ? t('prices.currentPlan')
                          : plan.id === 'free'
                          ? t('prices.select')
                          : t('prices.buyNow') || 'Buy Now'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="crypto_monitor" className="mt-10">
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`p-8 relative ${
                      plan.popular
                        ? 'border-primary shadow-lg shadow-primary/20'
                        : 'border-card-border'
                    }`}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    {plan.popular && (
                      <Badge
                        className="absolute -top-3 left-1/2 -translate-x-1/2"
                        data-testid="badge-popular"
                      >
                        Popular
                      </Badge>
                    )}

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-2xl font-bold break-words">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 flex-wrap">
                          {plan.oldPrice && (
                            <>
                              <span className="text-lg sm:text-xl line-through text-muted-foreground">
                                {plan.oldPrice}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {t('prices.discount')}
                              </Badge>
                            </>
                          )}
                          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                            {plan.price}
                          </span>
                          {plan.id !== 'free' && (
                            <span className="text-sm sm:text-base text-muted-foreground">/mo</span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-3 list-disc list-outside">
                        {plan.features.map((feature, index) => (
                          <li
                            key={index}
                            className="text-sm text-muted-foreground break-words"
                            data-testid={`feature-${plan.id}-${index + 1}`}
                          >
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={
                          (plan.id !== 'free' && createPaymentMutation.isPending) ||
                          (plan.id === 'free' && selectPlanMutation.isPending) ||
                          userPlan === plan.id
                        }
                        data-testid={`button-select-${plan.id}`}
                      >
                        {userPlan === plan.id
                          ? t('prices.currentPlan')
                          : plan.id === 'free'
                          ? t('prices.select')
                          : t('prices.buyNow') || 'Buy Now'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
      {selectedPlan && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={(open) => {
            setPaymentModalOpen(open);
            if (!open) {
              setSelectedPlan(null);
            }
          }}
          plan={selectedPlan}
          amount={selectedPlan === 'pro' ? 10 : 20}
        />
      )}
    </div>
  );
}
