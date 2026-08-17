import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Discover from "@/pages/Discover";
import EconomyMap from "@/pages/EconomyMap";
import PublicEvent from "@/pages/PublicEvent";
import ForPage from "@/pages/ForPage";
import Demo from "@/pages/Demo";
import Checkout from "@/pages/Checkout";
import { Login, Register, ForgotPassword } from "@/pages/Auth";
import { MyTickets, MyOrders, Validator } from "@/pages/Tickets";
import { Overview, EventsList, EventStudio } from "@/pages/Organizer";
import EventWorkspace from "@/pages/EventWorkspace";
import { SponsorPortal, TenantPortal, AdminPanel } from "@/pages/Portals";
import MoneyMovement from "@/pages/MoneyMovement";
import AuthCallback from "@/pages/AuthCallback";
import RoleWorkspace from "@/pages/RoleWorkspace";
import { PaymentSuccess, PaymentCancel } from "@/pages/PaymentResult";
import PresentationMode from "@/pages/PresentationMode";
import { PublicCalendar, WorkspaceCalendar } from "@/pages/CalendarEngine";
import ControlPlane from "@/pages/ControlPlane";
import Network from "@/pages/Network";
import Pricing from "@/pages/Pricing";

import Products from "@/pages/Products";
import { About, HowItWorks, Contact, Terms, Privacy } from "@/pages/Company";
import YoonaPage from "@/pages/YoonaPage";
import YoonaChat from "@/components/YoonaChat";

import GlobalScrollRestoration from "@/components/GlobalScrollRestoration";
const shell = (el) => <AppShell>{el}</AppShell>;

function RouterBody() {
  const location = useLocation();
  // Detect Google OAuth callback synchronously during render, before protected routes run.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/okkax" element={<YoonaPage />} />
            <Route path="/yoona" element={<YoonaPage />} />
            <Route path="/okkaji" element={<YoonaPage />} />
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
            <Route path="/app" element={shell(<Overview />)} />
            <Route path="/app/okkax" element={shell(<YoonaPage />)} />
            <Route path="/app/yoona" element={shell(<YoonaPage />)} />
            <Route path="/app/okkaji" element={shell(<YoonaPage />)} />
            <Route path="/app/studio" element={shell(<EventStudio />)} />
            <Route path="/app/events" element={shell(<EventsList />)} />
            <Route path="/app/calendar" element={shell(<WorkspaceCalendar />)} />
            <Route path="/app/events/:eventId/:tab" element={shell(<EventWorkspace />)} />
            <Route path="/app/tickets" element={shell(<MyTickets />)} />
            <Route path="/app/orders" element={shell(<MyOrders />)} />
            <Route path="/app/validator" element={shell(<Validator />)} />
            <Route path="/app/sponsor" element={shell(<SponsorPortal />)} />
            <Route path="/app/tenant" element={shell(<TenantPortal />)} />
            <Route path="/app/admin" element={shell(<AdminPanel />)} />
            <Route path="/app/admin/finance" element={shell(<MoneyMovement />)} />
            <Route path="/app/admin/control" element={shell(<ControlPlane />)} />
            <Route path="/app/me" element={shell(<RoleWorkspace />)} />
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
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
      <GlobalScrollRestoration />
        <AuthProvider>
          <Toaster theme="dark" position="top-right" />
          <RouterBody />
          <YoonaChat />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
