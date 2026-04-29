import { useEffect, useMemo, useState } from "react";
import { useTobaco } from "../state";
import { useRoleAuth } from "@/auth/roleAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Download, FileText, MessageCircle } from "lucide-react";
import { downloadBillHtml, openBillPrintWindow } from "@/lib/bill";

const statusClassMap: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
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

const normalizedWhatsAppNumber = (mobile: string) => {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const OrderDeskPanel = () => {
  const { getDistributorProfile, shopkeeperAccounts } = useRoleAuth();
  const { orders, shops, updateOrderStatus } = useTobaco();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const distributorProfile = useMemo(() => getDistributorProfile(), [getDistributorProfile]);

  useEffect(() => {
    if (orders.length === 0) return;
    if (!orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId),
    [orders, selectedOrderId],
  );

  const whatsappUrl = useMemo(() => {
    if (!selectedOrder) return "";
    const targetNumber = normalizedWhatsAppNumber(selectedOrder.mobile);
    if (!targetNumber) return "";

    const itemLines = selectedOrder.items
      .map((item) => `- ${item.productName} (${item.packSize}) x${item.quantity} = INR ${item.lineTotal}`)
      .join("\n");
    const message =
      `TOBACO Order Update\n` +
      `Order ID: ${selectedOrder.id}\n` +
      `Shop: ${selectedOrder.shopName}\n` +
      `Status: ${selectedOrder.status.toUpperCase()}\n` +
      `Total: INR ${selectedOrder.subtotal}\n` +
      `Items:\n${itemLines}\n\n` +
      `Thank you for ordering.`;

    return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
  }, [selectedOrder]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5" />
            Order Check, Bill View, and WhatsApp Confirmation
          </CardTitle>
          <CardDescription className="text-primary-foreground/85">
            Review item list, approve orders, and pass confirmation messages on WhatsApp.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders available yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={selectedOrderId === order.id ? "bg-muted" : ""}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <TableCell className="font-semibold">
                        {order.id}
                        <div className="text-xs font-normal text-muted-foreground">{formatDateTime(order.createdAt)}</div>
                      </TableCell>
                      <TableCell>{order.shopName}</TableCell>
                      <TableCell>₹{order.subtotal}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClassMap[order.status]}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bill and Item List</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedOrder ? (
              <p className="text-sm text-muted-foreground">Select an order to view bill details.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order ID:</span> <span className="font-semibold">{selectedOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shop:</span> {selectedOrder.shopName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner:</span> {selectedOrder.ownerName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mobile:</span> {selectedOrder.mobile}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment:</span> {selectedOrder.paymentMethod}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span> {formatDateTime(selectedOrder.createdAt)}
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Item No.</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <img
                            src={item.image || "/placeholder.svg"}
                            alt={item.productName}
                            className="h-12 w-12 rounded-md border object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{item.itemNumber || "-"}</TableCell>
                        <TableCell>
                          <div className="font-semibold">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.packSize}</div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.unitPrice}</TableCell>
                        <TableCell>₹{item.lineTotal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="text-right text-lg font-bold text-primary">Bill Total: ₹{selectedOrder.subtotal}</div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const account = shopkeeperAccounts.find((item) => item.shopId === selectedOrder.shopId);
                      const shop = shops.find((item) => item.id === selectedOrder.shopId);
                      const opened = openBillPrintWindow(selectedOrder, distributorProfile, {
                        includeGst: account?.useGstBill ?? true,
                        shopAddress: shop?.address ?? "",
                      });
                      if (!opened) return;
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Print Bill
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const account = shopkeeperAccounts.find((item) => item.shopId === selectedOrder.shopId);
                      const shop = shops.find((item) => item.id === selectedOrder.shopId);
                      downloadBillHtml(selectedOrder, distributorProfile, {
                        includeGst: account?.useGstBill ?? true,
                        shopAddress: shop?.address ?? "",
                      });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Bill
                  </Button>
                  {selectedOrder.status === "pending" && (
                    <Button variant="gold" onClick={() => updateOrderStatus(selectedOrder.id, "accepted")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Accept Order
                    </Button>
                  )}
                  {selectedOrder.status === "accepted" && whatsappUrl ? (
                    <Button variant="burgundy" asChild>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Send WhatsApp Confirmation
                      </a>
                    </Button>
                  ) : selectedOrder.status === "pending" ? (
                    <Button variant="outline" disabled>
                      Accept Order to Enable WhatsApp
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      WhatsApp Confirmation Unavailable
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderDeskPanel;
