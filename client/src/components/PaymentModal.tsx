import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Copy, Check } from 'lucide-react';

type PaymentMethod = 'crypto' | 'card';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: 'pro' | 'pro_plus';
  amount: number;
}

export default function PaymentModal({ open, onOpenChange, plan, amount }: PaymentModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('crypto');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Фиксированный список ваших крипто‑адресов
  const staticPayments = [
    {
      id: 'BTC',
      label: 'BTC',
      address: '15UcyxpdraQzBo2BS7845HFmjpibb8w3ye',
    },
    {
      id: 'ETH',
      label: 'ETH Ethereum (ERC20)',
      address: '0x5a7a8169b0ea268d0cf1c38e49b193fba5280167',
    },
    {
      id: 'TRX',
      label: 'TRX Tron (TRC20)',
      address: 'TM1Et4ruvrTozwA1BAjbDpV9YoL43e75vy',
    },
    {
      id: 'USDC',
      label: 'USDC Ethereum (ERC20)',
      address: '0x5a7a8169b0ea268d0cf1c38e49b193fba5280167',
    },
  ];

  // Создание платежа картой
  const createCardPaymentMutation = useMutation({
    mutationFn: async (plan: 'pro' | 'pro_plus') => {
      const response = await apiRequest('POST', '/api/payment/create', {
        plan,
        payment_method: 'card',
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        toast({
          title: t('prices.error') || 'Error',
          description: 'Payment URL not received',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: t('prices.error') || 'Error',
        description: error?.response?.data?.error || 'Failed to create payment',
        variant: 'destructive',
      });
    },
  });

  const handleCreatePayment = () => {
    if (paymentMethod === 'card') {
      createCardPaymentMutation.mutate(plan);
    }
    // Для crypto ничего не создаем — показываем фиксированные адреса
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      toast({
        title: t('prices.addressCopied') || 'Address copied',
        description: t('prices.addressCopiedDesc') || 'Payment address copied to clipboard',
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('prices.paymentMethod') || 'Select Payment Method'}</DialogTitle>
          <DialogDescription>
            {`Pay $${amount} for ${plan.toUpperCase()} plan`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="crypto">{t('prices.crypto') || 'Cryptocurrency'}</TabsTrigger>
            <TabsTrigger value="card">{t('prices.card') || 'Card'}</TabsTrigger>
          </TabsList>

          <TabsContent value="crypto" className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('prices.sendAmount') || 'Send the specified amount to one of these addresses:'}
              </p>
              {staticPayments.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      {/* Жирным только название монеты */}
                      <span className="font-semibold">{item.label}</span>
                      {/* Адрес обычным текстом */}
                      <span className="text-xs break-all">{item.address}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyAddress(item.address)}
                    >
                      {copiedAddress === item.address ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="card" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('prices.cardDesc') || 'Pay with credit or debit card. The payment will be converted to cryptocurrency automatically.'}
              </p>
              <Button
                onClick={handleCreatePayment}
                disabled={createCardPaymentMutation.isPending}
                className="w-full"
              >
                {createCardPaymentMutation.isPending
                  ? t('prices.processing') || 'Processing...'
                  : t('prices.payWithCard') || 'Pay with Card'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

