import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setStatus("error");
      setErrorMessage("Reset token is missing");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage("Reset token is missing");
      setStatus("error");
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("auth.error") || "Error",
        description: t("auth.passwordsDoNotMatch") || "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("auth.error") || "Error",
        description: t("auth.passwordMinLength") || "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setStatus("success");
      toast({
        title: t("auth.passwordReset") || "Password reset",
        description: t("auth.passwordResetDesc") || "Your password has been successfully reset.",
      });
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : "Failed to reset password. The link may be invalid or expired.";
      setStatus("error");
      setErrorMessage(errorMsg);
      toast({
        title: t("auth.resetError") || "Reset failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-6">
        <Card className="p-8 max-w-md w-full backdrop-blur-sm border-primary/20">
          <div className="text-center space-y-6">
            {status === "form" && (
              <>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {t("auth.resetPassword") || "Reset Password"}
                </h1>
                <p className="text-muted-foreground">
                  {t("auth.resetPasswordDesc") || "Enter your new password below."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password") || "New Password"}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pr-11"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      {t("auth.confirmPassword") || "Confirm Password"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pr-11"
                        data-testid="input-confirm-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        data-testid="button-toggle-confirm-password"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading
                      ? t("auth.resetting") || "Resetting..."
                      : t("auth.resetPassword") || "Reset Password"}
                  </Button>
                </form>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                <h1 className="text-2xl font-bold">
                  {t("auth.passwordReset") || "Password Reset!"}
                </h1>
                <p className="text-muted-foreground">
                  {t("auth.passwordResetDesc") || "Your password has been successfully reset. You can now login with your new password."}
                </p>
                <Button
                  onClick={() => setLocation("/auth")}
                  className="w-full"
                  data-testid="button-go-to-login"
                >
                  {t("auth.goToLogin") || "Go to Login"}
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive" />
                <h1 className="text-2xl font-bold">
                  {t("auth.resetError") || "Reset Failed"}
                </h1>
                <p className="text-muted-foreground">
                  {errorMessage || t("auth.resetErrorDesc") || "The reset link is invalid or has expired."}
                </p>
                <Button
                  onClick={() => setLocation("/auth")}
                  className="w-full"
                  data-testid="button-back-to-auth"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("auth.backToLogin") || "Back to Login"}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

