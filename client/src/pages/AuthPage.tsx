import { Button } from "@/components/ui/button";
import { ScanLine, ArrowRight } from "lucide-react";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-card/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/30 shadow-lg shadow-primary/20">
            <ScanLine className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-3xl font-display font-bold mb-1">Scan2Plan-OS</h1>
          <p className="text-lg font-medium text-primary mb-2">CEO HUB</p>
          <p className="text-muted-foreground mb-8">
            The central command hub for laser scanning & BIM operations.
          </p>

          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full font-bold bg-white text-black hover:bg-gray-200"
              onClick={() => window.location.href = "/api/login"}
            >
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground">
              Secure enterprise authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
