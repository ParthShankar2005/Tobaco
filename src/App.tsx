import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import NotFound from "./pages/NotFound";
import RoleLoginPage from "./pages/RoleLoginPage";
import PortalEntryPage from "./pages/PortalEntryPage";
import { RequireRole, RoleAuthProvider } from "@/auth/roleAuth";
import { TobacoProvider } from "../state";
import TobacoLayout from "../TobacoLayout";
import DistributorPanel from "../Distributor/DistributorPanel";
import ShopkeeperPanel from "../Shopkeeper/ShopkeeperPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RoleAuthProvider>
          <TobacoProvider>
            <Routes>
              <Route path="/" element={<PortalEntryPage />} />
              <Route path="/distributor-login" element={<Navigate to="/admin-login" replace />} />
              <Route path="/distributer-login" element={<Navigate to="/admin-login" replace />} />
              <Route path="/admin-login" element={<RoleLoginPage role="admin" />} />
              <Route path="/shopkeeper-login" element={<RoleLoginPage role="shopkeeper" />} />

              <Route element={<RequireRole allowedRoles={["admin"]} />}>
                <Route element={<TobacoLayout />}>
                  <Route path="/distributor" element={<Navigate to="/distributor/dashboard" replace />} />
                  <Route path="/distributor/:section" element={<DistributorPanel />} />
                </Route>
              </Route>

              <Route element={<RequireRole allowedRoles={["shopkeeper"]} />}>
                <Route element={<TobacoLayout />}>
                  <Route path="/shopkeeper" element={<Navigate to="/shopkeeper/items" replace />} />
                  <Route path="/shopkeeper/:section" element={<ShopkeeperPanel />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </TobacoProvider>
        </RoleAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
