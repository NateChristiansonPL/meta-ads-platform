import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/skills/weekly-optimization" component={WeeklyOptimization} />
      <Route path="/skills/performance-insights" component={PerformanceInsights} />
      <Route path="/skills/creative-lifecycle" component={CreativeLifecycle} />
      <Route path="/skills/structural-audit" component={StructuralAudit} />
      <Route path="/skills/audience-overlap" component={AudienceOverlap} />
      <Route path="/admin/tokens" component={AdminTokenVault} />
      <Route path="/admin/run-logs" component={AdminRunLogs} />
      <Route path="/admin/usage" component={AdminUsage} />
      <Route path="/admin/knowledge" component={AdminKnowledge} />
      <Route path="/manus-ai" component={ManusAI} />
      <Route path="/campaign-builder" component={CampaignBuilder} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
