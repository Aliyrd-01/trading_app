import React, { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { Repeat, Lock, Info } from "lucide-react";

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

function TouchTooltip({
  label,
  content,
  children,
  side,
  align,
  contentClassName,
}: {
  label: string;
  content: React.ReactNode;
  children: React.ReactElement<any>;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  contentClassName?: string;
}) {
  const isTouch = useIsTouchDevice();
  const _id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isTouch && open) setOpen(false);
  }, [isTouch, open]);

  const trigger = React.isValidElement(children)
    ? (React.cloneElement as any)(children as any, {
        onClick: isTouch
          ? (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v: boolean) => !v);
            }
          : (children as any)?.props?.onClick,
        "aria-label": label,
        "aria-describedby": _id,
      })
    : children;

  return (
    <>
      {isTouch && open ? (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}
      <Tooltip open={isTouch ? open : undefined} onOpenChange={isTouch ? setOpen : undefined}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side={side ?? "top"}
          align={align ?? "start"}
          className={cn(
            "max-w-[calc(100vw-24px)] sm:max-w-[340px] whitespace-pre-line break-words",
            contentClassName
          )}
          id={_id}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

type SpreadAlertsAccess = {
  allowed: boolean;
  reason: string | null;
  trial_expires_at: string | null;
};

type SpreadAlertsLimits = {
  min_interval_minutes: number;
  max_rules: number;
};

type SpreadAlertRule = {
  id: number;
  user_id: number;
  enabled: boolean;
  symbol: string;
  exchanges: string[];
  threshold_percent: number;
  check_interval_minutes: number;
  cooldown_seconds: number;
  last_checked_at: string | null;
  last_fired_at: string | null;
  last_fired_key: string | null;
  created_at: string;
  updated_at: string;
};

type SpreadAlertsSettingsResponse = {
  items: SpreadAlertRule[];
  enabled?: boolean;
  access?: SpreadAlertsAccess;
  limits?: SpreadAlertsLimits;
  error?: string;
};

type SpreadAlertsStatusResponse = {
  enabled?: boolean;
  last_check: string | null;
  next_check: string | null;
  minutes_until_next: number;
  next_rule_id?: number | null;
  next_rule_interval_minutes?: number | null;
  next_rule_next_check?: string | null;
  next_rule_last_checked_at?: string | null;
  access?: SpreadAlertsAccess;
  limits?: SpreadAlertsLimits;
};

function formatIsoLocalParts(value: any, language: any) {
  const raw = formatIsoLocal(value ?? "", language);
  const parts = raw.split(" ");
  const date = parts.slice(0, -1).join(" ") || "-";
  const time = parts.slice(-1)[0] || "-";
  return { date, time };
}

type SpreadAlertsTestResponse = {
  message: string;
  output: string;
};

type SpreadAlertLogItem = {
  id: number;
  rule_id: number;
  status: string;
  spread_percent: string | number | null;
  prices: any;
  message: string | null;
  error: string | null;
  fired_key: string | null;
  fired_at: string | null;
  created_at: string;
};

type SpreadAlertsLogsResponse = {
  items: SpreadAlertLogItem[];
};

function formatIsoLocal(iso: string | null | undefined, language: string): string {
  const raw = (iso ?? "").trim();
  if (!raw) return "-";

  const locale = language === "ru" ? "ru-RU" : language === "uk" ? "uk-UA" : "en-GB";
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

function normalizeSymbolWithSlash(symbol: string | null | undefined): string {
  const raw = (symbol ?? "").trim().toUpperCase();
  if (!raw) return "";

  if (raw.includes("/")) {
    return raw;
  }

  const commonQuotes = ["USDT", "USDC", "USD", "EUR", "BTC", "ETH", "BNB"];
  for (const q of commonQuotes) {
    if (raw.endsWith(q) && raw.length > q.length) {
      return `${raw.slice(0, raw.length - q.length)}/${q}`;
    }
  }

  return raw;
}

function toNumberOrNull(v: string | null | undefined): number | null {
  const s = (v ?? "").trim().replace(/,/g, ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

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

export default function SpreadAlertsPanel() {
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const [logsLimit, setLogsLimit] = useState<number>(10);
  const [testOutput, setTestOutput] = useState<string>("");
  const [exDialogOpen, setExDialogOpen] = useState(false);
  const [exDraft, setExDraft] = useState<string[]>([]);
  const [exDraftError, setExDraftError] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<SpreadAlertsSettingsResponse>({
    queryKey: ["/api/spread_alerts/settings"],
  });

  const { data: status } = useQuery<SpreadAlertsStatusResponse>({
    queryKey: ["/api/spread_alerts/status"],
    refetchInterval: 30_000,
  });

  const logsUrl = useMemo(() => `/api/spread_alerts/logs?limit=${logsLimit}`, [logsLimit]);

  const { data: logs, isLoading: logsLoading } = useQuery<SpreadAlertsLogsResponse>({
    queryKey: [logsUrl],
  });

  const { data: notifications } = useQuery<{
    enable_email_notifications: boolean;
    enable_telegram_notifications: boolean;
    telegram_chat_id: string | null;
  }>({
    queryKey: ["/api/spread_alerts/notifications"],
  });

  const [notificationsForm, setNotificationsForm] = useState<{
    enable_email_notifications: boolean;
    enable_telegram_notifications: boolean;
    telegram_chat_id: string;
  } | null>(null);

  useEffect(() => {
    if (!notifications) return;
    setNotificationsForm({
      enable_email_notifications: !!notifications.enable_email_notifications,
      enable_telegram_notifications: !!notifications.enable_telegram_notifications,
      telegram_chat_id: notifications.telegram_chat_id ?? "",
    });
  }, [notifications?.enable_email_notifications, notifications?.enable_telegram_notifications, notifications?.telegram_chat_id]);

  const locked = settings?.access ? !settings.access.allowed : status?.access ? !status.access.allowed : false;

  const [masterEnabled, setMasterEnabled] = useState<boolean>(false);

  const [selectedLog, setSelectedLog] = useState<SpreadAlertLogItem | null>(null);

  useEffect(() => {
    if (typeof settings?.enabled !== "boolean") return;
    setMasterEnabled(settings.enabled);
  }, [settings?.enabled]);

  const limits = settings?.limits ?? status?.limits;
  const minInterval = limits?.min_interval_minutes ?? 1;
  const maxRules = limits?.max_rules ?? 1;

  const [form, setForm] = useState<{
    id: number | null;
    enabled: boolean;
    symbol: string;
    exchanges: string[];
    threshold_percent: number | null;
    check_interval_minutes: number | null;
    cooldown_seconds: number | null;
  }>(
    {
      id: null,
      enabled: true,
      symbol: "BTC/USDT",
      exchanges: ["Binance", "OKX"],
      threshold_percent: 0.1,
      check_interval_minutes: 1,
      cooldown_seconds: 300,
    }
  );

  useEffect(() => {
    if (!settings?.items) return;
    if (settings.items.length === 0) return;
    if (form.id != null) return;

    const first = settings.items[0];
    if (!first) return;
    setForm({
      id: first.id,
      enabled: !!first.enabled,
      symbol: first.symbol || "BTC/USDT",
      exchanges: Array.isArray(first.exchanges) ? first.exchanges : ["Binance", "OKX"],
      threshold_percent: typeof first.threshold_percent === "number" ? first.threshold_percent : Number(first.threshold_percent ?? 0),
      check_interval_minutes: first.check_interval_minutes ?? 1,
      cooldown_seconds: first.cooldown_seconds ?? 300,
    });
  }, [settings?.items]);

  const rulesCount = settings?.items?.length ?? 0;

  const saveRuleMutation = useMutation({
    mutationFn: async (payload: {
      id?: number | null;
      enabled: boolean;
      symbol: string;
      exchanges: string[];
      threshold_percent: number;
      check_interval_minutes: number;
      cooldown_seconds: number;
    }) => {
      const symbol = normalizeSymbolWithSlash(payload.symbol);
      if (!symbol) {
        throw new Error("Symbol is required");
      }
      if (!Array.isArray(payload.exchanges) || payload.exchanges.length < 2) {
        throw new Error(t("spreadAlerts.errors.minExchanges"));
      }

      const threshold = payload.threshold_percent ?? 0;
      if (threshold < 0) {
        throw new Error("Threshold must be >= 0");
      }
      if (threshold > 100) {
        throw new Error("Threshold must be <= 100");
      }

      const interval = payload.check_interval_minutes ?? 1;
      if (interval < minInterval) {
        throw new Error(`Min interval is ${minInterval} min`);
      }

      const cooldown = payload.cooldown_seconds ?? 0;
      if (cooldown < 0) {
        throw new Error("Cooldown must be >= 0");
      }

      const resp = await apiRequest("POST", "/api/spread_alerts/rule", {
        id: payload.id ?? undefined,
        enabled: !!payload.enabled,
        symbol,
        exchanges: payload.exchanges,
        threshold_percent: threshold,
        check_interval_minutes: interval,
        cooldown_seconds: cooldown,
      } as any);
      return (await resp.json()) as SpreadAlertsSettingsResponse;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/spread_alerts/settings"] });
      const prev = queryClient.getQueryData<SpreadAlertsSettingsResponse>(["/api/spread_alerts/settings"]);

      if (prev?.items && payload.id != null) {
        queryClient.setQueryData<SpreadAlertsSettingsResponse>(["/api/spread_alerts/settings"], {
          ...prev,
          items: prev.items.map((it) => (it.id === payload.id ? { ...it, enabled: payload.enabled } : it)),
        });
      }

      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/status"] });
      queryClient.invalidateQueries({ queryKey: [logsUrl] });
      toast({ title: t("spreadAlerts.toast.saved") });
    },
    onError: (e: any, _payload, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["/api/spread_alerts/settings"], ctx.prev);
      }
      toast({
        title: t("spreadAlerts.toast.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      const resp = await apiRequest("DELETE", "/api/spread_alerts/rule", { id: ruleId } as any);
      return (await resp.json()) as SpreadAlertsSettingsResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/status"] });
      queryClient.invalidateQueries({ queryKey: [logsUrl] });
      toast({ title: t("spreadAlerts.toast.deleted") });
      setForm((p) => ({ ...p, id: null }));
    },
    onError: (e: any) => {
      toast({
        title: t("spreadAlerts.toast.deleteError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/spread_alerts/test", { language } as any);
      return (await resp.json()) as SpreadAlertsTestResponse;
    },
    onSuccess: (data) => {
      setTestOutput(data.output || "");
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/status"] });
      queryClient.invalidateQueries({ queryKey: [logsUrl] });
      toast({ title: t("spreadAlerts.toast.testDone") });
    },
    onError: (e: any) => {
      setTestOutput("");
      toast({
        title: t("spreadAlerts.toast.testError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const saving = saveRuleMutation.isPending;
  const testing = testMutation.isPending;

  const saveNotificationsMutation = useMutation({
    mutationFn: async (payload: {
      enable_email_notifications?: boolean;
      enable_telegram_notifications?: boolean;
      telegram_chat_id?: string | null;
    }) => {
      const resp = await apiRequest("POST", "/api/spread_alerts/notifications", payload as any);
      return (await resp.json()) as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/notifications"] });
      toast({ title: t("spreadAlerts.toast.saved") });
    },
    onError: (e: any) => {
      toast({
        title: t("spreadAlerts.toast.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const canCreateNewRule = rulesCount < maxRules;

  const saveMasterMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const resp = await apiRequest("POST", "/api/spread_alerts/settings", { enabled } as any);
      return (await resp.json()) as SpreadAlertsSettingsResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spread_alerts/status"] });
      toast({ title: t("spreadAlerts.toast.saved") });
    },
    onError: (e: any) => {
      toast({
        title: t("spreadAlerts.toast.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const lockedTooltip = t("spreadAlerts.upgradeToPro");

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center shrink-0">
            <Repeat className="w-6 h-6 text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="text-fluid-xs sm:text-sm text-muted-foreground">
              {t("spreadAlerts.title")}
            </div>
            <div className="text-lg sm:text-2xl font-bold leading-tight break-words">
              {t("spreadAlerts.subtitle")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {locked ? (
            <TouchTooltip
              label="Locked"
              content={lockedTooltip}
              side="top"
              align="end"
              contentClassName="max-w-xs whitespace-normal"
            >
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background/60 px-2 py-2 text-muted-foreground hover:text-foreground"
              >
                <Lock className="h-4 w-4" />
              </button>
            </TouchTooltip>
          ) : null}

          <Badge
            variant="outline"
            className={cn(
              "text-[11px] sm:text-xs",
              masterEnabled && !locked ? "text-primary border-primary/50" : ""
            )}
          >
            {locked
              ? t("spreadAlerts.disabled")
              : masterEnabled
                ? t("spreadAlerts.enabled")
                : t("spreadAlerts.disabled")}
          </Badge>
        </div>
      </div>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">{t("spreadAlerts.toggleTitle")}</div>
            <div className="text-fluid-xs sm:text-xs text-muted-foreground">{t("spreadAlerts.toggleHint")}</div>
          </div>
          <Switch
            checked={!!masterEnabled}
            onCheckedChange={(v) => {
              setMasterEnabled(v);
              saveMasterMutation.mutate(v);
            }}
            disabled={locked || saveMasterMutation.isPending}
            className="shrink-0"
          />
        </div>

        {status ? (
          <div className="pt-3 text-fluid-xs sm:text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
            <div className="min-w-0">
              <span className="font-medium">{t("spreadAlerts.lastCheck")}: </span>
              <span className="font-mono break-words">{formatIsoLocal(status.last_check, language)}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium">{t("spreadAlerts.nextCheck")}: </span>
              <span className="font-mono break-words">{formatIsoLocal(status.next_check, language)}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium">{t("spreadAlerts.nextCheckIn")}: </span>
              <span className="font-mono">{status.minutes_until_next}m</span>
              {status.next_rule_id != null && status.next_rule_interval_minutes != null ? (
                <span className="font-mono inline-flex items-center gap-1">
                  {" "}{"—"} #{status.next_rule_id} · {status.next_rule_interval_minutes}m
                  <TouchTooltip
                    label="Info"
                    content={t("spreadAlerts.statusIntervalHelp")}
                    side="top"
                    align="start"
                    contentClassName="max-w-xs"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label="Info"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TouchTooltip>
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="pt-3 text-fluid-xs sm:text-xs text-muted-foreground">{t("spreadAlerts.status.unavailable")}</div>
        )}
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold">{t("spreadAlerts.rules")}</div>
              <div className="text-fluid-xs sm:text-xs text-muted-foreground">
                {t("spreadAlerts.rulesHint").replace("{maxRules}", String(maxRules))}
              </div>
            </div>

            {limits ? (
              <Badge variant="outline" className="text-[11px] sm:text-xs w-fit self-start sm:self-auto">
                {t("spreadAlerts.rulesCount")
                  .replace("{count}", String(rulesCount))
                  .replace("{max}", String(maxRules))
                  .replace("{min}", String(minInterval))}
              </Badge>
            ) : null}

            <Button
              variant="outline"
              disabled={locked || !canCreateNewRule}
              onClick={() =>
                setForm({
                  id: null,
                  enabled: true,
                  symbol: "BTC/USDT",
                  exchanges: ["Binance", "OKX"],
                  threshold_percent: 0.1,
                  check_interval_minutes: Math.max(1, minInterval),
                  cooldown_seconds: 300,
                })
              }
            >
              {t("spreadAlerts.newRule")}
            </Button>
          </div>

          <div className="rounded-xl border border-card-border overflow-x-auto autosignals-logs-scrollbar w-full max-w-full min-w-0">
            <Table className="text-xs w-max min-w-full table-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("spreadAlerts.table.id")}</TableHead>
                  <TableHead>{t("spreadAlerts.table.enabled")}</TableHead>
                  <TableHead>{t("spreadAlerts.table.symbol")}</TableHead>
                  <TableHead>{t("spreadAlerts.table.exchanges")}</TableHead>
                  <TableHead>{t("spreadAlerts.table.threshold")}</TableHead>
                  <TableHead>{t("spreadAlerts.table.interval")}</TableHead>
                  <TableHead className="text-right">{t("spreadAlerts.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(settings?.items ?? []).map((r) => {
                  const selected = form.id === r.id;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(selected ? "bg-muted/40" : "", "cursor-pointer")}
                      onClick={() =>
                        setForm({
                          id: r.id,
                          enabled: !!r.enabled,
                          symbol: r.symbol,
                          exchanges: Array.isArray(r.exchanges) ? r.exchanges : [],
                          threshold_percent: typeof r.threshold_percent === "number" ? r.threshold_percent : Number(r.threshold_percent ?? 0),
                          check_interval_minutes: r.check_interval_minutes ?? 1,
                          cooldown_seconds: r.cooldown_seconds ?? 300,
                        })
                      }
                    >
                      <TableCell className="font-mono">{r.id}</TableCell>
                      <TableCell>
                        <Switch
                          checked={!!r.enabled}
                          disabled={locked}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onCheckedChange={(v) => {
                            const updatedRule = {
                              id: r.id,
                              enabled: v,
                              symbol: r.symbol,
                              exchanges: Array.isArray(r.exchanges) ? r.exchanges : [],
                              threshold_percent: typeof r.threshold_percent === "number" ? r.threshold_percent : Number(r.threshold_percent ?? 0),
                              check_interval_minutes: r.check_interval_minutes ?? 1,
                              cooldown_seconds: r.cooldown_seconds ?? 300,
                            };
                            setForm(updatedRule);
                            saveRuleMutation.mutate(updatedRule);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{r.symbol}</TableCell>
                      <TableCell className="text-xs !whitespace-normal break-words max-w-[220px] leading-snug">
                        <span className="block line-clamp-3">{(r.exchanges ?? []).join(", ")}</span>
                      </TableCell>
                      <TableCell className="font-mono">{Number(r.threshold_percent ?? 0).toFixed(4)}</TableCell>
                      <TableCell className="font-mono">{r.check_interval_minutes}m</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={locked}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteRuleMutation.mutate(r.id);
                          }}
                        >
                          {t("spreadAlerts.delete")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!settingsLoading && (settings?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      {t("spreadAlerts.noRules")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="font-semibold">{t("spreadAlerts.ruleSettings")}</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("spreadAlerts.table.enabled")}</Label>
              <div>
                <Switch
                  checked={!!form.enabled}
                  disabled={locked}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("spreadAlerts.checkInterval")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.check_interval_minutes ?? ""}
                disabled={locked}
                min={minInterval}
                onChange={(e) => setForm((p) => ({ ...p, check_interval_minutes: toNumberOrNull(e.target.value) }))}
                placeholder={String(minInterval)}
              />
              <div className="text-xs text-muted-foreground">
                {t("spreadAlerts.minInterval").replace("{min}", String(minInterval))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("spreadAlerts.cooldown")}</Label>
                <TouchTooltip
                  label="Info"
                  content={t("spreadAlerts.cooldownHelp")}
                  side="top"
                  align="start"
                  contentClassName="max-w-xs whitespace-normal"
                >
                  <button
                    type="button"
                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TouchTooltip>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                value={form.cooldown_seconds ?? ""}
                disabled={locked}
                onChange={(e) => {
                  const v = toNumberOrNull(e.target.value);
                  if (v == null) {
                    setForm((p) => ({ ...p, cooldown_seconds: null }));
                    return;
                  }
                  const intV = Math.floor(v);
                  const clamped = Math.min(86400, Math.max(0, intV));
                  setForm((p) => ({ ...p, cooldown_seconds: clamped }));
                }}
                placeholder="300"
                step={1}
                min={0}
                max={86400}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("spreadAlerts.symbol")}</Label>
                <span className="inline-block w-4" aria-hidden="true" />
              </div>
              <Input
                value={form.symbol}
                disabled={locked}
                onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
                placeholder="BTC/USDT"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("spreadAlerts.threshold")}</Label>
                <TouchTooltip
                  label="Info"
                  content={t("spreadAlerts.thresholdHelp")}
                  side="top"
                  align="start"
                  contentClassName="max-w-xs whitespace-normal"
                >
                  <button
                    type="button"
                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TouchTooltip>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={form.threshold_percent ?? ""}
                disabled={locked}
                onChange={(e) => {
                  const v = toNumberOrNull(e.target.value);
                  if (v == null) {
                    setForm((p) => ({ ...p, threshold_percent: null }));
                    return;
                  }
                  const clamped = Math.min(100, Math.max(0, v));
                  setForm((p) => ({ ...p, threshold_percent: clamped }));
                }}
                placeholder="0.10"
                max={100}
              />
            </div>
            <div />
          </div>

          <div className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <Label>{t("spreadAlerts.exchanges")}</Label>
              <Dialog
                open={exDialogOpen}
                onOpenChange={(o) => {
                  setExDialogOpen(o);
                  if (o) {
                    setExDraft(Array.isArray(form.exchanges) ? form.exchanges.slice() : []);
                    setExDraftError(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={locked}>
                    {t("spreadAlerts.selectExchanges")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("spreadAlerts.selectExchanges")}</DialogTitle>
                    <DialogDescription>{t("spreadAlerts.selectExchangesHint")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={exDraft.length === availableExchanges.length}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setExDraft(v ? availableExchanges.slice() : []);
                          setExDraftError(null);
                        }}
                      />
                      <span>{t("spreadAlerts.selectAll")}</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {availableExchanges.map((ex) => {
                        const checked = exDraft.includes(ex);
                        return (
                          <label key={ex} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const v = e.target.checked;
                                setExDraft((prev) => {
                                  const cur = prev.slice();
                                  if (v) {
                                    if (!cur.includes(ex)) cur.push(ex);
                                  } else {
                                    const idx = cur.indexOf(ex);
                                    if (idx >= 0) cur.splice(idx, 1);
                                  }
                                  return cur;
                                });
                                setExDraftError(null);
                              }}
                            />
                            <span>{ex}</span>
                          </label>
                        );
                      })}
                    </div>

                    {exDraftError ? (
                      <div className="text-xs text-destructive pt-1">{exDraftError}</div>
                    ) : null}

                    <div className="pt-2">
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => {
                          const unique = Array.from(new Set(exDraft));
                          if (unique.length < 2) {
                            setExDraftError(t("spreadAlerts.errors.minExchanges"));
                            return;
                          }
                          setForm((p) => ({ ...p, exchanges: unique }));
                          setExDialogOpen(false);
                        }}
                      >
                        {t("spreadAlerts.save")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="text-xs text-muted-foreground break-words">
              {form.exchanges.length > 0 ? form.exchanges.join(", ") : "-"}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
            {form.id != null ? (
              <Badge variant="outline" className="w-fit text-[11px] sm:text-xs">
                {t("spreadAlerts.editingRule").replace("{id}", String(form.id))}
              </Badge>
            ) : null}
            <Button
              onClick={() =>
                saveRuleMutation.mutate({
                  id: form.id,
                  enabled: !!form.enabled,
                  symbol: form.symbol,
                  exchanges: form.exchanges,
                  threshold_percent: form.threshold_percent ?? 0,
                  check_interval_minutes: form.check_interval_minutes ?? 1,
                  cooldown_seconds: form.cooldown_seconds ?? 0,
                })
              }
              disabled={locked || saving}
              data-testid="button-save-spread-rule"
            >
              {saving ? t("spreadAlerts.saving") : t("spreadAlerts.save")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="font-semibold">{t("spreadAlerts.notificationsTitle")}</div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 items-start">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-medium">{t("spreadAlerts.emailTitle")}</div>
                <div className="text-xs text-muted-foreground">{t("spreadAlerts.emailHint")}</div>
              </div>
              <Switch
                checked={!!notificationsForm?.enable_email_notifications}
                onCheckedChange={(v) => {
                  setNotificationsForm((p) => (p ? { ...p, enable_email_notifications: v } : p));
                  saveNotificationsMutation.mutate({ enable_email_notifications: v });
                }}
                disabled={locked || saveNotificationsMutation.isPending}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-medium">{t("spreadAlerts.telegramTitle")}</div>
                  <div className="text-xs text-muted-foreground">{t("spreadAlerts.telegramHint")}</div>
                </div>
                <Switch
                  checked={!!notificationsForm?.enable_telegram_notifications}
                  onCheckedChange={(v) => {
                    setNotificationsForm((p) => (p ? { ...p, enable_telegram_notifications: v } : p));
                    saveNotificationsMutation.mutate({ enable_telegram_notifications: v });
                  }}
                  disabled={locked || saveNotificationsMutation.isPending}
                />
              </div>

              {notificationsForm?.enable_telegram_notifications ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("spreadAlerts.telegramChatId")}</Label>
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
                    value={notificationsForm?.telegram_chat_id ?? ""}
                    onChange={(e) => setNotificationsForm((p) => (p ? { ...p, telegram_chat_id: e.target.value } : p))}
                    onBlur={() =>
                      saveNotificationsMutation.mutate({
                        telegram_chat_id: (notificationsForm?.telegram_chat_id ?? "").trim() || null,
                      })
                    }
                    disabled={locked || saveNotificationsMutation.isPending}
                    placeholder="123456789"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="font-semibold">{t("spreadAlerts.testOutputTitle")}</div>
            <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={locked || testing}>
              {testing ? t("spreadAlerts.testing") : t("spreadAlerts.test")}
            </Button>
          </div>

          <Textarea
            value={testOutput}
            readOnly
            placeholder={t("spreadAlerts.testOutput")}
            className="font-mono text-xs autosignals-logs-scrollbar"
            rows={5}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-card-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t("spreadAlerts.recentLogsTitle")}</div>
          </div>

          <div className="rounded-xl border border-card-border overflow-x-auto autosignals-logs-scrollbar w-full max-w-full min-w-0">
            <Table className="text-xs w-max min-w-full table-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.id")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.rule")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.status")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.spread")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.time")}</TableHead>
                  <TableHead className="h-9 px-2 text-[11px]">{t("spreadAlerts.table.error")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs?.items ?? []).map((it) => (
                  <TableRow key={it.id} className="cursor-pointer" onClick={() => setSelectedLog(it)}>
                    <TableCell className="px-2 py-2 font-mono text-[11px]">{it.id}</TableCell>
                    <TableCell className="px-2 py-2 font-mono text-[11px]">{it.rule_id}</TableCell>
                    <TableCell className="px-2 py-2">
                      <Badge
                        variant={
                          it.status === "fired"
                            ? "default"
                            : it.status === "skipped"
                              ? "secondary"
                              : it.status === "error"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {(() => {
                          const key = `spreadAlerts.logStatus.${it.status}`;
                          const label = t(key);
                          return label === key ? it.status : label;
                        })()}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-2 font-mono text-[11px]">
                      {it.spread_percent == null ? "-" : Number(it.spread_percent).toFixed(4)}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-[11px] text-muted-foreground">
                      {(() => {
                        const { date, time } = formatIsoLocalParts(it.created_at ?? "", language);
                        return (
                          <div className="leading-tight">
                            <div className="whitespace-normal sm:whitespace-nowrap">{date}</div>
                            <div className="whitespace-normal sm:whitespace-nowrap">{time}</div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-[11px] text-muted-foreground break-words">
                      {(() => {
                        const raw = it.error ?? "";
                        if (!raw) return "";
                        const key = `spreadAlerts.logError.${raw}`;
                        const label = t(key);
                        return label === key ? raw : label;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {t("spreadAlerts.loading")}
                    </TableCell>
                  </TableRow>
                ) : null}

                {!logsLoading && (logs?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {t("spreadAlerts.noLogs")}
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
              disabled={(logs?.items ?? []).length < 10}
            >
              {logsLimit >= 100 ? t("spreadAlerts.logsShowLess") : t("spreadAlerts.logsShowMore")}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(o) => (!o ? setSelectedLog(null) : null)}>
        <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-mono">{t("spreadAlerts.logTitle")} #{selectedLog?.id ?? ""}</DialogTitle>
            <DialogDescription>{t("spreadAlerts.recentLogsTitle")}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.table.rule")}</div>
              <div className="font-mono">{selectedLog?.rule_id ?? "-"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.table.status")}</div>
              <div>
                {(() => {
                  const s = selectedLog?.status ?? "";
                  const key = `spreadAlerts.logStatus.${s}`;
                  const label = t(key);
                  return label === key ? s : label;
                })()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.table.spread")}</div>
              <div className="font-mono">
                {selectedLog?.spread_percent == null ? "-" : Number(selectedLog?.spread_percent).toFixed(6)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.table.time")}</div>
              <div className="font-mono">{formatIsoLocal(selectedLog?.created_at, language)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.firedAt")}</div>
              <div className="font-mono">{formatIsoLocal(selectedLog?.fired_at ?? null, language)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.firedKey")}</div>
              <div className="font-mono break-all">{selectedLog?.fired_key ?? "-"}</div>
            </div>
          </div>

          {selectedLog?.message ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.message")}</div>
              <div className="max-h-64 overflow-y-auto autosignals-logs-scrollbar whitespace-pre-wrap break-words text-sm">
                {selectedLog.message}
              </div>
            </div>
          ) : null}

          {selectedLog?.error ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t("spreadAlerts.table.error")}</div>
              <div className="max-h-48 overflow-y-auto autosignals-logs-scrollbar whitespace-pre-wrap break-words text-sm text-destructive">
                {(() => {
                  const raw = selectedLog.error ?? "";
                  if (!raw) return "";
                  const key = `spreadAlerts.logError.${raw}`;
                  const label = t(key);
                  return label === key ? raw : label;
                })()}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("spreadAlerts.prices")}</div>
            <Textarea
              value={selectedLog?.prices ? JSON.stringify(selectedLog.prices, null, 2) : ""}
              readOnly
              className="font-mono text-xs autosignals-logs-scrollbar"
              rows={8}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
