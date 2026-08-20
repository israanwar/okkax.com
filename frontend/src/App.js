import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import OkkaxChat from "@/components/OkkaxChat";
import GlobalScrollRestoration from "@/components/GlobalScrollRestoration";
import { canAccessMemberCopilot, canAccessFinanceWorkspace } from "@/lib/memberRoles";

// Route-level code-splitting for high-speed initial bundle & instant navigation
const Discover = lazy(() => import("@/pages/Discover"));
const EconomyMap = lazy(() => import("@/pages/EconomyMap"));
const PublicEvent = lazy(() => import("@/pages/PublicEvent"));
const ForPage = lazy(() => import("@/pages/ForPage"));
const Demo = lazy(() => import("@/pages/Demo"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const SubscribeCheckout = lazy(() => import("@/pages/SubscribeCheckout"));
const Login = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.ForgotPassword })));
const MyTickets = lazy(() => import("@/pages/Tickets").then((m) => ({ default: m.MyTickets })));
const MyOrders = lazy(() => import("@/pages/Tickets").then((m) => ({ default: m.MyOrders })));
const AudienceOverview = lazy(() => import("@/pages/Tickets").then((m) => ({ default: m.AudienceOverview })));
const Validator = lazy(() => import("@/pages/Tickets").then((m) => ({ default: m.Validator })));
const Overview = lazy(() => import("@/pages/Organizer").then((m) => ({ default: m.Overview })));
const EventsList = lazy(() => import("@/pages/Organizer").then((m) => ({ default: m.EventsList })));
const EventStudio = lazy(() => import("@/pages/Organizer").then((m) => ({ default: m.EventStudio })));
const EventWorkspace = lazy(() => import("@/pages/EventWorkspace"));
const SponsorPortal = lazy(() => import("@/pages/Portals").then((m) => ({ default: m.SponsorPortal })));
const TenantPortal = lazy(() => import("@/pages/Portals").then((m) => ({ default: m.TenantPortal })));
const AdminPanel = lazy(() => import("@/pages/Portals").then((m) => ({ default: m.AdminPanel })));
const OpportunitiesDealsPortal = lazy(() => import("@/pages/Portals").then((m) => ({ default: m.OpportunitiesDealsPortal })));
const MoneyMovement = lazy(() => import("@/pages/MoneyMovement"));
const RoleWorkspace = lazy(() => import("@/pages/RoleWorkspace"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentResult").then((m) => ({ default: m.PaymentSuccess })));
const PaymentCancel = lazy(() => import("@/pages/PaymentResult").then((m) => ({ default: m.PaymentCancel })));
const PresentationMode = lazy(() => import("@/pages/PresentationMode"));
const PublicCalendar = lazy(() => import("@/pages/CalendarEngine").then((m) => ({ default: m.PublicCalendar })));
const WorkspaceCalendar = lazy(() => import("@/pages/CalendarEngine").then((m) => ({ default: m.WorkspaceCalendar })));
const ControlPlane = lazy(() => import("@/pages/ControlPlane"));
const Network = lazy(() => import("@/pages/Network"));
const WorkforceJobsPage = lazy(() => import("@/pages/WorkforceJobsPage"));
const PersonalWalletPage = lazy(() => import("@/pages/PersonalWalletPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OrganizerTicketingPage = lazy(() => import("@/pages/OrganizerTicketingPage"));
const LiveOperationsPage = lazy(() => import("@/pages/LiveOperationsPage"));
const OrganizerFinancePage = lazy(() => import("@/pages/OrganizerFinancePage"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Products = lazy(() => import("@/pages/Products"));
const About = lazy(() => import("@/pages/Company").then((m) => ({ default: m.About })));
const HowItWorks = lazy(() => import("@/pages/Company").then((m) => ({ default: m.HowItWorks })));
const Contact = lazy(() => import("@/pages/Company").then((m) => ({ default: m.Contact })));
const Terms = lazy(() => import("@/pages/Company").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("@/pages/Company").then((m) => ({ default: m.Privacy })));
const IntelligencePage = lazy(() => import("@/pages/IntelligencePage"));

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center p-8 text-xs text-zinc-400 font-gemini">
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      <span>Memuat halaman…</span>
    </div>
  </div>
);

const shell = (el) => <AppShell>{el}</AppShell>;

function CopilotAccessRoute({ member = false }) {
  const { user, loading, effectiveRole } = useAuth();
  if (loading) return <RouteFallback />;
  if (user && !canAccessMemberCopilot(effectiveRole)) {
    return <Navigate to="/app" replace />;
  }
  return member ? shell(<IntelligencePage />) : <IntelligencePage />;
}

function FinanceAccessRoute() {
  const { user, loading, effectiveRole } = useAuth();
  if (loading) return <RouteFallback />;
  if (user && !canAccessFinanceWorkspace(effectiveRole)) {
    return <Navigate to="/app" replace />;
  }
  return shell(<OrganizerFinancePage />);
}

function WorkspaceOverviewRoute() {
  const { user, loading, effectiveRole } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return shell(<Overview />);
  return effectiveRole === "audience"
    ? shell(<AudienceOverview />)
    : shell(<Overview />);
}

function RouterBody() {
  const location = useLocation();
  // Detect Google OAuth callback synchronously during render, before protected routes run.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/intelligence" element={<CopilotAccessRoute />} />
        <Route path="/okkax" element={<CopilotAccessRoute />} />
        <Route path="/copilot" element={<CopilotAccessRoute />} />
        <Route path="/yoona" element={<CopilotAccessRoute />} />
        <Route path="/okkaji" element={<CopilotAccessRoute />} />
        <Route path="/peta" element={<EconomyMap />} />
        <Route path="/map" element={<EconomyMap />} />
        <Route path="/calendar" element={<PublicCalendar />} />
        <Route path="/events/:id" element={<PublicEvent />} />
        <Route path="/for/:audience" element={<ForPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/plans" element={<Pricing />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/juri" element={<Navigate to="/demo" replace />} />
        <Route path="/judges" element={<Navigate to="/demo" replace />} />
        <Route path="/present" element={<PresentationMode />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ForgotPassword />} />
        <Route path="/checkout/:eventId/:tierId" element={<Checkout />} />
        <Route path="/validator" element={shell(<Validator />)} />
        <Route path="/app" element={<WorkspaceOverviewRoute />} />
        <Route path="/app/discover" element={shell(<Discover embedded />)} />
        <Route path="/app/discover/events/:id" element={shell(<PublicEvent embedded />)} />
        <Route path="/app/checkout/:eventId/:tierId" element={shell(<Checkout embedded />)} />
        <Route path="/app/subscribe/:plan" element={shell(<SubscribeCheckout />)} />
        <Route path="/app/payment/success" element={shell(<PaymentSuccess embedded />)} />
        <Route path="/app/payment/cancel" element={shell(<PaymentCancel embedded />)} />
        <Route path="/app/intelligence" element={<Navigate to="/app/copilot" replace />} />
        <Route path="/app/okkax" element={<Navigate to="/app/copilot" replace />} />
        <Route path="/app/copilot" element={<CopilotAccessRoute member />} />
        <Route path="/app/yoona" element={<Navigate to="/app/copilot" replace />} />
        <Route path="/app/okkaji" element={<Navigate to="/app/copilot" replace />} />
        <Route path="/app/studio" element={shell(<EventStudio />)} />
        <Route path="/app/events" element={shell(<EventsList />)} />
        <Route path="/app/calendar" element={shell(<WorkspaceCalendar />)} />
        <Route path="/app/events/:eventId/:tab" element={shell(<EventWorkspace />)} />
        <Route path="/app/ticketing" element={shell(<OrganizerTicketingPage />)} />
        <Route path="/app/operations" element={shell(<LiveOperationsPage />)} />
        <Route path="/app/finance" element={<FinanceAccessRoute />} />
        <Route path="/app/tickets" element={shell(<MyTickets />)} />
        <Route path="/app/orders" element={shell(<MyOrders />)} />
        <Route path="/app/validator" element={shell(<Validator />)} />
        <Route path="/app/sponsor" element={shell(<SponsorPortal />)} />
        <Route path="/app/tenant" element={shell(<TenantPortal />)} />
        <Route path="/app/opportunities" element={shell(<OpportunitiesDealsPortal />)} />
        <Route path="/app/deals" element={shell(<OpportunitiesDealsPortal />)} />
        <Route path="/app/admin" element={shell(<AdminPanel />)} />
        <Route path="/app/admin/finance" element={shell(<MoneyMovement />)} />
        <Route path="/app/admin/control" element={shell(<ControlPlane />)} />
        <Route path="/app/me" element={shell(<RoleWorkspace />)} />
        <Route path="/app/attendance" element={shell(<RoleWorkspace />)} />
        <Route path="/app/jobs" element={shell(<WorkforceJobsPage />)} />
        <Route path="/app/wallet" element={shell(<PersonalWalletPage />)} />
        <Route path="/app/settings" element={shell(<SettingsPage />)} />
        <Route path="/app/network" element={shell(<Network />)} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="/products/:slug" element={<Products />} />
        <Route path="/products" element={<Navigate to="/products/event-studio" replace />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route
          path="*"
          element={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
              <h1 className="editorial text-4xl">404</h1>
              <p className="text-sm text-zinc-400">Halaman tidak ditemukan di OKKAX.</p>
              <a href="/" className="accent-text underline">Kembali ke beranda</a>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-black text-white relative w-full overflow-x-hidden">
      {/* Global High-Precision Architectural Dot-Matrix Canvas */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100 stitch-grid-canvas"
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(255, 255, 255, 0.18) 1.25px, transparent 1.25px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        <BrowserRouter>
          <GlobalScrollRestoration />
          <AuthProvider>
            <Toaster theme="dark" position="top-right" />
            <RouterBody />
            <OkkaxChat />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
