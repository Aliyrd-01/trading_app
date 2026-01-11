import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../lib/auth";
import { useLanguage } from '@/lib/i18n';
import { apiRequest } from "../lib/queryClient";

export default function Auth() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const { login, register, user, loading } = useAuth();
  const { t } = useLanguage();
  const defaultTab = searchParams.includes("mode=signup") ? "signup" : "signin";

  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ email: "", password: "", confirmPassword: "", name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showEmailNotVerified, setShowEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Если пользователь уже аутентифицирован или стал аутентифицирован — увести на дашборд
  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowEmailNotVerified(false);

    try {
      await login(signInData.email, signInData.password);
      toast({
        title: t("dashboard.welcome"),
        description: t("auth.loginSuccessDesc") || undefined,
      });
    } catch (error) {
      const err = error as Error & { code?: string; email?: string };
      
      // Проверяем, является ли ошибка связанной с неподтвержденным email
      if (err.code === "EMAIL_NOT_VERIFIED" && err.email) {
        setUnverifiedEmail(err.email);
        setShowEmailNotVerified(true);
        toast({
          title: t("auth.emailNotVerified") || "Email not verified",
          description: t("auth.emailNotVerifiedDesc") || "Please verify your email address before signing in.",
          variant: "destructive",
        });
      } else {
        toast({
          title: t("auth.error"),
          description:
            err.code === "INVALID_CREDENTIALS"
              ? t("auth.invalidCredentials")
              : (err?.message || "").trim() || t("auth.loginFailed"),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: t("auth.error"),
        description: t("auth.passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password.length < 6) {
      toast({
        title: t("auth.error"),
        description: t("auth.passwordTooShort"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Регистрируем пользователя
      await register(signUpData.email, signUpData.password, signUpData.name);
      
      toast({
        title: t("auth.accountCreated") || "Account created!",
        description: t("auth.registerSuccessDesc") || undefined,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResettingPassword(true);

    try {
      await apiRequest("POST", "/api/auth/reset-password-request", { email: forgotPasswordEmail });
      toast({
        title: t("auth.resetEmailSent") || "Reset email sent",
        description: t("auth.resetEmailSentDesc") || "If the email exists, a password reset link has been sent to your email.",
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error) {
      toast({
        title: t("auth.error") || "Error",
        description: error instanceof Error ? error.message : "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    
    setIsResendingVerification(true);

    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email: unverifiedEmail });
      toast({
        title: t("auth.verificationEmailSent") || "Verification email sent",
        description: t("auth.verificationEmailSentDesc") || "A verification email has been sent to your email address.",
      });
    } catch (error) {
      toast({
        title: t("auth.error") || "Error",
        description: error instanceof Error ? error.message : "Failed to send verification email",
        variant: "destructive",
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-card p-6 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('auth.back')}
        </Button>

        <Card className="p-6 sm:p-8 backdrop-blur-sm border-primary/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2 break-words">
              Cryptoanaliz
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground break-words">{t('auth.title')}</p>
          </div>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin" data-testid="tab-signin" className="text-xs sm:text-sm break-words">{t('header.signIn')}</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup" className="text-xs sm:text-sm break-words">{t('header.signUp')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t('auth.email')}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                    disabled={isLoading}
                    data-testid="input-signin-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t('auth.password')}</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    data-testid="input-signin-password"
                  />
                </div>
                <Button 
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={() => setShowForgotPassword(true)}
                  data-testid="button-forgot-password"
                >
                  {t('auth.forgotPassword') || 'Forgot password?'}
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signin-submit">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? t('auth.signingIn') : t('header.signIn')}
                </Button>
              </form>

              {showEmailNotVerified && (
                <Card className="p-4 mt-4 backdrop-blur-sm border-yellow-500/50 bg-yellow-500/10">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">
                          {t("auth.emailNotVerified") || "Email Not Verified"}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          {t("auth.emailNotVerifiedMessage") || `Please check your email (${unverifiedEmail}) and click the verification link. If you didn't receive the email, you can resend it.`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleResendVerification}
                            disabled={isResendingVerification}
                            className="text-xs"
                            data-testid="button-resend-verification"
                          >
                            {isResendingVerification && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            {isResendingVerification
                              ? t("auth.sending") || "Sending..."
                              : t("auth.resendVerification") || "Resend Verification Email"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowEmailNotVerified(false);
                              setUnverifiedEmail("");
                            }}
                            className="text-xs"
                            data-testid="button-dismiss-verification"
                          >
                            {t("auth.dismiss") || "Dismiss"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('auth.name')}</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    disabled={isLoading}
                    data-testid="input-signup-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                    disabled={isLoading}
                    data-testid="input-signup-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    data-testid="input-signup-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    required
                    disabled={isLoading}
                    data-testid="input-signup-confirm-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup-submit">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? t('auth.signingUp') : t('header.signUp')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {showForgotPassword && (
            <Card className="p-6 mt-4 backdrop-blur-sm border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t('auth.resetPassword') || 'Reset Password'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail("");
                    }}
                    data-testid="button-close-forgot-password"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('auth.resetPasswordDesc') || 'Enter your email address and we will send you a link to reset your password.'}
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-password-email">{t('auth.email')}</Label>
                    <Input
                      id="forgot-password-email"
                      type="email"
                      placeholder="your@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                      disabled={isResettingPassword}
                      data-testid="input-forgot-password-email"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isResettingPassword}
                    data-testid="button-send-reset-email"
                  >
                    {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isResettingPassword 
                      ? t('auth.sending') || 'Sending...' 
                      : t('auth.sendResetLink') || 'Send Reset Link'}
                  </Button>
                </form>
              </div>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
}
