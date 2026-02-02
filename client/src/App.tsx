import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/RoleGuard";
import { Loader2 } from "lucide-react";

import Sales from "@/pages/Sales";
import Production from "@/pages/Production";
import { CustomerList } from "@/features/customers/CustomerList";
import { CustomerDetail } from "@/features/customers/CustomerDetail";
import Settings from "@/pages/Settings";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import CPQCalculator from "@/features/cpq/Calculator";
import DealWorkspace from "@/pages/DealWorkspace";
import ProposalBuilder from "@/pages/ProposalBuilder";
import ClientInput from "@/pages/ClientInput";
import Trash from "@/pages/Trash";
import SiteReadinessForm from "@/pages/SiteReadinessForm";
import ProposalViewer from "@/pages/ProposalViewer";
import { ClientSignaturePage } from "@/pages/ClientSignaturePage";
import { SenderSignaturePage } from "@/pages/SenderSignaturePage";
import AuthGate from "@/pages/AuthGate";
import MissionBriefPage from "@/pages/MissionBriefPage";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import CPQLayout from "@/cpq/Layout";
import NewCPQHome from "@/cpq/pages/Home";
import NewCPQCalculator from "@/cpq/pages/Calculator";
import NewCPQAdmin from "@/cpq/pages/Admin";

function ProtectedRoutes() {
  const { user } = useAuth();

  // Production role redirect to Production page
  const userRole = (user?.role as string) || 'ceo';
  if (userRole === 'production' && window.location.pathname === '/') {
    window.location.href = '/production';
    return null;
  }

  return (
    <Switch>
      {/* Default route redirects to Sales */}
      <Route path="/">
        <RoleGuard allowedRoles={["ceo", "sales", "accounting"]} redirectTo="/production">
          <Sales />
        </RoleGuard>
      </Route>

      {/* New CPQ Module Routes */}
      <Route path="/new-cpq">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <CPQLayout>
            <NewCPQHome />
          </CPQLayout>
        </RoleGuard>
      </Route>
      <Route path="/new-cpq/calculator">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <CPQLayout>
            <NewCPQCalculator />
          </CPQLayout>
        </RoleGuard>
      </Route>
      <Route path="/new-cpq/calculator/:id">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <CPQLayout>
            <NewCPQCalculator />
          </CPQLayout>
        </RoleGuard>
      </Route>
      <Route path="/new-cpq/admin">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <CPQLayout>
            <NewCPQAdmin />
          </CPQLayout>
        </RoleGuard>
      </Route>

      {/* Sales Routes */}
      <Route path="/sales">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <Sales />
        </RoleGuard>
      </Route>
      <Route path="/customers">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <CustomerList />
        </RoleGuard>
      </Route>
      <Route path="/customers/:id">
        <CustomerDetail />
      </Route>
      <Route path="/sales/trash">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <Trash />
        </RoleGuard>
      </Route>
      <Route path="/sales/calculator">
        <RoleGuard allowedRoles={["ceo", "sales"]}>
          <div className="h-screen bg-background">
            <CPQCalculator onClose={() => window.history.back()} />
          </div>
        </RoleGuard>
      </Route>
      <Route path="/sales/calculator/:leadId">
        {(params) => (
          <RoleGuard allowedRoles={["ceo", "sales"]}>
            <div className="h-screen bg-background">
              <CPQCalculator leadId={parseInt(params.leadId)} onClose={() => window.history.back()} />
            </div>
          </RoleGuard>
        )}
      </Route>
      <Route path="/deals/:id">
        {() => (
          <RoleGuard allowedRoles={["ceo", "sales"]}>
            <DealWorkspace />
          </RoleGuard>
        )}
      </Route>
      <Route path="/deals/:leadId/proposal">
        {() => (
          <RoleGuard allowedRoles={["ceo", "sales"]}>
            <ProposalBuilder />
          </RoleGuard>
        )}
      </Route>

      {/* Production Routes */}
      <Route path="/production">
        <RoleGuard allowedRoles={["ceo", "production"]}>
          <Production />
        </RoleGuard>
      </Route>
      <Route path="/projects/:id/mission-brief">
        {(params) => (
          <RoleGuard allowedRoles={["ceo", "production"]}>
            <MissionBriefPage />
          </RoleGuard>
        )}
      </Route>

      {/* Settings */}
      <Route path="/settings" component={Settings} />

      {/* Auth */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const path = window.location.pathname;

  if (path === "/privacy") {
    return <PrivacyPolicy />;
  }
  if (path === "/terms") {
    return <TermsOfService />;
  }
  if (path.startsWith("/client-input/")) {
    return <ClientInput />;
  }
  if (path.startsWith("/site-readiness/")) {
    return <SiteReadinessForm />;
  }
  if (path.startsWith("/proposals/")) {
    return <ProposalViewer />;
  }
  if (path.startsWith("/sign/")) {
    return <ClientSignaturePage />;
  }
  if (path.startsWith("/sender-sign/")) {
    return <SenderSignaturePage />;
  }

  return (
    <AuthGate>
      <ProtectedRoutes />
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
        <NetworkStatusIndicator />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
