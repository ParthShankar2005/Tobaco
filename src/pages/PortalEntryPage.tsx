import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, ChartNoAxesCombined, PackageSearch, ReceiptText, UsersRound } from "lucide-react";

const distributorFeatures = [
  "Manage item catalog with image, item number, MRP/SRP, MOQ and offers.",
  "Create and manage shopkeeper users, shop contacts and shop-wise pricing.",
  "Review pending orders, accept/reject, and download printable bill copies.",
  "Track sales trend, order sheets, heat map and payment verification status.",
];

const shopkeeperFeatures = [
  "View only distributor-approved items with photos and your custom shop pricing.",
  "Create cash or online orders quickly and send directly to distributor panel.",
  "Track order status (pending/accepted/cancelled) with bill download history.",
  "Use search-first ordering flow for faster item selection and repeat ordering.",
];

const PortalEntryPage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10 lg:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader className="gradient-burgundy rounded-t-xl text-primary-foreground">
            <CardTitle className="text-3xl lg:text-4xl">TOBACO Distribution Portal</CardTitle>
            <CardDescription className="text-primary-foreground/85">
              One system for distributor operations and shopkeeper ordering workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Multi-shop pricing
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Order + bill tracking
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Cash + online modes
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Distributor approval flow
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-primary/20">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl">Distributor</CardTitle>
                  <CardDescription>Admin panel for complete distribution control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {distributorFeatures.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="burgundy" className="w-full">
                    <Link to="/distributor-login">Open Distributor Login</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl">Shopkeeper</CardTitle>
                  <CardDescription>Fast order panel for daily purchasing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {shopkeeperFeatures.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="gold" className="w-full">
                    <Link to="/shopkeeper-login">Open Shopkeeper Login</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-xl">How The System Works</CardTitle>
                  <CardDescription>Standard workflow from item setup to delivery bill.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <PackageSearch className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Distributor adds items, sets prices/offers, and creates shopkeeper accounts.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Shopkeeper creates orders (cash/online) and sends directly to distributor queue.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ReceiptText className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Distributor accepts/rejects, verifies payment, then downloads/prints bill for parcel dispatch.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChartNoAxesCombined className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Both sides can track order history and trends for better daily planning.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-xl">Quick Access & Notes</CardTitle>
                  <CardDescription>Use these routes directly when needed.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="font-semibold text-foreground">Portal Home</div>
                    <Link to="/" className="text-primary underline underline-offset-2">
                      /
                    </Link>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="font-semibold text-foreground">Distributor Login</div>
                    <Link to="/distributor-login" className="text-primary underline underline-offset-2">
                      /distributor-login
                    </Link>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="font-semibold text-foreground">Shopkeeper Login</div>
                    <Link to="/shopkeeper-login" className="text-primary underline underline-offset-2">
                      /shopkeeper-login
                    </Link>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                    <UsersRound className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      Shopkeeper login works only after distributor creates and maps the user to a shop contact.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PortalEntryPage;
