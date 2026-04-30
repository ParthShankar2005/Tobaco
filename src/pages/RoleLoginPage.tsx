import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AuthRole, getDefaultRouteForRole, useRoleAuth } from "@/auth/roleAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RoleLoginPageProps {
  role: AuthRole;
}

const roleConfig: Record<AuthRole, { title: string; description: string; hint: string }> = {
  admin: {
    title: "Distributor Login",
    description: "Shared login for distributor admin panel.",
    hint: "Demo credentials: distributor / dist@123",
  },
  shopkeeper: {
    title: "Shopkeeper Login",
    description: "Separate access for shopkeeper order creator panel.",
    hint: "Use ID created by distributor admin. Default demo: shopkeeper / shop@123",
  },
};

const RoleLoginPage = ({ role }: RoleLoginPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login, logout, session, shopkeeperAccounts, getAdminLoginCredential } = useRoleAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!session || session.role === role) return;
    // Prevent cross-role back/forward redirect issues by clearing previous role session.
    logout();
  }, [session, role, logout]);

  if (session && session.role === role) return <Navigate to={getDefaultRouteForRole(session.role)} replace />;

  if (session && session.role !== role) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
              <CardTitle className="text-2xl">Switching Session</CardTitle>
              <CardDescription className="text-primary-foreground/85">
                Closing current session and opening requested login panel.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const devCredential = useMemo(() => {
    if (role === "admin") {
      return getAdminLoginCredential();
    }
    const activeShopkeeper = shopkeeperAccounts.find((item) => item.active);
    if (!activeShopkeeper) return null;
    return { username: activeShopkeeper.username, password: activeShopkeeper.password };
  }, [role, shopkeeperAccounts, getAdminLoginCredential]);

  const doLogin = (user: string, pass: string) => {
    const result = login(role, user, pass);

    if (!result.ok) {
      toast({
        title: "Login failed",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    const state = location.state as { from?: string } | null;
    const next = state?.from ?? getDefaultRouteForRole(role);
    toast({
      title: "Login success",
      description: "Access granted.",
    });
    navigate(next, { replace: true });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    doLogin(username, password);
  };

  const handleFillDev = () => {
    if (!devCredential) {
      toast({
        title: "No shopkeeper ID",
        description: "Distributor must create at least one active shopkeeper ID first.",
        variant: "destructive",
      });
      return;
    }
    setUsername(devCredential.username);
    setPassword(devCredential.password);
    toast({
      title: "Credentials filled",
      description: "Dev ID and password added.",
    });
  };

  const handleQuickLogin = () => {
    if (!devCredential) {
      toast({
        title: "No shopkeeper ID",
        description: "Distributor must create at least one active shopkeeper ID first.",
        variant: "destructive",
      });
      return;
    }
    doLogin(devCredential.username, devCredential.password);
  };

  const config = roleConfig[role];

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
            <CardTitle className="text-2xl">{config.title}</CardTitle>
            <CardDescription className="text-primary-foreground/85">{config.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <Button type="submit" className="w-full" variant="gold">
                Login
              </Button>
            </form>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={handleFillDev}>
                Fill Dev ID/Password
              </Button>
              <Button type="button" variant="burgundy" onClick={handleQuickLogin}>
                Quick Login
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{config.hint}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoleLoginPage;
