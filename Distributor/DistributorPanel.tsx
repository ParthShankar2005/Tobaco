import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useRoleAuth } from "@/auth/roleAuth";
import { useTobaco } from "../state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { downloadBillHtml, openBillPrintWindow } from "@/lib/bill";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type DistributorSection = "dashboard" | "items" | "users" | "shops" | "orders" | "bills" | "sheets";

const validSections: DistributorSection[] = ["dashboard", "items", "users", "shops", "orders", "bills", "sheets"];

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

const ITEM_NUMBER_START = 1;
const ITEM_NUMBER_MAX = 9999;
const TREND_DAYS = 7;
const HEATMAP_DAYS = 30;

const formatDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const formatTrendLabel = (value: Date) =>
  value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const formatHeatmapLabel = (value: Date) =>
  value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const compactInr = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
type DeleteTarget = { type: "item" | "shop"; id: string; label: string } | null;

const DistributorPanel = () => {
  const { section: rawSection } = useParams();
  const section = (rawSection ?? "dashboard") as DistributorSection;
  const { toast } = useToast();
  const {
    shopkeeperAccounts,
    createShopkeeperLogin,
    getProfileForUser,
    resetShopkeeperPassword,
    updateShopkeeperAccount,
    deleteShopkeeperAccount,
    getDistributorProfile,
    verifyAdminAccessKey,
  } = useRoleAuth();
  const {
    products,
    shops,
    orders,
    addProduct,
    updateProduct,
    deleteProduct,
    addShop,
    deleteShop,
    resolvePrice,
    getRuleForShopProduct,
    upsertPriceRule,
    updateOrderStatus,
    updateOrderPaymentVerification,
    clearAllOrders,
  } = useTobaco();

  const distributorProfile = useMemo(() => getDistributorProfile(), [getDistributorProfile]);

  const [selectedShopForPricing, setSelectedShopForPricing] = useState("");
  const [selectedShopForLogin, setSelectedShopForLogin] = useState("");
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [offerDraft, setOfferDraft] = useState<Record<string, string>>({});
  const [paymentReviewDraft, setPaymentReviewDraft] = useState<Record<string, string>>({});
  const [resetPasswordDraft, setResetPasswordDraft] = useState<Record<string, string>>({});
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { username: string; displayName: string; shopId: string; active: boolean; useGstBill: boolean }>
  >({});
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isAddShopOpen, setIsAddShopOpen] = useState(false);
  const [isDeleteAccessOpen, setIsDeleteAccessOpen] = useState(false);
  const [deleteAccessKey, setDeleteAccessKey] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [contactForm, setContactForm] = useState({
    shopName: "",
    ownerName: "",
    mobile: "",
    whatsappNumber: "",
    area: "",
    address: "",
  });

  const [shopkeeperLoginForm, setShopkeeperLoginForm] = useState({
    username: "",
    password: "",
    displayName: "",
    useGstBill: true,
  });

  const [itemForm, setItemForm] = useState({
    itemNumber: "",
    name: "",
    category: "cigarette" as "cigarette" | "loose" | "smokeless",
    packSize: "",
    mrp: "",
    srp: "",
    moq: "",
    description: "",
    image: "",
  });

  const [editItemForm, setEditItemForm] = useState({
    id: "",
    itemNumber: "",
    name: "",
    category: "cigarette" as "cigarette" | "loose" | "smokeless",
    packSize: "",
    mrp: "",
    srp: "",
    moq: "",
    description: "",
    image: "",
  });

  useEffect(() => {
    if (shops.length === 0) return;
    if (!shops.some((shop) => shop.id === selectedShopForPricing)) setSelectedShopForPricing(shops[0].id);
    if (!shops.some((shop) => shop.id === selectedShopForLogin)) setSelectedShopForLogin(shops[0].id);
  }, [shops, selectedShopForPricing, selectedShopForLogin]);

  useEffect(() => {
    if (!selectedShopForPricing) return;
    const initialPrices: Record<string, string> = {};
    const initialOffers: Record<string, string> = {};
    for (const product of products) {
      const rule = getRuleForShopProduct(selectedShopForPricing, product.id);
      initialPrices[product.id] = String(rule?.customPrice ?? product.srp);
      initialOffers[product.id] = rule?.offerText ?? "";
    }
    setPriceDraft(initialPrices);
    setOfferDraft(initialOffers);
  }, [products, selectedShopForPricing, getRuleForShopProduct]);

  useEffect(() => {
    setUserDrafts((prev) => {
      const next = { ...prev };
      for (const account of shopkeeperAccounts) {
        const existing = next[account.id];
        next[account.id] = {
          username: existing?.username ?? account.username,
          displayName: existing?.displayName ?? account.displayName,
          shopId: existing?.shopId ?? account.shopId,
          active: existing?.active ?? account.active,
          useGstBill: existing?.useGstBill ?? account.useGstBill,
        };
      }
      for (const key of Object.keys(next)) {
        if (!shopkeeperAccounts.some((account) => account.id === key)) delete next[key];
      }
      return next;
    });
  }, [shopkeeperAccounts]);

  const nextAvailableItemNumber = useMemo(() => {
    const usedNumbers = products
      .map((product) => Number(product.itemNumber))
      .filter((num) => Number.isInteger(num) && num > 0 && num <= ITEM_NUMBER_MAX);
    const max = usedNumbers.length > 0 ? Math.max(...usedNumbers) : ITEM_NUMBER_START - 1;
    const next = max + 1;
    if (next > ITEM_NUMBER_MAX) return "";
    return String(next).padStart(4, "0");
  }, [products]);

  const sortedProducts = useMemo(() => [...products].sort((a, b) => Number(a.itemNumber) - Number(b.itemNumber)), [products]);

  const filteredProductsForItems = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    if (!query) return sortedProducts;
    return sortedProducts.filter(
      (product) => product.itemNumber.toLowerCase().includes(query) || product.name.toLowerCase().includes(query),
    );
  }, [sortedProducts, itemSearchQuery]);

  const stats = useMemo(() => {
    const accepted = orders.filter((order) => order.status === "accepted");
    const pending = orders.filter((order) => order.status === "pending");
    return {
      totalOrders: orders.length,
      acceptedRevenue: accepted.reduce((sum, order) => sum + order.subtotal, 0),
      pendingRevenue: pending.reduce((sum, order) => sum + order.subtotal, 0),
    };
  }, [orders]);

  const paymentOrderStats = useMemo(() => {
    const cashOrders = orders.filter((order) => order.paymentMethod === "cash").length;
    const onlineOrders = orders.filter((order) => order.paymentMethod === "online").length;
    const onlinePendingVerification = orders.filter(
      (order) => order.paymentMethod === "online" && order.paymentVerificationStatus === "pending",
    ).length;
    return { cashOrders, onlineOrders, onlinePendingVerification };
  }, [orders]);

  const distributorSalesTrend = useMemo(() => {
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

    for (const order of orders) {
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
  }, [orders]);

  const todayShopOrderSheet = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const shopAreaById = new Map(shops.map((shop) => [shop.id, shop.area]));
    const rows = new Map<
      string,
      {
        shopId: string;
        shopName: string;
        area: string;
        orderCount: number;
        acceptedCount: number;
        pendingCount: number;
        cancelledCount: number;
        qty: number;
        orderAmount: number;
        acceptedAmount: number;
      }
    >();

    for (const order of orders) {
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) continue;
      if (formatDateKey(createdAt) !== todayKey) continue;

      const existing = rows.get(order.shopId) ?? {
        shopId: order.shopId,
        shopName: order.shopName,
        area: shopAreaById.get(order.shopId) ?? "-",
        orderCount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        qty: 0,
        orderAmount: 0,
        acceptedAmount: 0,
      };

      existing.orderCount += 1;
      if (order.status === "accepted") existing.acceptedCount += 1;
      if (order.status === "pending") existing.pendingCount += 1;
      if (order.status === "rejected") existing.cancelledCount += 1;
      existing.qty += order.items.reduce((sum, item) => sum + item.quantity, 0);
      existing.orderAmount += Number(order.subtotal) || 0;
      if (order.status === "accepted") {
        existing.acceptedAmount += Number(order.subtotal) || 0;
      }

      rows.set(order.shopId, existing);
    }

    return Array.from(rows.values()).sort((a, b) => b.orderAmount - a.orderAmount);
  }, [orders, shops]);

  const dailySellingHeatMap = useMemo(() => {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; amount: number }> = [];
    const indexByKey = new Map<string, number>();

    for (let offset = HEATMAP_DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(now.getDate() - offset);
      const key = formatDateKey(day);
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: formatHeatmapLabel(day),
        amount: 0,
      });
    }

    for (const order of orders) {
      if (order.status !== "accepted") continue;
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) continue;
      const key = formatDateKey(createdAt);
      const targetIndex = indexByKey.get(key);
      if (targetIndex === undefined) continue;
      buckets[targetIndex].amount += Number(order.subtotal) || 0;
    }

    const maxAmount = buckets.reduce((max, item) => Math.max(max, item.amount), 0);

    return buckets.map((item) => {
      const ratio = maxAmount > 0 ? item.amount / maxAmount : 0;
      let levelClass = "bg-muted text-muted-foreground border-border";
      if (item.amount > 0 && ratio >= 0.75) levelClass = "bg-emerald-200 text-emerald-900 border-emerald-300";
      else if (item.amount > 0 && ratio >= 0.45) levelClass = "bg-yellow-200 text-yellow-900 border-yellow-300";
      else if (item.amount > 0 && ratio >= 0.2) levelClass = "bg-orange-200 text-orange-900 border-orange-300";
      else if (item.amount > 0) levelClass = "bg-red-200 text-red-900 border-red-300";

      return {
        ...item,
        levelClass,
      };
    });
  }, [orders]);

  const handleItemPhotoChange =
    (mode: "add" | "edit") => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (mode === "add") setItemForm((prev) => ({ ...prev, image: result }));
        if (mode === "edit") setEditItemForm((prev) => ({ ...prev, image: result }));
      };
      reader.readAsDataURL(file);
    };

  const handleAddItem = () => {
    const result = addProduct({
      itemNumber: itemForm.itemNumber,
      name: itemForm.name,
      category: itemForm.category,
      packSize: itemForm.packSize,
      description: itemForm.description,
      mrp: Number(itemForm.mrp),
      srp: Number(itemForm.srp),
      moq: Number(itemForm.moq),
      image: itemForm.image,
    });
    if (!result.ok) {
      toast({ title: "Add item failed", description: result.message, variant: "destructive" });
      return;
    }
    setItemForm({
      itemNumber: "",
      name: "",
      category: "cigarette",
      packSize: "",
      mrp: "",
      srp: "",
      moq: "",
      description: "",
      image: "",
    });
    setIsAddItemOpen(false);
  };

  const handleOpenEditItem = (productId: string) => {
    const target = products.find((product) => product.id === productId);
    if (!target) return;
    setEditItemForm({
      id: target.id,
      itemNumber: target.itemNumber,
      name: target.name,
      category: target.category,
      packSize: target.packSize,
      mrp: String(target.mrp),
      srp: String(target.srp),
      moq: String(target.moq),
      description: target.description,
      image: target.image || "",
    });
    setIsEditItemOpen(true);
  };

  const handleUpdateItem = () => {
    const result = updateProduct({
      id: editItemForm.id,
      itemNumber: editItemForm.itemNumber,
      name: editItemForm.name,
      category: editItemForm.category,
      packSize: editItemForm.packSize,
      description: editItemForm.description,
      mrp: Number(editItemForm.mrp),
      srp: Number(editItemForm.srp),
      moq: Number(editItemForm.moq),
      image: editItemForm.image,
    });
    if (!result.ok) {
      toast({ title: "Update failed", description: result.message, variant: "destructive" });
      return;
    }
    setIsEditItemOpen(false);
  };

  const handleDeleteItem = async (productId: string) => {
    const result = await deleteProduct(productId);
    if (!result.ok) {
      toast({ title: "Delete failed", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item deleted", description: result.message });
  };

  const handleAddShop = () => {
    const mobile = contactForm.mobile.replace(/\D/g, "").slice(0, 10);
    const whatsapp = (contactForm.whatsappNumber || contactForm.mobile).replace(/\D/g, "").slice(0, 10);
    if (!contactForm.shopName || !contactForm.ownerName || !mobile || !contactForm.area || !contactForm.address) {
      toast({ title: "Missing details", description: "Shop name, owner, mobile, area and address are required.", variant: "destructive" });
      return;
    }
    const shop = addShop({
      shopName: contactForm.shopName.trim(),
      ownerName: contactForm.ownerName.trim(),
      mobile,
      whatsappNumber: whatsapp,
      area: contactForm.area.trim(),
      address: contactForm.address.trim(),
    });
    setSelectedShopForPricing(shop.id);
    setSelectedShopForLogin(shop.id);
    setContactForm({ shopName: "", ownerName: "", mobile: "", whatsappNumber: "", area: "", address: "" });
    setIsAddShopOpen(false);
    toast({ title: "Shop added", description: `${shop.shopName} created successfully.` });
  };

  const handleDeleteShop = async (shopId: string) => {
    const relatedAccounts = shopkeeperAccounts.filter((account) => account.shopId === shopId);
    for (const account of relatedAccounts) {
      const accountResult = deleteShopkeeperAccount(account.id);
      if (!accountResult.ok) {
        toast({
          title: "Delete failed",
          description: `Unable to remove linked shopkeeper (${account.username}): ${accountResult.message}`,
          variant: "destructive",
        });
        return;
      }
    }

    const result = await deleteShop(shopId);
    if (!result.ok) {
      toast({ title: "Delete failed", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "Shop deleted", description: result.message });
  };

  const openDeleteAccessDialog = (target: NonNullable<DeleteTarget>) => {
    setDeleteTarget(target);
    setDeleteAccessKey("");
    setIsDeleteAccessOpen(true);
  };

  const closeDeleteAccessDialog = () => {
    setIsDeleteAccessOpen(false);
    setDeleteAccessKey("");
    setDeleteTarget(null);
  };

  const handleDeleteWithAccessKey = async () => {
    if (!deleteTarget) return;
    const verification = verifyAdminAccessKey(deleteAccessKey);
    if (!verification.ok) {
      toast({ title: "Access key failed", description: verification.message, variant: "destructive" });
      return;
    }

    if (deleteTarget.type === "item") {
      await handleDeleteItem(deleteTarget.id);
    } else {
      await handleDeleteShop(deleteTarget.id);
    }
    closeDeleteAccessDialog();
  };

  const handleSavePricing = (productId: string) => {
    if (!selectedShopForPricing) return;
    const customPrice = Number(priceDraft[productId]);
    if (!Number.isFinite(customPrice) || customPrice <= 0) {
      toast({ title: "Invalid price", description: "Enter valid price.", variant: "destructive" });
      return;
    }
    upsertPriceRule(selectedShopForPricing, productId, customPrice, offerDraft[productId] ?? "");
  };

  const handleCreateShopkeeperId = () => {
    const selectedShop = shops.find((shop) => shop.id === selectedShopForLogin);
    const result = createShopkeeperLogin({
      shopId: selectedShopForLogin,
      username: shopkeeperLoginForm.username,
      password: shopkeeperLoginForm.password,
      displayName: shopkeeperLoginForm.displayName || selectedShop?.shopName || "",
      useGstBill: shopkeeperLoginForm.useGstBill,
    });
    if (!result.ok) {
      toast({ title: "ID creation failed", description: result.message, variant: "destructive" });
      return;
    }
    setShopkeeperLoginForm({ username: "", password: "", displayName: "", useGstBill: true });
  };

  const handleResetShopkeeperPassword = (accountId: string) => {
    const result = resetShopkeeperPassword(accountId, resetPasswordDraft[accountId] ?? "");
    if (!result.ok) {
      toast({ title: "Password reset failed", description: result.message, variant: "destructive" });
      return;
    }
    setResetPasswordDraft((prev) => ({ ...prev, [accountId]: "" }));
  };

  const handleUpdateUser = (accountId: string) => {
    const draft = userDrafts[accountId];
    if (!draft) return;
    const result = updateShopkeeperAccount({
      accountId,
      username: draft.username,
      displayName: draft.displayName,
      shopId: draft.shopId,
      active: draft.active,
      useGstBill: draft.useGstBill,
    });
    if (!result.ok) toast({ title: "User update failed", description: result.message, variant: "destructive" });
  };

  const handleDeleteUser = (accountId: string) => {
    const result = deleteShopkeeperAccount(accountId);
    if (!result.ok) toast({ title: "Delete failed", description: result.message, variant: "destructive" });
  };

  const handleClearAllBills = async () => {
    const result = await clearAllOrders();
    if (!result.ok) {
      toast({ title: "Clear bills failed", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bills cleared", description: result.message });
  };

  const handlePrintBill = (orderId: string) => {
    const target = orders.find((order) => order.id === orderId);
    if (!target) return;
    const shop = shops.find((item) => item.id === target.shopId);
    const account = shopkeeperAccounts.find((item) => item.shopId === target.shopId);
    const opened = openBillPrintWindow(target, distributorProfile, {
      includeGst: account?.useGstBill ?? true,
      shopAddress: shop?.address ?? "",
    });
    if (!opened) toast({ title: "Print blocked", description: "Allow popup for print.", variant: "destructive" });
  };

  const handleDownloadBill = (orderId: string) => {
    const target = orders.find((order) => order.id === orderId);
    if (!target) return;
    const shop = shops.find((item) => item.id === target.shopId);
    const account = shopkeeperAccounts.find((item) => item.shopId === target.shopId);
    downloadBillHtml(target, distributorProfile, {
      includeGst: account?.useGstBill ?? true,
      shopAddress: shop?.address ?? "",
    });
  };

  const handleVerifyOnlinePayment = (orderId: string) => {
    updateOrderPaymentVerification(orderId, "verified", paymentReviewDraft[orderId] ?? "", distributorProfile.ownerName);
    setPaymentReviewDraft((prev) => ({ ...prev, [orderId]: "" }));
  };

  const handleRejectOnlinePayment = (orderId: string) => {
    const note = (paymentReviewDraft[orderId] ?? "").trim();
    if (!note) {
      toast({
        title: "Reason required",
        description: "Add reject reason before rejecting online payment.",
        variant: "destructive",
      });
      return;
    }
    updateOrderPaymentVerification(orderId, "rejected", note, distributorProfile.ownerName);
    setPaymentReviewDraft((prev) => ({ ...prev, [orderId]: "" }));
  };

  const deleteAccessDialog = (
    <Dialog open={isDeleteAccessOpen} onOpenChange={(open) => (open ? setIsDeleteAccessOpen(true) : closeDeleteAccessDialog())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Access Key Required</DialogTitle>
          <DialogDescription>
            Enter distributor access key to delete {deleteTarget?.type ?? "record"}:{" "}
            <span className="font-semibold">{deleteTarget?.label ?? "-"}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Access Key</Label>
          <Input
            type="password"
            value={deleteAccessKey}
            onChange={(event) => setDeleteAccessKey(event.target.value)}
            placeholder="Distributor password"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeDeleteAccessDialog}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDeleteWithAccessKey()}
            disabled={!deleteTarget || !deleteAccessKey.trim()}
          >
            Confirm Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!validSections.includes(section)) return <Navigate to="/distributor/dashboard" replace />;

  if (section === "dashboard") {
    return (
      <Card>
        <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
          <CardTitle className="text-xl">Distributor Dashboard</CardTitle>
          <CardDescription className="text-primary-foreground/85">Revenue and order status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
          <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Accepted Revenue</div><div className="text-2xl font-bold text-primary">₹{stats.acceptedRevenue}</div></div>
          <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Pending Revenue</div><div className="text-2xl font-bold text-amber-700">₹{stats.pendingRevenue}</div></div>
          <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Total Orders</div><div className="text-2xl font-bold">{stats.totalOrders}</div></div>
          <div className="rounded-lg border p-4 md:col-span-3">
            <div className="text-sm font-semibold">Selling Trend (INR / Day)</div>
            <div className="text-xs text-muted-foreground">Accepted orders for the last 7 days.</div>
            {distributorSalesTrend.some((entry) => entry.amount > 0) ? (
              <ChartContainer
                config={{ amount: { label: "Sales", color: "hsl(var(--primary))" } }}
                className="mt-3 h-[240px] w-full"
              >
                <BarChart data={distributorSalesTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
              <p className="mt-3 text-sm text-muted-foreground">No accepted sales data yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (section === "items") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Items</CardTitle>
                <CardDescription>Create, edit, delete items with photo.</CardDescription>
              </div>
              <Button variant="burgundy" onClick={() => { setItemForm((prev) => ({ ...prev, itemNumber: nextAvailableItemNumber })); setIsAddItemOpen(true); }}>
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md"><Label htmlFor="itemSearch">Search Item</Label><Input id="itemSearch" value={itemSearchQuery} onChange={(event) => setItemSearchQuery(event.target.value)} placeholder="item no or name" /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Photo</TableHead><TableHead>No.</TableHead><TableHead>Name</TableHead><TableHead>Pack</TableHead><TableHead>MRP</TableHead><TableHead>SRP</TableHead><TableHead>MOQ</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>{filteredProductsForItems.map((product) => <TableRow key={product.id}><TableCell><img src={product.image || "/placeholder.svg"} alt={product.name} className="h-12 w-12 rounded-md border object-cover" /></TableCell><TableCell className="font-semibold">{product.itemNumber}</TableCell><TableCell>{product.name}</TableCell><TableCell>{product.packSize}</TableCell><TableCell>₹{product.mrp}</TableCell><TableCell>₹{product.srp}</TableCell><TableCell>{product.moq}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleOpenEditItem(product.id)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => openDeleteAccessDialog({ type: "item", id: product.id, label: `${product.itemNumber} - ${product.name}` })}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Item</DialogTitle><DialogDescription>Photo first, then details.</DialogDescription></DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Photo</Label><Input type="file" accept="image/*" onChange={handleItemPhotoChange("add")} />{itemForm.image && <img src={itemForm.image} alt="preview" className="h-20 w-20 rounded-md border object-cover" />}</div>
              <div className="space-y-2"><Label>Item Number</Label><Input value={itemForm.itemNumber} onChange={(event) => setItemForm((prev) => ({ ...prev, itemNumber: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></div>
              <div className="space-y-2"><Label>Name</Label><Input value={itemForm.name} onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Category</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={itemForm.category} onChange={(event) => setItemForm((prev) => ({ ...prev, category: event.target.value as "cigarette" | "loose" | "smokeless" }))}><option value="cigarette">Cigarette</option><option value="loose">Loose Tobacco</option><option value="smokeless">Smokeless</option></select></div>
              <div className="space-y-2"><Label>Pack</Label><Input value={itemForm.packSize} onChange={(event) => setItemForm((prev) => ({ ...prev, packSize: event.target.value }))} /></div>
              <div className="space-y-2"><Label>MOQ</Label><Input type="number" min={1} value={itemForm.moq} onChange={(event) => setItemForm((prev) => ({ ...prev, moq: event.target.value }))} /></div>
              <div className="space-y-2"><Label>MRP</Label><Input type="number" min={1} value={itemForm.mrp} onChange={(event) => setItemForm((prev) => ({ ...prev, mrp: event.target.value }))} /></div>
              <div className="space-y-2"><Label>SRP</Label><Input type="number" min={1} value={itemForm.srp} onChange={(event) => setItemForm((prev) => ({ ...prev, srp: event.target.value }))} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea rows={2} value={itemForm.description} onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsAddItemOpen(false)}>Cancel</Button><Button variant="burgundy" onClick={handleAddItem}>Save Item</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Edit Item</DialogTitle><DialogDescription>Modify and save.</DialogDescription></DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Photo</Label><Input type="file" accept="image/*" onChange={handleItemPhotoChange("edit")} />{editItemForm.image && <img src={editItemForm.image} alt="preview" className="h-20 w-20 rounded-md border object-cover" />}</div>
              <div className="space-y-2"><Label>Item Number</Label><Input value={editItemForm.itemNumber} onChange={(event) => setEditItemForm((prev) => ({ ...prev, itemNumber: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></div>
              <div className="space-y-2"><Label>Name</Label><Input value={editItemForm.name} onChange={(event) => setEditItemForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Category</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editItemForm.category} onChange={(event) => setEditItemForm((prev) => ({ ...prev, category: event.target.value as "cigarette" | "loose" | "smokeless" }))}><option value="cigarette">Cigarette</option><option value="loose">Loose Tobacco</option><option value="smokeless">Smokeless</option></select></div>
              <div className="space-y-2"><Label>Pack</Label><Input value={editItemForm.packSize} onChange={(event) => setEditItemForm((prev) => ({ ...prev, packSize: event.target.value }))} /></div>
              <div className="space-y-2"><Label>MOQ</Label><Input type="number" min={1} value={editItemForm.moq} onChange={(event) => setEditItemForm((prev) => ({ ...prev, moq: event.target.value }))} /></div>
              <div className="space-y-2"><Label>MRP</Label><Input type="number" min={1} value={editItemForm.mrp} onChange={(event) => setEditItemForm((prev) => ({ ...prev, mrp: event.target.value }))} /></div>
              <div className="space-y-2"><Label>SRP</Label><Input type="number" min={1} value={editItemForm.srp} onChange={(event) => setEditItemForm((prev) => ({ ...prev, srp: event.target.value }))} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea rows={2} value={editItemForm.description} onChange={(event) => setEditItemForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsEditItemOpen(false)}>Cancel</Button><Button variant="burgundy" onClick={handleUpdateItem}>Save Changes</Button></div>
          </DialogContent>
        </Dialog>

        {deleteAccessDialog}
      </div>
    );
  }

  if (section === "users") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-xl">Users Management</CardTitle><CardDescription>Create, edit, delete, reset password for shopkeeper users.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Select Shop</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedShopForLogin} onChange={(event) => setSelectedShopForLogin(event.target.value)}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shopName} - {shop.area}</option>)}</select></div>
            <div className="space-y-2"><Label>Display Name</Label><Input value={shopkeeperLoginForm.displayName} onChange={(event) => setShopkeeperLoginForm((prev) => ({ ...prev, displayName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Username</Label><Input value={shopkeeperLoginForm.username} onChange={(event) => setShopkeeperLoginForm((prev) => ({ ...prev, username: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={shopkeeperLoginForm.password} onChange={(event) => setShopkeeperLoginForm((prev) => ({ ...prev, password: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>GST Bill For This Shop?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={shopkeeperLoginForm.useGstBill ? "gold" : "outline"}
                  onClick={() => setShopkeeperLoginForm((prev) => ({ ...prev, useGstBill: true }))}
                >
                  GST Bill
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!shopkeeperLoginForm.useGstBill ? "gold" : "outline"}
                  onClick={() => setShopkeeperLoginForm((prev) => ({ ...prev, useGstBill: false }))}
                >
                  No GST
                </Button>
              </div>
            </div>
          </div>
          <Button variant="burgundy" onClick={handleCreateShopkeeperId}>Create Shopkeeper ID</Button>
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Display</TableHead><TableHead>Shop</TableHead><TableHead>Status</TableHead><TableHead>GST Bill</TableHead><TableHead>Owner</TableHead><TableHead>Mobile</TableHead><TableHead>Password</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {shopkeeperAccounts.map((account) => {
                const draft = userDrafts[account.id] ?? { username: account.username, displayName: account.displayName, shopId: account.shopId, active: account.active, useGstBill: account.useGstBill };
                const profile = getProfileForUser("shopkeeper", account.username);
                return (
                  <TableRow key={account.id}>
                    <TableCell><Input value={draft.username} onChange={(event) => setUserDrafts((prev) => ({ ...prev, [account.id]: { ...draft, username: event.target.value } }))} /></TableCell>
                    <TableCell><Input value={draft.displayName} onChange={(event) => setUserDrafts((prev) => ({ ...prev, [account.id]: { ...draft, displayName: event.target.value } }))} /></TableCell>
                    <TableCell><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.shopId} onChange={(event) => setUserDrafts((prev) => ({ ...prev, [account.id]: { ...draft, shopId: event.target.value } }))}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shopName}</option>)}</select></TableCell>
                    <TableCell><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.active ? "active" : "inactive"} onChange={(event) => setUserDrafts((prev) => ({ ...prev, [account.id]: { ...draft, active: event.target.value === "active" } }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></TableCell>
                    <TableCell><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.useGstBill ? "yes" : "no"} onChange={(event) => setUserDrafts((prev) => ({ ...prev, [account.id]: { ...draft, useGstBill: event.target.value === "yes" } }))}><option value="yes">GST</option><option value="no">No GST</option></select></TableCell>
                    <TableCell>{profile.ownerName || "-"}</TableCell>
                    <TableCell>{profile.mobileNumber || "-"}</TableCell>
                    <TableCell><div className="flex gap-2"><Input type="password" value={resetPasswordDraft[account.id] ?? ""} onChange={(event) => setResetPasswordDraft((prev) => ({ ...prev, [account.id]: event.target.value }))} placeholder="new password" /><Button size="sm" variant="outline" onClick={() => handleResetShopkeeperPassword(account.id)}>Set</Button></div></TableCell>
                    <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleUpdateUser(account.id)}>Save</Button><Button size="sm" variant="destructive" onClick={() => handleDeleteUser(account.id)}>Delete</Button></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (section === "shops") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Shop Management</CardTitle>
                <CardDescription>Create and manage shop contacts.</CardDescription>
              </div>
              <Button variant="burgundy" onClick={() => setIsAddShopOpen(true)}>
                Add Shop
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell>{shop.shopName}</TableCell>
                    <TableCell>{shop.ownerName}</TableCell>
                    <TableCell>{shop.mobile}</TableCell>
                    <TableCell>{shop.area}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          openDeleteAccessDialog({
                            type: "shop",
                            id: shop.id,
                            label: shop.shopName,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isAddShopOpen} onOpenChange={setIsAddShopOpen}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Shop</DialogTitle>
              <DialogDescription>Fill all required details to create a new shop contact.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input
                  value={contactForm.shopName}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, shopName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input
                  value={contactForm.ownerName}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, ownerName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input
                  value={contactForm.mobile}
                  onChange={(event) =>
                    setContactForm((prev) => ({ ...prev, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={contactForm.whatsappNumber}
                  onChange={(event) =>
                    setContactForm((prev) => ({
                      ...prev,
                      whatsappNumber: event.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Area</Label>
                <Input
                  value={contactForm.area}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, area: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={contactForm.address}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddShopOpen(false)}>
                Cancel
              </Button>
              <Button variant="burgundy" onClick={handleAddShop}>
                Save Shop
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {deleteAccessDialog}

        <Card>
          <CardHeader><CardTitle className="text-xl">Shop-Wise Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Select Shop</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedShopForPricing} onChange={(event) => setSelectedShopForPricing(event.target.value)}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shopName} - {shop.area}</option>)}</select></div>
            <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Default SRP</TableHead><TableHead>Shop Price</TableHead><TableHead>Custom Price</TableHead><TableHead>Offer</TableHead><TableHead>Save</TableHead></TableRow></TableHeader><TableBody>{products.map((product) => <TableRow key={product.id}><TableCell>{product.name}</TableCell><TableCell>₹{product.srp}</TableCell><TableCell>₹{selectedShopForPricing ? resolvePrice(selectedShopForPricing, product.id, product.srp) : product.srp}</TableCell><TableCell><Input type="number" min={1} value={priceDraft[product.id] ?? ""} onChange={(event) => setPriceDraft((prev) => ({ ...prev, [product.id]: event.target.value }))} /></TableCell><TableCell><Input value={offerDraft[product.id] ?? ""} onChange={(event) => setOfferDraft((prev) => ({ ...prev, [product.id]: event.target.value }))} /></TableCell><TableCell><Button size="sm" onClick={() => handleSavePricing(product.id)}>Save</Button></TableCell></TableRow>)}</TableBody></Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (section === "orders") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Orders</CardTitle>
          <CardDescription>Shopkeeper orders with payment mode and online verification controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Cash Orders</div>
              <div className="text-xl font-bold">{paymentOrderStats.cashOrders}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Online Orders</div>
              <div className="text-xl font-bold">{paymentOrderStats.onlineOrders}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Online Pending Verify</div>
              <div className="text-xl font-bold text-amber-700">{paymentOrderStats.onlinePendingVerification}</div>
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approve</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Verify Payment</TableHead>
                  <TableHead>Bill</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-semibold">{order.id}</TableCell>
                    <TableCell>{order.shopName}</TableCell>
                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell>₹{order.subtotal}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClassMap[order.status]}`}>
                        {order.status === "rejected" ? "CANCELLED" : order.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="gold" onClick={() => updateOrderStatus(order.id, "accepted")}>
                            Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        "Finalized"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium uppercase">{order.paymentMethod}</div>
                      {order.paymentMethod === "online" && order.onlinePaymentReference ? (
                        <div className="text-[11px] text-muted-foreground">{order.onlinePaymentReference}</div>
                      ) : null}
                      <div className="mt-1">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${paymentStatusClassMap[order.paymentVerificationStatus]}`}
                        >
                          {order.paymentVerificationStatus.toUpperCase()}
                        </span>
                      </div>
                      {order.paymentVerificationNote ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">{order.paymentVerificationNote}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {order.paymentMethod === "online" ? (
                        <div className="space-y-2">
                          <Input
                            value={paymentReviewDraft[order.id] ?? ""}
                            onChange={(event) =>
                              setPaymentReviewDraft((prev) => ({ ...prev, [order.id]: event.target.value }))
                            }
                            placeholder="verify note / reject reason"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleVerifyOnlinePayment(order.id)}>
                              Verify
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRejectOnlinePayment(order.id)}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Cash payment</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handlePrintBill(order.id)}>
                          <FileText className="mr-1 h-4 w-4" />
                          Print
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadBill(order.id)}>
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  if (section === "bills") {
    const acceptedOrders = orders.filter((order) => order.status === "accepted");
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Bills</CardTitle>
              <CardDescription>Accepted orders bill list.</CardDescription>
            </div>
            <Button variant="destructive" onClick={() => void handleClearAllBills()}>
              Clear Old Bills
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {acceptedOrders.length === 0 ? <p className="text-sm text-muted-foreground">No finalized bills yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>Shop</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Download</TableHead></TableRow></TableHeader>
              <TableBody>{acceptedOrders.map((order) => <TableRow key={order.id}><TableCell>{order.id}</TableCell><TableCell>{order.shopName}</TableCell><TableCell>{formatDateTime(order.createdAt)}</TableCell><TableCell>₹{order.subtotal}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handlePrintBill(order.id)}>Print</Button><Button size="sm" variant="outline" onClick={() => handleDownloadBill(order.id)}>Download</Button></div></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Order Sheets (Today)</CardTitle>
          <CardDescription>Excel-style shop-wise summary of how much each shop ordered today.</CardDescription>
        </CardHeader>
        <CardContent>
          {todayShopOrderSheet.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shop orders for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Cancelled</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Order INR</TableHead>
                    <TableHead>Accepted INR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayShopOrderSheet.map((row) => (
                    <TableRow key={row.shopId}>
                      <TableCell className="font-semibold">{row.shopName}</TableCell>
                      <TableCell>{row.area}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell>{row.acceptedCount}</TableCell>
                      <TableCell>{row.pendingCount}</TableCell>
                      <TableCell>{row.cancelledCount}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>₹{row.orderAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{row.acceptedAmount.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Daily Selling Heat Map
          </CardTitle>
          <CardDescription>Last 30 days accepted INR. Green high, yellow medium, orange low, red very low.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-emerald-300 bg-emerald-200 px-2 py-1 text-emerald-900">High</span>
            <span className="rounded border border-yellow-300 bg-yellow-200 px-2 py-1 text-yellow-900">Medium</span>
            <span className="rounded border border-orange-300 bg-orange-200 px-2 py-1 text-orange-900">Low</span>
            <span className="rounded border border-red-300 bg-red-200 px-2 py-1 text-red-900">Very Low</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
            {dailySellingHeatMap.map((day) => (
              <div
                key={day.key}
                className={`rounded-md border p-2 text-center text-xs ${day.levelClass}`}
                title={`${day.label}: INR ${day.amount.toLocaleString("en-IN")}`}
              >
                <div className="font-semibold">{day.label}</div>
                <div>₹{compactInr.format(day.amount)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributorPanel;
