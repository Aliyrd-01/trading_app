import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { Info, LineChart, Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AutoSignalsSettings = {
  enabled: boolean;
  symbol: string | null;
  capital: number | null;
  trading_type: string | null;
  strategy: string | null;
  risk: number | null;
  confirmation: string | null;
  min_reliability: number | null;
  check_interval: number | null;
  enable_email_notifications: boolean;
  enable_telegram_notifications: boolean;
  telegram_chat_id: string | null;
};

type AutoSignalsAccess = {
  allowed: boolean;
  reason: string | null;
  trial_expires_at: string | null;
};

type AutoSignalsSettingsResponse = AutoSignalsSettings & {
  locked?: boolean;
  access?: AutoSignalsAccess;
};

type AutoSignalsTestResponse = {
  message: string;
  output: string;
};

type AutoSignalsLogItem = {
  id: number;
  symbol: string | null;
  timeframe: string | null;
  direction: string | null;
  reliability: number | null;
  price: string | null;
  status: any;
  fired_at: string | null;
  message: string | null;
  error: string | null;
  meta: string | null;
  created_at: string;
};

type AutoSignalsLogsResponse = {
  items: AutoSignalsLogItem[];
};

function toTrimmedLower(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

type AutoSignalsStatusResponse = {
  enabled: boolean;
  check_interval_minutes: number;
  last_check: string | null;
  next_check: string | null;
  minutes_until_next: number;
  last_fired_at: string | null;
  locked?: boolean;
  access?: AutoSignalsAccess;
};

function formatIsoLocal(iso: string | null | undefined, language: string): string {
  const raw = (iso ?? "").trim();
  if (!raw) return "-";

  const locale = language === "ru" ? "ru-RU" : language === "uk" ? "uk-UA" : "en-GB";
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) {
    return raw.replace("T", " ").replace("Z", "");
  }

  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(dt);

  return `${date} ${time}`;
}

function normalizeTradingType(v: string | null | undefined): string | null {
  const raw = (v ?? "").trim();
  if (!raw) return null;
  if (raw === "Дейли трейдинг") return "Дейтрейдинг";
  return raw;
}

function normalizeSymbolWithSlashSafe(symbol: any): string {
  const s = (symbol ?? "").toString();
  return normalizeSymbolWithSlash(s);
}

function toNumberOrNull(v: string | null | undefined): number | null {
  const s = (v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toClampedNumberOrNull(v: string, min: number, max: number): number | null {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

const MAX_CAPITAL = 999999999999;

function normalizeSymbolWithSlash(symbol: string | null | undefined): string {
  const raw = (symbol ?? "").trim().toUpperCase();
  if (!raw) return "";

  if (raw.includes("/")) {
    return raw;
  }

  const commonQuotes = ["USDT", "USD", "BUSD", "BTC", "ETH", "BNB"];
  for (const q of commonQuotes) {
    if (raw.endsWith(q) && raw.length > q.length) {
      return `${raw.slice(0, raw.length - q.length)}/${q}`;
    }
  }

  return raw;
}

type ConfirmationUi = {
  mode: "ALL" | "NONE" | "CUSTOM";
  selected: string[];
};

function parseConfirmationUi(confirmation: string | null | undefined): ConfirmationUi {
  const conf = (confirmation ?? "").trim().toUpperCase();
  if (conf === "" || conf === "N/A") {
    return { mode: "NONE", selected: [] };
  }
  if (conf === "ALL") {
    return { mode: "ALL", selected: [] };
  }
  if (conf === "NONE") {
    return { mode: "NONE", selected: [] };
  }

  const parts = conf
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { mode: "NONE", selected: [] };
  }

  return { mode: "CUSTOM", selected: parts };
}

function buildConfirmationString(ui: ConfirmationUi): string {
  if (ui.mode === "ALL") return "ALL";
  if (ui.mode === "NONE") return "NONE";
  return ui.selected.join("+");
}

function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    const update = () => setIsTouch(Boolean(mq?.matches));
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  return isTouch;
}

function InfoHelp({ label, text }: { label: string; text: string }) {
  const isTouch = useIsTouchDevice();
  const _id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isTouch && open) setOpen(false);
  }, [isTouch, open]);

  return (
    <>
      {isTouch && open ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
          data-testid="autosignals-tooltip-overlay"
        />
      ) : null}
      <Tooltip open={isTouch ? open : undefined} onOpenChange={isTouch ? setOpen : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground hover:text-foreground"
            aria-label={label}
            aria-describedby={_id}
            onClick={
              isTouch
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                  }
                : undefined
            }
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[calc(100vw-24px)] sm:max-w-[340px] whitespace-pre-line break-words"
          id={_id}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

