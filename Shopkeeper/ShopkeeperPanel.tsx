import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRoleAuth } from "@/auth/roleAuth";
import { useTobaco } from "../state";
import { PaymentMethod } from "../types";
import { downloadBillHtml } from "@/lib/bill";
import { createRazorpayOrder, loadRazorpayCheckout, openRazorpayCheckout, razorpayKeyId } from "@/lib/razorpay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type ShopkeeperSection = "dashboard" | "orders" | "bills" | "sheets";
const validSections: ShopkeeperSection[] = ["dashboard", "orders", "bills", "sheets"];

const statusClassMap: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const paymentStatusClassMap: Record<string, string> = {
  cash: "bg-slate-100 text-slate-800",
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const TREND_DAYS = 7;
const BILL_RETENTION_DAYS = 28;
const formatDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const formatTrendLabel = (value: Date) =>
  value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
const compactInr = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};
const isWithinRecentDays = (dateValue: string, days: number, now = new Date()) => {
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) return false;
  const cutoff = startOfDay(now);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return timestamp >= cutoff.getTime();
};

const ShopkeeperPanel = () => {
  const { section: rawSection } = useParams();
  const section = (rawSection ?? "dashboard") as ShopkeeperSection;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, getDistributorProfile, getShopkeeperAccount } = useRoleAuth();
  const { products, shops, orders, createOrder, resolvePrice, getRuleForShopProduct, updateOrderStatus } = useTobaco();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isRazorpayLoading, setIsRazorpayLoading] = useState(false);
  const [note, setNote] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  const assignedShop = useMemo(
    () => shops.find((shop) => shop.id === session?.shopId),
    [shops, session?.shopId],
  );

  const pricedProducts = useMemo(() => {
    if (!assignedShop) return [];
    return products.map((product) => {
      const price = resolvePrice(assignedShop.id, product.id, product.srp);
      const rule = getRuleForShopProduct(assignedShop.id, product.id);
      return { ...product, finalPrice: price, offerText: rule?.offerText ?? "" };
    });
  }, [assignedShop, products, getRuleForShopProduct, resolvePrice]);

  const runningTotal = useMemo(
    () =>
      pricedProducts.reduce((sum, product) => {
        const quantity = quantities[product.id] ?? 0;
        return sum + product.finalPrice * quantity;
      }, 0),
    [pricedProducts, quantities],
  );

  const filteredPricedProducts = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    const sorted = [...pricedProducts].sort((a, b) => Number(a.itemNumber) - Number(b.itemNumber));
    if (!query) return sorted;
    return sorted.filter(
      (product) =>
        product.itemNumber.toLowerCase().includes(query) || product.name.toLowerCase().includes(query),
    );
  }, [itemSearchQuery, pricedProducts]);

  const selectedShopOrders = useMemo(() => {
    if (!assignedShop) return [];
    return orders.filter((order) => order.shopId === assignedShop.id);
  }, [orders, assignedShop]);

  const purchaseTrend = useMemo(() => {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; amount: number }> = [];
    const indexByKey = new Map<string, number>();

    for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(now.getDate() - offset);
      const key = formatDateKey(day);
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: formatTrendLabel(day),
        amount: 0,
      });
    }

    for (const order of selectedShopOrders) {
      if (order.status !== "accepted") continue;
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) continue;
      const key = formatDateKey(createdAt);
      const targetIndex = indexByKey.get(key);
      if (targetIndex === undefined) continue;
      buckets[targetIndex].amount += Number(order.subtotal) || 0;
    }

    return buckets.map((item) => ({
      label: item.label,
      amount: Number(item.amount.toFixed(2)),
    }));
  }, [selectedShopOrders]);

  const shopStats = useMemo(() => {
    const accepted = selectedShopOrders.filter((order) => order.status === "accepted");
    const pending = selectedShopOrders.filter((order) => order.status === "pending");
    const rejected = selectedShopOrders.filter((order) => order.status === "rejected");
    return {
      totalOrders: selectedShopOrders.length,
      acceptedOrders: accepted.length,
      pendingOrders: pending.length,
      rejectedOrders: rejected.length,
      acceptedAmount: accepted.reduce((sum, order) => sum + order.subtotal, 0),
    };
  }, [selectedShopOrders]);

  const visibleBills = useMemo(
    () =>
      selectedShopOrders.filter(
        (order) =>
          order.status === "accepted" &&
          !order.billDeletedAt &&
          isWithinRecentDays(order.createdAt, BILL_RETENTION_DAYS),
      ),
    [selectedShopOrders],
  );

  const orderSheetRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        dateKey: string;
        dateLabel: string;
        orderCount: number;
        acceptedCount: number;
        pendingCount: number;
        cancelledCount: number;
        qty: number;
        orderAmount: number;
      }
    >();

    for (const order of selectedShopOrders) {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const dateKey = formatDateKey(date);
      const dateLabel = formatDateTime(order.createdAt).split(",")[0];
      const existing = rows.get(dateKey) ?? {
        dateKey,
        dateLabel,
        orderCount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        qty: 0,
        orderAmount: 0,
      };

      existing.orderCount += 1;
      if (order.status === "accepted") existing.acceptedCount += 1;
      if (order.status === "pending") existing.pendingCount += 1;
      if (order.status === "rejected") existing.cancelledCount += 1;
      existing.qty += order.items.reduce((sum, item) => sum + item.quantity, 0);
      existing.orderAmount += Number(order.subtotal) || 0;
      rows.set(dateKey, existing);
    }

    return Array.from(rows.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [selectedShopOrders]);

  const distributorProfile = useMemo(() => getDistributorProfile(), [getDistributorProfile]);
  const currentShopkeeperAccount = useMemo(
    () => getShopkeeperAccount(session?.username ?? ""),
    [getShopkeeperAccount, session?.username],
  );

  const handleCreateOrder = async () => {
    if (!assignedShop) {
      toast({
        title: "Shop mapping missing",
        description: "Ask distributor to map your login with a shop contact.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "online") {
      if (!razorpayKeyId) {
        toast({
          title: "Razorpay not configured",
          description: "Set VITE_RAZORPAY_KEY_ID and VITE_RAZORPAY_ORDER_ENDPOINT.",
          variant: "destructive",
        });
        return;
      }
      if (runningTotal <= 0) {
        toast({
          title: "Amount missing",
          description: "Add item quantities to generate payable amount.",
          variant: "destructive",
        });
        return;
      }

      const amountInPaise = Math.round(runningTotal * 100);
      setIsRazorpayLoading(true);
      try {
        const checkoutLoaded = await loadRazorpayCheckout();
        if (!checkoutLoaded) {
          toast({
            title: "Razorpay unavailable",
            description: "Unable to load Razorpay Checkout.",
            variant: "destructive",
          });
          return;
        }

        const orderSeed = await createRazorpayOrder({
          amountInPaise,
          receipt: `shop-${Date.now()}`,
          notes: {
            shop_id: assignedShop.id,
            shop_name: assignedShop.shopName,
          },
        });

        const opened = openRazorpayCheckout({
          orderId: orderSeed.orderId,
          amountInPaise,
          name: distributorProfile.businessName || "TOBACO",
          description: `Order payment for ${assignedShop.shopName}`,
          image: distributorProfile.logoDataUrl || undefined,
          prefill: {
            name: assignedShop.ownerName,
            contact: assignedShop.mobile,
            email: distributorProfile.email || undefined,
          },
          notes: {
            shop_id: assignedShop.id,
            order_amount: String(runningTotal),
          },
          onSuccess: async (response) => {
            const result = await createOrder({
              shopId: assignedShop.id,
              quantities,
              paymentMethod: "online",
              note,
              onlinePaymentReference: response.razorpay_payment_id,
              onlinePaymentNote: `RZP Order: ${response.razorpay_order_id} | Signature: ${response.razorpay_signature}`,
            });

            if (!result.ok) {
              toast({
                title: "Order save failed",
                description: result.message,
                variant: "destructive",
              });
              return;
            }

            setQuantities({});
            setNote("");
            navigate("/shopkeeper/orders");
            toast({
              title: "Payment and order success",
              description: `${result.order?.id} sent to distributor panel.`,
            });
          },
          onFailure: (message) => {
            toast({
              title: "Payment failed",
              description: message,
              variant: "destructive",
            });
          },
        });

        if (!opened) {
          toast({
            title: "Unable to open checkout",
            description: "Razorpay checkout was blocked. Allow popups and try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start Razorpay payment.";
        toast({
          title: "Razorpay error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsRazorpayLoading(false);
      }
      return;
    }

    const result = await createOrder({
      shopId: assignedShop.id,
      quantities,
      paymentMethod,
      note,
    });

    if (!result.ok) {
      toast({
        title: "Order failed",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    setQuantities({});
    setNote("");
    navigate("/shopkeeper/orders");
    toast({
      title: "Order created",
      description: `${result.order?.id} sent to distributor panel.`,
    });
  };

  const handleDownloadBill = (orderId: string) => {
    const target = selectedShopOrders.find((order) => order.id === orderId);
    if (!target) return;
    downloadBillHtml(target, distributorProfile, {
      includeGst: currentShopkeeperAccount?.useGstBill ?? true,
      shopAddress: assignedShop.address,
    });
  };

  if (!assignedShop) {
    return (
      <Card>
        <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
          <CardTitle>Shopkeeper Access</CardTitle>
          <CardDescription className="text-primary-foreground/85">
            Your login is valid, but no shop is assigned yet by distributor.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Contact distributor admin to create your shop mapping and login ID.
        </CardContent>
      </Card>
    );
  }

  if (rawSection === "order" || rawSection === "items") return <Navigate to="/shopkeeper/orders" replace />;
  if (rawSection === "bill") return <Navigate to="/shopkeeper/bills" replace />;
  if (rawSection === "sheet") return <Navigate to="/shopkeeper/sheets" replace />;
  if (!validSections.includes(section)) return <Navigate to="/shopkeeper/dashboard" replace />;

  return (
    <div className="space-y-6">
      {section === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create Order</CardTitle>
            <CardDescription>
              Distributor offers and custom rates for your shop are applied automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md">
              <Label htmlFor="shopItemSearch">Search Item (Number / Name)</Label>
              <Input
                id="shopItemSearch"
                value={itemSearchQuery}
                onChange={(event) => setItemSearchQuery(event.target.value)}
                placeholder="Ex: 1212 or classic"
              />
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-semibold">{assignedShop.shopName}</div>
              <div className="text-xs text-muted-foreground">
                {assignedShop.ownerName} | {assignedShop.area}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPricedProducts.map((product) => (
                <article
                  key={product.id}
                  className="group relative overflow-hidden rounded-xl border bg-card p-3 shadow-card transition-transform duration-300 hover:scale-[0.98]"
                >
                  <div className="relative h-36 overflow-hidden rounded-lg border bg-muted/30">
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                      #{product.itemNumber}
                    </div>
                    <div className="absolute bottom-2 right-2 rounded-full bg-background/85 p-1.5 text-primary transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.description}</p>
                    <div className="text-xs text-muted-foreground">
                      Pack: {product.packSize} | MOQ: {product.moq}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Base SRP: ₹{product.srp} | Offer: {product.offerText || "-"}
                    </div>
                    <div className="text-sm font-bold text-primary">Your Price: ₹{product.finalPrice}</div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={quantities[product.id] ?? 0}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [product.id]: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="orderNote">Order Note (optional)</Label>
                <Textarea
                  id="orderNote"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Write delivery note or special request"
                  rows={2}
                />
              </div>
              <div className="space-y-3 lg:min-w-[260px]">
                <div className="text-sm text-muted-foreground">
                  Final order total: <span className="font-bold text-primary">₹{runningTotal}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === "cash" ? "gold" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    Cash
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "online" ? "gold" : "outline"}
                    onClick={() => setPaymentMethod("online")}
                  >
                    Online
                  </Button>
                </div>
                {paymentMethod === "online" && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      On Create Order, you will be redirected to Razorpay payment page directly.
                    </p>
                  </div>
                )}
                <Button
                  variant="gold"
                  size="lg"
                  onClick={() => void handleCreateOrder()}
                  className="w-full"
                  disabled={isRazorpayLoading}
                >
                  {paymentMethod === "online" && isRazorpayLoading ? "Opening Razorpay..." : "Create Order"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {section === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Order Status</CardTitle>
            <CardDescription>Track pending/accepted/cancelled orders and payment verification.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedShopOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet for your shop.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Verify</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedShopOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">{order.id}</TableCell>
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>{order.items.length}</TableCell>
                      <TableCell>₹{order.subtotal}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClassMap[order.status]}`}>
                          {order.status === "rejected" ? "CANCELLED" : order.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium uppercase">{order.paymentMethod}</div>
                        {order.paymentMethod === "online" && order.onlinePaymentReference ? (
                          <div className="text-[11px] text-muted-foreground">{order.onlinePaymentReference}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentStatusClassMap[order.paymentVerificationStatus] ?? "bg-slate-100 text-slate-800"}`}
                        >
                          {order.paymentVerificationStatus.toUpperCase()}
                        </span>
                        {order.paymentVerificationNote ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">{order.paymentVerificationNote}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {order.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOrderStatus(order.id, "rejected", "shopkeeper")}
                          >
                            Cancel
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {section === "dashboard" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Store className="h-5 w-5 text-primary" />
              Shop Dashboard
            </CardTitle>
            <CardDescription>Quick summary of your orders and accepted purchase trend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total Orders</div><div className="text-xl font-bold">{shopStats.totalOrders}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pending</div><div className="text-xl font-bold text-amber-700">{shopStats.pendingOrders}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Accepted</div><div className="text-xl font-bold text-emerald-700">{shopStats.acceptedOrders}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Cancelled</div><div className="text-xl font-bold text-red-700">{shopStats.rejectedOrders}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Accepted INR</div><div className="text-xl font-bold text-primary">₹{shopStats.acceptedAmount}</div></div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">Purchased Trend (INR / Day)</div>
              <div className="text-xs text-muted-foreground">Accepted purchases for the last 7 days.</div>
              {purchaseTrend.some((entry) => entry.amount > 0) ? (
                <ChartContainer
                  config={{ amount: { label: "Purchased", color: "hsl(var(--accent))" } }}
                  className="mt-3 h-[220px] w-full"
                >
                  <BarChart data={purchaseTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${compactInr.format(Number(value) || 0)}`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Date: ${value}`}
                          formatter={(value) => <span className="font-semibold">₹{Number(value).toLocaleString("en-IN")}</span>}
                        />
                      }
                    />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No accepted purchase data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {section === "bills" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bills</CardTitle>
            <CardDescription>
              Accepted bills from last {BILL_RETENTION_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bills in the last {BILL_RETENTION_DAYS} days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBills.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">{order.id}</TableCell>
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>₹{order.subtotal}</TableCell>
                      <TableCell className="uppercase">{order.paymentMethod}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadBill(order.id)}>
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {section === "sheets" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Order Sheets</CardTitle>
            <CardDescription>Daily order summary for your shop.</CardDescription>
          </CardHeader>
          <CardContent>
            {orderSheetRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet for your shop.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Cancelled</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Order INR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderSheetRows.map((row) => (
                    <TableRow key={row.dateKey}>
                      <TableCell className="font-semibold">{row.dateLabel}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell>{row.acceptedCount}</TableCell>
                      <TableCell>{row.pendingCount}</TableCell>
                      <TableCell>{row.cancelledCount}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>₹{row.orderAmount.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShopkeeperPanel;
