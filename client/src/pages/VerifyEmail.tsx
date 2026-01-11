import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage("Verification token is missing");
      return;
    }

    const verifyEmail = async () => {
      try {
        await apiRequest("POST", "/api/auth/verify-email", { token });
        setStatus("success");
        toast({
          title: t("auth.emailVerified") || "Email verified",
          description: t("auth.emailVerifiedDesc") || "Your email has been successfully verified.",
        });
      } catch (error) {
        const errorMsg = error instanceof Error
          ? error.message
          : "Failed to verify email. The link may be invalid or expired.";
        setStatus("error");
        setErrorMessage(errorMsg);
        toast({
          title: t("auth.verificationError") || "Verification failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    };

    verifyEmail();
  }, [searchParams, toast, t]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-6">
        <Card className="p-8 max-w-md w-full backdrop-blur-sm border-primary/20">
          <div className="text-center space-y-6">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
                <h1 className="text-2xl font-bold">
                  {t("auth.verifyingEmail") || "Verifying your email..."}
                </h1>
                <p className="text-muted-foreground">
                  {t("auth.verifyingEmailDesc") || "Please wait while we verify your email address."}
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                <h1 className="text-2xl font-bold">
                  {t("auth.emailVerified") || "Email Verified!"}
                </h1>
                <p className="text-muted-foreground">
                  {t("auth.emailVerifiedDesc") || "Your email has been successfully verified. You can now use all features."}
                </p>
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="w-full"
                  data-testid="button-go-to-dashboard"
                >
                  {t("auth.goToDashboard") || "Go to Dashboard"}
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive" />
                <h1 className="text-2xl font-bold">
                  {t("auth.verificationError") || "Verification Failed"}
                </h1>
                <p className="text-muted-foreground">
                  {errorMessage || t("auth.verificationErrorDesc") || "The verification link is invalid or has expired."}
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={() => setLocation("/auth")}
                    className="w-full"
                    data-testid="button-back-to-auth"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("auth.backToLogin") || "Back to Login"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

