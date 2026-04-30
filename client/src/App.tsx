import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WeeklyOptimization from "./pages/WeeklyOptimization";
import PerformanceInsights from "./pages/PerformanceInsights";
import CreativeLifecycle from "./pages/CreativeLifecycle";
import StructuralAudit from "./pages/StructuralAudit";
import AudienceOverlap from "./pages/AudienceOverlap";
import AdminTokenVault from "./pages/AdminTokenVault";
import AdminRunLogs from "./pages/AdminRunLogs";
import AdminUsage from "./pages/AdminUsage";
import AdminKnowledge from "./pages/AdminKnowledge";
import ManusAI from "./pages/ManusAI";
import CampaignBuilder from "./pages/CampaignBuilder";
import KnowledgeBase from "./pages/KnowledgeBase";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

// Skill paths that should stay mounted (keep-alive) to preserve active run state
const SKILL_PATHS = [
  "/skills/weekly-optimization",
  "/skills/performance-insights",
  "/skills/creative-lifecycle",
  "/skills/structural-audit",
  "/skills/audience-overlap",
];

/**
 * AdminRoute — wraps a page component and redirects non-admins to /dashboard.
 * Shows nothing while auth is still loading to avoid a flash.
 */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      navigate("/dashboard");
    }
  }, [loading, user, navigate]);

  // While loading, or if not admin, render nothing (redirect is in-flight)
  if (loading || user?.role !== "admin") return null;

  return <Component />;
}

/**
 * KeepAliveSkillPages renders all five skill pages at once but hides the
 * inactive ones with display:none. This preserves component state (active
 * polls, run output) when the user navigates between skills or to other pages.
 */
function KeepAliveSkillPages() {
  const [location] = useLocation();
  return (
    <>
      <div style={{ display: location === "/skills/weekly-optimization" ? undefined : "none" }}>
        <WeeklyOptimization />
      </div>
      <div style={{ display: location === "/skills/performance-insights" ? undefined : "none" }}>
        <PerformanceInsights />
      </div>
      <div style={{ display: location === "/skills/creative-lifecycle" ? undefined : "none" }}>
        <CreativeLifecycle />
      </div>
      <div style={{ display: location === "/skills/structural-audit" ? undefined : "none" }}>
        <StructuralAudit />
      </div>
      <div style={{ display: location === "/skills/audience-overlap" ? undefined : "none" }}>
        <AudienceOverlap />
      </div>
    </>
  );
}

function Router() {
  const [location] = useLocation();
  const isSkillPage = SKILL_PATHS.some((p) => location === p);

  return (
    <>
      {/* Keep-alive skill pages — always mounted, hidden when not active */}
      <div style={{ display: isSkillPage ? undefined : "none" }}>
        <KeepAliveSkillPages />
      </div>

      {/* Normal routed pages — only render the active one */}
      {!isSkillPage && (
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          {/* Admin-only routes — AdminRoute redirects non-admins to /dashboard */}
          <Route path="/admin/tokens">
            <AdminRoute component={AdminTokenVault} />
          </Route>
          <Route path="/admin/run-logs">
            <AdminRoute component={AdminRunLogs} />
          </Route>
          <Route path="/admin/usage">
            <AdminRoute component={AdminUsage} />
          </Route>
          <Route path="/admin/knowledge">
            <AdminRoute component={AdminKnowledge} />
          </Route>
          {/* Regular authenticated routes */}
          <Route path="/manus-ai" component={ManusAI} />
          <Route path="/campaign-builder" component={CampaignBuilder} />
          <Route path="/knowledge" component={KnowledgeBase} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
