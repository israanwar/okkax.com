import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Discover from "@/pages/Discover";
import PublicEvent from "@/pages/PublicEvent";
import ForPage from "@/pages/ForPage";
import GuidedDemo from "@/pages/GuidedDemo";
import Checkout from "@/pages/Checkout";
import { Login, Register, ForgotPassword } from "@/pages/Auth";
import { MyTickets, MyOrders, Validator } from "@/pages/Tickets";
import { Overview, EventsList, EventStudio } from "@/pages/Organizer";
import EventWorkspace from "@/pages/EventWorkspace";
import { SponsorPortal, TenantPortal, AdminPanel } from "@/pages/Portals";
import AuthCallback from "@/pages/AuthCallback";
import RoleWorkspace from "@/pages/RoleWorkspace";
import { PaymentSuccess, PaymentCancel } from "@/pages/PaymentResult";
import JuriDemo from "@/pages/JuriDemo";
import PresentationMode from "@/pages/PresentationMode";

const shell = (el) => <AppShell>{el}</AppShell>;

function RouterBody() {
  const location = useLocation();
  // Detect Google OAuth callback synchronously during render, before protected routes run.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/events/:id" element={<PublicEvent />} />
            <Route path="/for/:audience" element={<ForPage />} />
            <Route path="/demo" element={<GuidedDemo />} />
            <Route path="/juri" element={<JuriDemo />} />
            <Route path="/judges" element={<JuriDemo />} />
            <Route path="/present" element={<PresentationMode />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ForgotPassword />} />
            <Route path="/checkout/:eventId/:tierId" element={<Checkout />} />
            <Route path="/validator" element={shell(<Validator />)} />
            <Route path="/app" element={shell(<Overview />)} />
            <Route path="/app/studio" element={shell(<EventStudio />)} />
            <Route path="/app/events" element={shell(<EventsList />)} />
            <Route path="/app/events/:eventId/:tab" element={shell(<EventWorkspace />)} />
            <Route path="/app/tickets" element={shell(<MyTickets />)} />
            <Route path="/app/orders" element={shell(<MyOrders />)} />
            <Route path="/app/validator" element={shell(<Validator />)} />
            <Route path="/app/sponsor" element={shell(<SponsorPortal />)} />
            <Route path="/app/tenant" element={shell(<TenantPortal />)} />
            <Route path="/app/admin" element={shell(<AdminPanel />)} />
            <Route path="/app/me" element={shell(<RoleWorkspace />)} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
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
        <AuthProvider>
          <Toaster theme="dark" position="top-right" />
          <RouterBody />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
