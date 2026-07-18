import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
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
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
