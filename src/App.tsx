/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthPage from "@/pages/AuthPage";
import Studio from "@/pages/Studio";
import PublicSite from "@/pages/PublicSite";

function Protected({ children }: { children: React.ReactNode }) {
  const auth = useAuth() as any;
  const user = auth?.user;
  if (user === null || user === undefined)
    return (
      <div className="auth-loading" data-testid="auth-loading">
        <div className="auth-spinner" />
      </div>
    );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/site/:slug" element={<PublicSite />} />
          <Route
            path="/"
            element={
              <Protected>
                <Studio />
              </Protected>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors toastOptions={{ style: { fontFamily: "Inter, sans-serif" } }} />
    </AuthProvider>
  );
}