const defaultPairs = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "SOL/USDT",
  "TRX/USDT",
  "DOGE/USDT",
  "ADA/USDT",
  "LINK/USDT",
  "ZEC/USDT",
];

const tradingTypes: Array<{ value: string; labelKey: string }> = [
  { value: "Скальпинг", labelKey: "autoSignals.tradingType.scalping" },
  { value: "Дейтрейдинг", labelKey: "autoSignals.tradingType.dayTrading" },
  { value: "Свинг", labelKey: "autoSignals.tradingType.swing" },
  { value: "Среднесрочная", labelKey: "autoSignals.tradingType.medium" },
  { value: "Долгосрочная", labelKey: "autoSignals.tradingType.long" },
];

const strategies: Array<{ value: string; labelKey: string }> = [
  { value: "Консервативная", labelKey: "autoSignals.strategy.conservative" },
  { value: "Сбалансированная", labelKey: "autoSignals.strategy.balanced" },
  { value: "Агрессивная", labelKey: "autoSignals.strategy.aggressive" },
];

const confirmationIndicators = [
  "EMA",
  "RSI",
  "MACD",
  "ADX",
  "VWMA",
  "VWAP",
  "AVWAP",
  "SUPERTREND",
  "STOCHRSI",
  "OBV",
  "MSTRUCT",
  "BB",
];

