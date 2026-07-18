import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";

import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
import Payment from "./pages/Payment";
import WalletPage from "./pages/WalletPage";
import Vehicles from "./pages/Vehicles";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import PublicTrack from "./pages/PublicTrack";

function Protected({ children, adminOnly = false }) {
  const { status, isAdmin } = useAuth();

  if (status === "loading") return <Spinner label="Loading" />;
  if (status !== "authed") return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}

function AnonOnly({ children }) {
  const { status } = useAuth();
  if (status === "loading") return <Spinner label="Loading" />;
  if (status === "authed") return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<AnonOnly><Login /></AnonOnly>} />
          <Route path="/signup" element={<AnonOnly><Signup /></AnonOnly>} />

          {/* Shared safety link — deliberately outside the auth gate. */}
          <Route path="/track/:token" element={<PublicTrack />} />

          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/trips/:rideId" element={<TripDetail />} />
            <Route path="/pay/:bookingId" element={<Payment />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/history" element={<History />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/admin"
              element={
                <Protected adminOnly>
                  <Admin />
                </Protected>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
