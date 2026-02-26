import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CryptoMonitorSettingsResponse = {
  interval_sec: number;
  quote: string;
  tokens_to_scan: number;
  top_n: number;
  alert_percent_min: number;
  alert_percent_max?: number;
  selected_exchanges: string[];
  quote_options?: string[];
};

const availableExchanges = [
  "Binance",
  "OKX",
  "Exmo",
  "KuCoin",
  "HitBTC",
  "BitMEX",
  "CEX.IO",
  "Bitfinex",
  "Huobi",
  "Gate",
  "Bybit",
  "Poloniex",
  "Bitstamp",
  "Kraken",
  "Coinbase",
];

function toNumberOrNull(v: string | null | undefined): number | null {
  const s = (v ?? "").trim().replace(/,/g, ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function normalizeNumericInput(v: string): string {
  return v.replace(/,/g, ".");
}

function normalizeFormForPlan(payload: CryptoMonitorSettingsResponse, isFree: boolean): CryptoMonitorSettingsResponse {
  const intervalMin = isFree ? 300 : 1;
  const intervalMax = 86400;
  const tokensMax = isFree ? 50 : 100000;
  const topNMax = isFree ? 5 : 100;

  return {
    ...payload,
    interval_sec: clampInt(Number(payload.interval_sec ?? 300), intervalMin, intervalMax),
    tokens_to_scan: clampInt(Number(payload.tokens_to_scan ?? 1000), 1, tokensMax),
    top_n: clampInt(Number(payload.top_n ?? 30), 1, topNMax),
  };
}

export default function CryptoMonitorAppSettingsPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const planRaw = (user?.effective_plan ?? user?.plan ?? "").toString();
  const planNorm = (planRaw || "").trim().toLowerCase();
  const isFree = planNorm.includes("free");

  const { data, isLoading } = useQuery<CryptoMonitorSettingsResponse>({
    queryKey: ["/api/crypto_monitor/settings"],
  });

  const quoteOptions = useMemo(() => {
    const opts = data?.quote_options;
    if (Array.isArray(opts) && opts.length > 0) return opts;
    return ["USDT", "USDC", "BTC", "ETH", "USD"];
  }, [data?.quote_options]);

  const [form, setForm] = useState<CryptoMonitorSettingsResponse>({
    interval_sec: 300,
    quote: "USDT",
    tokens_to_scan: 1000,
    top_n: 30,
    alert_percent_min: 1,
    alert_percent_max: 100,
    selected_exchanges: ["Binance", "OKX"],
    quote_options: quoteOptions,
  });

  const [raw, setRaw] = useState({
    interval_sec: "300",
    tokens_to_scan: "1000",
    top_n: "30",
    alert_percent_min: "1",
    alert_percent_max: "100",
  });

  useEffect(() => {
    if (!data) return;
    const next: CryptoMonitorSettingsResponse = {
      interval_sec: data.interval_sec ?? 300,
      quote: data.quote ?? "USDT",
      tokens_to_scan: data.tokens_to_scan ?? 1000,
      top_n: data.top_n ?? 30,
      alert_percent_min:
        typeof data.alert_percent_min === "number" ? data.alert_percent_min : Number(data.alert_percent_min ?? 1),
      alert_percent_max:
        typeof data.alert_percent_max === "number" ? data.alert_percent_max : Number(data.alert_percent_max ?? 100),
      selected_exchanges: Array.isArray(data.selected_exchanges) ? data.selected_exchanges : [],
      quote_options: quoteOptions,
    };
    const normalized = normalizeFormForPlan(next, isFree);
    const maxThr = Number.isFinite(Number(normalized.alert_percent_max))
      ? Number(normalized.alert_percent_max)
      : 100;
    const minThr = Number.isFinite(Number(normalized.alert_percent_min))
      ? Number(normalized.alert_percent_min)
      : 0;
    const fixedMax = Math.max(minThr, Math.min(100, maxThr));
    normalized.alert_percent_max = fixedMax;
    setForm(normalized);
    setRaw({
      interval_sec: String(normalized.interval_sec ?? ""),
      tokens_to_scan: String(normalized.tokens_to_scan ?? ""),
      top_n: String(normalized.top_n ?? ""),
      alert_percent_min: String(normalized.alert_percent_min ?? ""),
      alert_percent_max: String(normalized.alert_percent_max ?? ""),
    });
  }, [data, quoteOptions, isFree]);

  const saveMutation = useMutation({
    mutationFn: async (payload: CryptoMonitorSettingsResponse) => {
      const res = await apiRequest("POST", "/api/crypto_monitor/settings", {
        interval_sec: payload.interval_sec,
        quote: payload.quote,
        tokens_to_scan: payload.tokens_to_scan,
        top_n: payload.top_n,
        alert_percent_min: payload.alert_percent_min,
        alert_percent_max: payload.alert_percent_max,
        selected_exchanges: payload.selected_exchanges,
      });
      return (await res.json()) as CryptoMonitorSettingsResponse;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/crypto_monitor/settings"] });
      toast({ title: t("cryptoMonitor.appSettings.save") });
    },
    onError: (e: any) => {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    },
  });

  const canSave = form.selected_exchanges.length >= 2;

  const getNormalizedForm = useMemo(() => {
    const intervalMin = isFree ? 300 : 1;
    const intervalMax = 86400;
    const tokensMax = isFree ? 50 : 100000;
    const topNMax = isFree ? 5 : 100;

    const intervalV = toNumberOrNull(raw.interval_sec);
    const tokensV = toNumberOrNull(raw.tokens_to_scan);
    const topNV = toNumberOrNull(raw.top_n);
    const thresholdV = toNumberOrNull(raw.alert_percent_min);
    const thresholdMaxV = toNumberOrNull(raw.alert_percent_max);

    const minThr = thresholdV == null ? Number(form.alert_percent_min ?? 0) : thresholdV;
    const maxThrRaw = thresholdMaxV == null ? Number(form.alert_percent_max ?? 100) : thresholdMaxV;
    const maxThr = Math.max(minThr, Math.min(100, maxThrRaw));

    return normalizeFormForPlan(
      {
        ...form,
        interval_sec: intervalV == null ? form.interval_sec : clampInt(intervalV, intervalMin, intervalMax),
        tokens_to_scan: tokensV == null ? form.tokens_to_scan : clampInt(tokensV, 1, tokensMax),
        top_n: topNV == null ? form.top_n : clampInt(topNV, 1, topNMax),
        alert_percent_min: thresholdV == null ? form.alert_percent_min : Math.max(0, Math.min(100, thresholdV)),
        alert_percent_max: maxThr,
      },
      isFree
    );
  }, [form, raw, isFree]);

  return (
    <Card className="p-4 sm:p-6 border-card-border" style={{ scrollbarGutter: "stable" }}>
      <div className="space-y-4">
        <div className="font-semibold">{t("cryptoMonitor.appSettings.title")}</div>

        {isFree && (
          <div className="text-sm text-muted-foreground">
            {t("cryptoMonitor.appSettings.freeLimitsText")} {" "}
            <a className="underline" href="/faq">
              {t("cryptoMonitor.appSettings.faqLink")}
            </a>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.interval")}</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={raw.interval_sec}
              min={isFree ? 300 : 1}
              max={86400}
              onChange={(e) => {
                setRaw((p) => ({ ...p, interval_sec: normalizeNumericInput(e.target.value) }));
              }}
              onBlur={() => {
                const v = toNumberOrNull(raw.interval_sec);
                const minV = isFree ? 300 : 1;
                const fixed = v == null ? form.interval_sec : clampInt(v, minV, 86400);
                setForm((p) => ({ ...p, interval_sec: fixed }));
                setRaw((p) => ({ ...p, interval_sec: String(fixed) }));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.quote")}</Label>
            <Select
              value={form.quote}
              onValueChange={(v) => setForm((p) => ({ ...p, quote: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quoteOptions.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.tokens")}</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={raw.tokens_to_scan}
              min={1}
              max={isFree ? 50 : 100000}
              onChange={(e) => {
                setRaw((p) => ({ ...p, tokens_to_scan: normalizeNumericInput(e.target.value) }));
              }}
              onBlur={() => {
                const v = toNumberOrNull(raw.tokens_to_scan);
                const maxV = isFree ? 50 : 100000;
                const fixed = v == null ? form.tokens_to_scan : clampInt(v, 1, maxV);
                setForm((p) => ({ ...p, tokens_to_scan: fixed }));
                setRaw((p) => ({ ...p, tokens_to_scan: String(fixed) }));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.results")}</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={raw.top_n}
              min={1}
              max={isFree ? 5 : 100}
              onChange={(e) => {
                setRaw((p) => ({ ...p, top_n: normalizeNumericInput(e.target.value) }));
              }}
              onBlur={() => {
                const v = toNumberOrNull(raw.top_n);
                const maxV = isFree ? 5 : 100;
                const fixed = v == null ? form.top_n : clampInt(v, 1, maxV);
                setForm((p) => ({ ...p, top_n: fixed }));
                setRaw((p) => ({ ...p, top_n: String(fixed) }));
              }}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.minThreshold")}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={raw.alert_percent_min}
              min={0}
              max={100}
              step={0.01}
              onChange={(e) => {
                setRaw((p) => ({ ...p, alert_percent_min: normalizeNumericInput(e.target.value) }));
              }}
              onBlur={() => {
                const v = toNumberOrNull(raw.alert_percent_min);
                const fixed = v == null ? form.alert_percent_min : Math.max(0, Math.min(100, v));
                setForm((p) => ({ ...p, alert_percent_min: fixed }));
                setRaw((p) => ({ ...p, alert_percent_min: String(fixed) }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("cryptoMonitor.appSettings.maxThreshold")}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={raw.alert_percent_max}
              min={0}
              max={100}
              step={0.01}
              onChange={(e) => {
                setRaw((p) => ({ ...p, alert_percent_max: normalizeNumericInput(e.target.value) }));
              }}
              onBlur={() => {
                const v = toNumberOrNull(raw.alert_percent_max);
                const minThr = Number(form.alert_percent_min ?? 0);
                const fixedRaw = v == null ? Number(form.alert_percent_max ?? 100) : Math.max(0, Math.min(100, v));
                const fixed = Math.max(minThr, fixedRaw);
                setForm((p) => ({ ...p, alert_percent_max: fixed }));
                setRaw((p) => ({ ...p, alert_percent_max: String(fixed) }));
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("cryptoMonitor.appSettings.exchanges")}</Label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.selected_exchanges.length === availableExchanges.length}
                onChange={(e) => {
                  const v = e.target.checked;
                  setForm((p) => ({ ...p, selected_exchanges: v ? availableExchanges.slice() : [] }));
                }}
              />
              <span>{t("spreadAlerts.selectAll")}</span>
            </label>

            {availableExchanges.map((ex) => {
              const checked = form.selected_exchanges.includes(ex);
              return (
                <label key={ex} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((prev) => {
                        const cur = prev.selected_exchanges.slice();
                        if (v) {
                          if (!cur.includes(ex)) cur.push(ex);
                        } else {
                          const idx = cur.indexOf(ex);
                          if (idx >= 0) cur.splice(idx, 1);
                        }
                        return { ...prev, selected_exchanges: cur };
                      });
                    }}
                  />
                  <span>{ex}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            className="w-full"
            disabled={isLoading || saveMutation.isPending}
            onClick={() => {
              if (!canSave) {
                toast({
                  title: "Выберите минимум 2 биржи",
                  variant: "destructive",
                });
                return;
              }
              saveMutation.mutate(getNormalizedForm);
            }}
          >
            {t("cryptoMonitor.appSettings.save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
