import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Repeat, User, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from '@/lib/i18n';
import AutoSignalsPanel from "@/components/AutoSignalsPanel";
import Header from "@/components/Header";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/auth');
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-card">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await apiRequest("DELETE", "/api/auth/account", { password: deletePassword });
      toast({ title: t('dashboard.deleteAccountDeleted') });
      setDeleteOpen(false);
      setDeletePassword("");
      await logout();
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "";
      const invalidPassword = typeof msg === 'string' && (msg.includes('INVALID_PASSWORD') || msg.toLowerCase().includes('invalid password'));
      toast({
        title: invalidPassword ? t('dashboard.deleteAccountInvalidPassword') : t('dashboard.deleteAccountFailed'),
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card">
      <Header />

      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-2 flex-1 min-w-0 max-w-3xl">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
                {t('dashboard.welcome')}, {user.name || 'Trader'}!
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground break-words">
                {t('dashboard.description')}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block max-w-[260px]">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {user.name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-user-email">
                  {user.email}
                </p>
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={handleLogout}
                data-testid="button-logout"
                className="shrink-0"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          <Card className="p-4 sm:p-6 lg:p-8 border-primary/20 backdrop-blur-sm" data-testid="card-user-profile">
            <div className="space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold">{t('dashboard.profile')}</h2>
              <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('dashboard.name')}</p>
                    <p className="font-medium">{user.name || t('dashboard.notSet')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('auth.email')}</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Dialog open={deleteOpen} onOpenChange={(v) => {
                  setDeleteOpen(v);
                  if (!v) setDeletePassword("");
                }}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" disabled={deleteBusy}>
                      {t('dashboard.deleteAccount')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('dashboard.deleteAccount')}</DialogTitle>
                      <DialogDescription>{t('dashboard.deleteAccountDesc')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                      <Label htmlFor="deletePassword">{t('dashboard.deleteAccountPassword')}</Label>
                      <Input
                        id="deletePassword"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleteBusy}
                      >
                        {t('dashboard.deleteAccountCancel')}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleteBusy || !deletePassword.trim()}
                      >
                        {t('dashboard.deleteAccountConfirm')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <Card className="p-4 sm:p-6 lg:p-8 hover-elevate transition-all duration-300 border-primary/20" data-testid="card-trading-analyzer">
              <AutoSignalsPanel />
            </Card>

            <Card className="p-4 sm:p-6 lg:p-8 hover-elevate transition-all duration-300 border-secondary/20" data-testid="card-arbitrage-tool">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                    <Repeat className="w-7 h-7 text-secondary" />
                  </div>
                  <Badge variant="outline" className="text-secondary border-secondary/50">
                    {t('dashboard.comingSoon')}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">{t('header.arbitrageTool')}</h3>
                  <p className="text-muted-foreground">
                    {t('dashboard.arbitrageDescription')}
                  </p>
                </div>
                <Button className="w-full" disabled data-testid="button-launch-arbitrage">
                  {t('dashboard.launchTool')}
                </Button>
              </div>
            </Card>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
