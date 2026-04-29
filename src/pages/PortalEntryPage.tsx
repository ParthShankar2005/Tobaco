import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PortalEntryPage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader className="gradient-burgundy rounded-t-xl text-primary-foreground">
            <CardTitle className="text-3xl">TOBACO Portal</CardTitle>
            <CardDescription className="text-primary-foreground/85">
              Choose your login panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">Distributor</CardTitle>
                <CardDescription>Admin dashboard for items, users, shops, orders and bills.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="burgundy" className="w-full">
                  <Link to="/admin-login">Open Distributor Login</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">Shopkeeper</CardTitle>
                <CardDescription>Order creation panel and order/bill tracking.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="gold" className="w-full">
                  <Link to="/shopkeeper-login">Open Shopkeeper Login</Link>
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PortalEntryPage;