function ChoiceCard({
  title,
  subtitle,
  selected,
  compact,
  disabled,
  onClick,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative text-left rounded-xl border border-card-border bg-card transition-all duration-300 hover-elevate toggle-elevate",
        compact ? "px-3 py-2" : "px-4 py-3",
        selected && "toggle-elevated border-primary/50",
        disabled && "opacity-60 pointer-events-none",
      )}
    >
      <div className="space-y-1">
        <div
          className={cn(
            "font-semibold tracking-tight whitespace-normal break-words leading-tight",
            compact ? "text-[13px] leading-snug" : "",
          )}
        >
          {title}
        </div>
        {subtitle ? (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}

export default function AutoSignalsPanel() {
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const isTouch = useIsTouchDevice();
  const [lockOpen, setLockOpen] = useState(false);

  const [logsLimit, setLogsLimit] = useState<number>(10);

  const { data: settings, isLoading: settingsLoading } = useQuery<AutoSignalsSettingsResponse>({
    queryKey: ["/api/auto_signals/settings"],
  });

  const { data: status } = useQuery<AutoSignalsStatusResponse>({
    queryKey: ["/api/auto_signals/status"],
    refetchInterval: 30_000,
  });

  const logsUrl = useMemo(() => `/api/auto_signals/logs?limit=${logsLimit}`, [logsLimit]);

  const { data: logs, isLoading: logsLoading } = useQuery<AutoSignalsLogsResponse>({
    queryKey: [logsUrl],
  });

  const logsCount = logs?.items?.length ?? 0;
  const canShowMoreLogs = logsLimit < 100 && logsCount >= logsLimit;

  const [form, setForm] = useState<AutoSignalsSettings>({
    enabled: true,
    symbol: "ETH/USDT",
    capital: 10000,
    trading_type: "Дейтрейдинг",
    strategy: "Сбалансированная",
    risk: 1,
    confirmation: "ALL",
    min_reliability: 60,
    check_interval: 5,
    enable_email_notifications: true,
    enable_telegram_notifications: false,
    telegram_chat_id: null,
  });

  const [confirmationUi, setConfirmationUi] = useState<ConfirmationUi>({ mode: "ALL", selected: [] });

  const [testOutput, setTestOutput] = useState<string>("");

  useEffect(() => {
    if (!settings) return;
    setForm({
      ...settings,
      trading_type: normalizeTradingType(settings.trading_type),
    });
    setConfirmationUi(parseConfirmationUi(settings.confirmation));
  }, [settings]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, confirmation: buildConfirmationString(confirmationUi) }));
  }, [confirmationUi]);

  const isDirty = useMemo(() => {
    if (!settings) return true;
    return JSON.stringify(settings) !== JSON.stringify(form);
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.risk != null && form.risk > 100) {
        throw new Error(t("autoSignals.validation.riskMax"));
      }
      if (form.min_reliability != null && form.min_reliability > 100) {
        throw new Error(t("autoSignals.validation.minReliabilityMax"));
      }
      if (form.capital != null && form.capital > MAX_CAPITAL) {
        throw new Error(t("autoSignals.validation.capitalMax"));
      }
      if (form.check_interval != null && form.check_interval < 1) {
        throw new Error(t("autoSignals.validation.checkIntervalMin"));
      }
      if (form.check_interval != null && form.check_interval > 10080) {
        throw new Error(t("autoSignals.validation.checkIntervalMax"));
      }
      const payload: AutoSignalsSettings = {
        ...form,
        symbol: form.symbol ? normalizeSymbolWithSlash(form.symbol) : null,
      };

      const resp = await apiRequest("POST", "/api/auto_signals/settings", {
        ...payload,
        language,
      } as any);
      return (await resp.json()) as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto_signals/settings"] });
      toast({ title: t("autoSignals.toast.saved") });
    },
    onError: (e: any) => {
      toast({
        title: t("autoSignals.toast.saveError"),
        description: (() => {
          const anyErr = e as any;
          const payload = anyErr?.payload;
          const errors = payload && typeof payload === "object" ? (payload as any).errors : null;
          if (errors && typeof errors === "object") {
            const key = Object.keys(errors)[0] || "";
            if (key === "risk") return t("autoSignals.validation.riskMax");
            if (key === "min_reliability") return t("autoSignals.validation.minReliabilityMax");
            if (key === "check_interval") {
              const msgs = (errors as any)[key];
              const msg = Array.isArray(msgs) ? String(msgs[0] || "") : "";
              if (msg.includes("at least")) return t("autoSignals.validation.checkIntervalMin");
              if (msg.includes("greater than") || msg.includes("not be greater")) return t("autoSignals.validation.checkIntervalMax");
              return t("autoSignals.validation.invalid");
            }
            if (key === "capital") {
              const msgs = (errors as any)[key];
              const msg = Array.isArray(msgs) ? String(msgs[0] || "") : "";
              if (msg.includes("greater than") || msg.includes("not be greater")) {
                return t("autoSignals.validation.capitalMax");
              }
              return t("autoSignals.validation.capitalInvalid");
            }
            return t("autoSignals.validation.invalid");
          }
          return e instanceof Error ? e.message : "";
        })(),
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/auto_signals/test", { language } as any);
      return (await resp.json()) as AutoSignalsTestResponse;
    },
    onSuccess: (data) => {
      setTestOutput(data.output || "");
      queryClient.invalidateQueries({ queryKey: [logsUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto_signals/status"] });
      toast({
        title: t("autoSignals.toast.testDone"),
      });
    },
    onError: (e: any) => {
      setTestOutput("");
      toast({
        title: t("autoSignals.toast.testError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const saving = saveMutation.isPending;
  const testing = testMutation.isPending;

  const locked = !!settings?.locked || !!status?.locked;
  const lockedTooltip = t("autoSignals.upgradeToPro");

  const suggestedPairs = useMemo(() => {
    const out: string[] = [];
    const add = (p: string) => {
      const v = normalizeSymbolWithSlashSafe(p);
      if (!v) return;
      if (!out.includes(v)) out.push(v);
    };

    // Keep the desktop order; do not move selected symbol to the front.
    for (const p of defaultPairs) add(p);

    const current = form.symbol ? normalizeSymbolWithSlashSafe(form.symbol) : "";
    if (current) add(current);

    for (const it of logs?.items ?? []) {
      const s = ((it.symbol ?? "").toString()).trim();
      if (s) add(s);
      if (out.length >= 12) break;
    }

    return out;
  }, [logs?.items, form.symbol]);

  const logsItemsSafe = useMemo(() => {
    return (logs?.items ?? []).map((it) => ({
      ...it,
      status: String((it as any)?.status ?? ""),
    }));
  }, [logs?.items]);

  const selectedSymbol = normalizeSymbolWithSlashSafe(form.symbol ?? "");

  const confirmationSavedAs = useMemo(() => {
    if (confirmationUi.mode === "ALL") return t("autoSignals.confirmation.all");
    if (confirmationUi.mode === "NONE") return t("autoSignals.confirmation.none");
    if (confirmationUi.selected.length === 0) return t("autoSignals.confirmation.none");
    return confirmationUi.selected.join("+");
  }, [confirmationUi.mode, confirmationUi.selected, t]);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
            <LineChart className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-fluid-xs sm:text-sm text-muted-foreground">
              {t("learnMore.trading.title")}
            </div>
            <div className="text-lg sm:text-2xl font-bold leading-tight break-words">
              {t("header.tradingAnalyzer")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {locked ? (
            <>
              {isTouch && lockOpen ? (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLockOpen(false)}
                  aria-hidden="true"
                />
              ) : null}
              <Tooltip open={isTouch ? lockOpen : undefined} onOpenChange={isTouch ? setLockOpen : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background/60 px-2 py-2 text-muted-foreground hover:text-foreground"
                    aria-label={lockedTooltip}
                    onClick={
                      isTouch
                        ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLockOpen((v) => !v);
                          }
                        : undefined
                    }
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  {lockedTooltip}
                </TooltipContent>
              </Tooltip>
            </>
          ) : null}

          <Badge
            variant="outline"
            className={cn(
              "text-[11px] sm:text-xs",
              form.enabled && !locked ? "text-primary border-primary/50" : ""
            )}
          >
            {locked ? t("autoSignals.disabled") : form.enabled ? t("autoSignals.enabled") : t("autoSignals.disabled")}
          </Badge>
        </div>
      </div>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">{t("autoSignals.toggleTitle")}</div>
            <div className="text-fluid-xs sm:text-xs text-muted-foreground">
              {t("autoSignals.toggleHint")}
            </div>
          </div>
          <Switch
            checked={!!form.enabled}
            onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
            disabled={locked}
            className="shrink-0"
          />
        </div>

        {status ? (
          <div className="pt-3 text-fluid-xs sm:text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
            <div className="min-w-0">
              <span className="font-medium">{t("autoSignals.lastCheck")}: </span>
              <span className="font-mono break-words">{formatIsoLocal(status.last_check, language)}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium">{t("autoSignals.nextCheck")}: </span>
              <span className="font-mono break-words">{formatIsoLocal(status.next_check, language)}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium">{t("autoSignals.nextCheckIn")}: </span>
              <span className="font-mono">{status.minutes_until_next}m</span>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t("autoSignals.pairTitle")}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {suggestedPairs.map((p) => (
              <ChoiceCard
                key={p}
                title={p}
                compact
                selected={normalizeSymbolWithSlash(form.symbol ?? "") === p}
                disabled={locked}
                onClick={() => setForm((prev) => ({ ...prev, symbol: p }))}
              />
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Label>{t("autoSignals.customPair")}</Label>
            <Input
              value={form.symbol ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
              placeholder={t("autoSignals.customPairPlaceholder")}
              disabled={locked}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{t("autoSignals.tradingTypeTitle")}</div>
              <InfoHelp label={t("autoSignals.tradingTypeTitle")} text={t("autoSignals.tradingTypeInfo")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tradingTypes.map((it) => (
              <ChoiceCard
                key={it.value}
                title={t(it.labelKey)}
                subtitle={""}
                selected={form.trading_type === it.value}
                compact
                disabled={locked}
                onClick={() => setForm((p) => ({ ...p, trading_type: it.value }))}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{t("autoSignals.strategyTitle")}</div>
              <InfoHelp label={t("autoSignals.strategyTitle")} text={t("autoSignals.strategyInfo")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {strategies.map((it) => (
              <ChoiceCard
                key={it.value}
                title={t(it.labelKey)}
                subtitle={""}
                selected={form.strategy === it.value}
                compact
                disabled={locked}
                onClick={() => setForm((p) => ({ ...p, strategy: it.value }))}
              />
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("autoSignals.capital")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.capital ?? ""}
                max={MAX_CAPITAL}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capital: toClampedNumberOrNull(e.target.value, 0, MAX_CAPITAL) }))
                }
                placeholder="2500"
                disabled={locked}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("autoSignals.risk")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.risk ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, risk: toClampedNumberOrNull(e.target.value, 0, 100) }))
                }
                placeholder="1"
                disabled={locked}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("autoSignals.minReliability")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.min_reliability ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, min_reliability: toClampedNumberOrNull(e.target.value, 0, 100) }))
                }
                placeholder="60"
                disabled={locked}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("autoSignals.checkInterval")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.check_interval ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, check_interval: toNumberOrNull(e.target.value) }))
                }
                placeholder="5"
                disabled={locked}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="font-semibold whitespace-nowrap">{t("autoSignals.confirmationTitle")}</div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge
                variant={confirmationUi.mode === "ALL" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfirmationUi({ mode: "ALL", selected: [] })}
              >
                {t("autoSignals.confirmation.all")}
              </Badge>
              <Badge
                variant={confirmationUi.mode === "NONE" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfirmationUi({ mode: "NONE", selected: [] })}
              >
                {t("autoSignals.confirmation.none")}
              </Badge>
              <Badge
                variant={confirmationUi.mode === "CUSTOM" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfirmationUi((p) => ({ mode: "CUSTOM", selected: p.selected }))}
              >
                {t("autoSignals.custom")}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {confirmationIndicators.map((name) => {
              const selected = confirmationUi.mode === "CUSTOM" && confirmationUi.selected.includes(name);
              const disabled = locked || confirmationUi.mode !== "CUSTOM";
              return (
                <button
                  key={name}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setConfirmationUi((prev) => {
                      if (prev.mode !== "CUSTOM") return prev;
                      const has = prev.selected.includes(name);
                      return {
                        ...prev,
                        selected: has ? prev.selected.filter((x) => x !== name) : [...prev.selected, name],
                      };
                    });
                  }}
                  className={cn(
                    "relative rounded-xl border border-card-border bg-card px-2.5 py-1.5 text-[13px] font-medium transition-all duration-300 toggle-elevate hover-elevate disabled:opacity-50 disabled:pointer-events-none",
                    selected && "toggle-elevated border-primary/50",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground">
            {t("autoSignals.confirmationSavedAs")} <span className="font-mono">{confirmationSavedAs}</span>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="font-semibold">{t("autoSignals.notificationsTitle")}</div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 items-start">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("autoSignals.email")}</div>
                <div className="text-xs text-muted-foreground">{t("autoSignals.emailHint")}</div>
              </div>
              <Switch
                checked={!!form.enable_email_notifications}
                onCheckedChange={(v) => setForm((p) => ({ ...p, enable_email_notifications: v }))}
                disabled={locked}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t("autoSignals.telegram")}</div>
                  <div className="text-xs text-muted-foreground">{t("autoSignals.telegramHint")}</div>
                </div>
                <Switch
                  checked={!!form.enable_telegram_notifications}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, enable_telegram_notifications: v }))}
                  disabled={locked}
                />
              </div>

              {form.enable_telegram_notifications ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("autoSignals.telegramChatId")}</Label>
                    <a
                      href="https://cryptoanalyz.net/faq"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label="FAQ"
                    >
                      <Info className="h-4 w-4" />
                    </a>
                  </div>
                  <Input
                    value={form.telegram_chat_id ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, telegram_chat_id: e.target.value }))}
                    placeholder="123456789"
                    disabled={locked}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={locked || saving || settingsLoading || !isDirty}
          className="w-full sm:w-auto"
        >
          {saving ? t("autoSignals.saving") : t("autoSignals.save")}
        </Button>
      </div>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="font-semibold">{t("autoSignals.testOutput")}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                testMutation.mutate();
              }}
              disabled={locked || testing || settingsLoading || saving}
              className="w-full sm:w-auto"
            >
              {testing ? t("autoSignals.testing") : t("autoSignals.test")}
            </Button>
          </div>
          <Textarea
            value={testOutput}
            readOnly
            placeholder={t("autoSignals.testOutputPlaceholder")}
            className="font-mono text-xs min-h-[120px]"
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t("autoSignals.logsTitle")}</div>
          </div>

          <div className="rounded-xl border border-card-border overflow-x-auto autosignals-logs-scrollbar w-full max-w-full min-w-0">
            <Table
              className="text-xs w-max min-w-full table-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap"
              data-no-x-scroll
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-[11px]">{t("autoSignals.table.id")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("autoSignals.table.symbol")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] hidden sm:table-cell">{t("autoSignals.table.tf")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("autoSignals.table.status")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] hidden md:table-cell">{t("autoSignals.table.rel")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("autoSignals.table.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs?.items ?? []).map((item) => (
                  <Dialog key={item.id}>
                    <DialogTrigger asChild>
                      <TableRow className="cursor-pointer">
                        <TableCell className="px-2 py-2 font-mono text-[11px]">{item.id}</TableCell>
                        <TableCell className="px-2 py-2 font-mono text-[11px]">{item.symbol ?? ""}</TableCell>
                        <TableCell className="px-2 py-2 font-mono text-[11px] hidden sm:table-cell">{item.timeframe ?? ""}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (() => {
                                const st = toTrimmedLower(String((item as any)?.status));
                                if (st === "ok" || st === "success" || st === "fired") return "default";
                                if (st === "error") return "destructive";
                                return "secondary";
                              })()
                            }
                          >
                            {(() => {
                              const rawStatus = String((item as any)?.status ?? "");
                              const key = `autoSignals.status.${rawStatus.toLowerCase()}`;
                              const translated = t(key);
                              return translated === key ? rawStatus : translated;
                            })()}
                          </Badge>
                          {item.error ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {(() => {
                                const err = String((item as any)?.error ?? "");
                                const key = `autoSignals.skip.${err}`;
                                const label = t(key);
                                return label === key ? err : label;
                              })()}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2 py-2 font-mono text-[10px] tabular-nums hidden md:table-cell">{item.reliability ?? ""}</TableCell>
                        <TableCell className="px-2 py-2 text-[11px] text-muted-foreground">
                          {(() => {
                            const raw = formatIsoLocal(item.created_at ?? "", language);
                            const parts = raw.split(" ");
                            const date = parts.slice(0, -1).join(" ") || "-";
                            const time = parts.slice(-1)[0] || "-";
                            return (
                              <div className="leading-tight">
                                <div className="whitespace-normal sm:whitespace-nowrap">{date}</div>
                                <div className="whitespace-normal sm:whitespace-nowrap">{time}</div>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl w-[calc(100%-24px)] sm:w-full max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {t("autoSignals.logTitle")} #{item.id}
                        </DialogTitle>
                        <DialogDescription>
                          {item.symbol} {item.timeframe} {item.status}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {item.error ? (
                          <Card className="p-4 border-destructive/30">
                            <div className="text-sm font-medium">{t("autoSignals.error")}</div>
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                              {item.error}
                            </div>
                          </Card>
                        ) : null}

                        <div className="space-y-2">
                          <div className="text-sm font-medium">{t("autoSignals.message")}</div>
                          <Textarea
                            value={item.message ?? ""}
                            readOnly
                            className="min-h-[100px] sm:min-h-[140px] max-h-[40vh] font-mono text-xs autosignals-logs-scrollbar"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">{t("autoSignals.meta")}</div>
                          <Textarea
                            value={item.meta ?? ""}
                            readOnly
                            className="min-h-[100px] sm:min-h-[140px] max-h-[40vh] font-mono text-xs autosignals-logs-scrollbar"
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}

                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {t("autoSignals.loading")}
                    </TableCell>
                  </TableRow>
                ) : null}

                {!logsLoading && (logs?.items?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {t("autoSignals.noLogs")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setLogsLimit((p) => (p >= 100 ? 10 : 100))}
              disabled={!canShowMoreLogs && logsLimit < 100}
            >
              {logsLimit >= 100 ? t("autoSignals.logsShowLess") : t("autoSignals.logsShowMore")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
