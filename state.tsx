import { products as defaultProducts, type Product } from "@/data/products";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { OrderRecord, OrderStatus, PaymentMethod, PriceRule, ShopContact } from "./types";

interface TobacoState {
  products: Product[];
  shops: ShopContact[];
  priceRules: PriceRule[];
  orders: OrderRecord[];
}

interface CreateOrderPayload {
  shopId: string;
  quantities: Record<string, number>;
  paymentMethod: PaymentMethod;
  note: string;
}

interface CreateOrderResult {
  ok: boolean;
  message: string;
  order?: OrderRecord;
}

type AddProductInput = Omit<Product, "id" | "image"> & {
  image?: string;
};

interface AddProductResult {
  ok: boolean;
  message: string;
  product?: Product;
}

type UpdateProductInput = Omit<Product, "image"> & {
  image?: string;
};

interface DeleteProductResult {
  ok: boolean;
  message: string;
}

interface ClearOrdersResult {
  ok: boolean;
  message: string;
}

interface TobacoContextValue {
  products: Product[];
  shops: ShopContact[];
  priceRules: PriceRule[];
  orders: OrderRecord[];
  addProduct: (input: AddProductInput) => AddProductResult;
  updateProduct: (input: UpdateProductInput) => AddProductResult;
  deleteProduct: (productId: string) => Promise<DeleteProductResult>;
  addShop: (input: Omit<ShopContact, "id" | "createdAt">) => ShopContact;
  upsertPriceRule: (shopId: string, productId: string, customPrice: number, offerText: string) => void;
  getRuleForShopProduct: (shopId: string, productId: string) => PriceRule | undefined;
  resolvePrice: (shopId: string, productId: string, fallbackPrice: number) => number;
  createOrder: (payload: CreateOrderPayload) => Promise<CreateOrderResult>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  clearAllOrders: () => Promise<ClearOrdersResult>;
}

interface ProductRow {
  id: string;
  item_number: string;
  name: string;
  description: string;
  mrp: number | string;
  srp: number | string;
  moq: number | string;
  pack_size: string;
  image: string;
  category: Product["category"];
}

interface ShopRow {
  id: string;
  shop_name: string;
  owner_name: string;
  mobile: string;
  whatsapp_number: string;
  area: string;
  address: string;
  created_at: string;
}

interface PriceRuleRow {
  id: string;
  shop_id: string;
  product_id: string;
  custom_price: number | string;
  offer_text: string | null;
  updated_at: string;
}

interface OrderRow {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string;
  owner_name: string;
  mobile: string;
  payment_method: PaymentMethod;
  created_at: string;
  status: OrderStatus;
  subtotal: number | string;
  note: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  item_number: string | null;
  product_name: string;
  image: string | null;
  pack_size: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
}

const STORAGE_KEY = "tobaco-platform-v1";
const ITEM_NUMBER_START = 1;
const ITEM_NUMBER_MAX = 9999;
const REMOTE_SYNC_INTERVAL_MS = 3000;
const ORDER_RETENTION_DAYS = 30;
const REMOTE_RETENTION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let hasLoggedRemoteError = false;

const formatItemNumber = (value: number) => String(value).padStart(4, "0");

const parseItemNumber = (value: unknown) => {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isInteger(parsed) || parsed < ITEM_NUMBER_START || parsed > ITEM_NUMBER_MAX) return null;
  return parsed;
};

const getLatestAvailableItemNumber = (items: Array<{ itemNumber?: string }>) => {
  const used = items
    .map((item) => parseItemNumber(item.itemNumber))
    .filter((num): num is number => num !== null);
  const max = used.length > 0 ? Math.max(...used) : ITEM_NUMBER_START - 1;
  const next = max + 1;
  if (next > ITEM_NUMBER_MAX) return "";
  return formatItemNumber(next);
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatOrderDatePart = (date: Date) =>
  `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${pad2(date.getFullYear() % 100)}`;

const parseDailyOrderId = (id: string) => {
  const trimmed = String(id ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^ORD\s*-\s*(\d{6})\/?(\d{3,})$/i);
  if (!match) return null;
  const sequence = Number(match[2]);
  if (!Number.isInteger(sequence) || sequence <= 0) return null;
  return {
    datePart: match[1],
    sequence,
  };
};

const buildDailyOrderId = (datePart: string, sequence: number) =>
  `ORD - ${datePart}${String(sequence).padStart(3, "0")}`;

const getNextOrderId = (orders: OrderRecord[]) => {
  const todayPart = formatOrderDatePart(new Date());
  const maxSequence = orders.reduce((max, order) => {
    const parsed = parseDailyOrderId(order.id);
    if (!parsed || parsed.datePart !== todayPart) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return buildDailyOrderId(todayPart, maxSequence + 1);
};

const getNextOrderIdFromIds = (orderIds: string[]) => {
  const todayPart = formatOrderDatePart(new Date());
  const maxSequence = orderIds.reduce((max, id) => {
    const parsed = parseDailyOrderId(id);
    if (!parsed || parsed.datePart !== todayPart) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return buildDailyOrderId(todayPart, maxSequence + 1);
};

const retentionCutoffTimestamp = (now = Date.now()) => now - ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const isOrderWithinRetention = (createdAt: string, now = Date.now()) => {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return true;
  return timestamp >= retentionCutoffTimestamp(now);
};

const pruneOrdersByRetention = (orders: OrderRecord[], now = Date.now()) =>
  orders.filter((order) => isOrderWithinRetention(order.createdAt, now));

const normalizeProduct = (
  product: Product | (Partial<Product> & { id: string }),
  index: number,
  list: Array<Partial<Product> & { id: string }>,
) => {
  const parsedItemNumber = parseItemNumber(product.itemNumber);
  const itemNumber = parsedItemNumber
    ? formatItemNumber(parsedItemNumber)
    : getLatestAvailableItemNumber(list.slice(0, index).map((item) => ({ itemNumber: item.itemNumber })));

  return {
    ...product,
    itemNumber: itemNumber || formatItemNumber(ITEM_NUMBER_START + index),
    image: typeof product.image === "string" && product.image.trim() ? product.image : "/placeholder.svg",
  } as Product;
};

const defaultState = (): TobacoState => ({
  products: defaultProducts.map((product, index, list) => normalizeProduct(product, index, list)),
  shops: [
    {
      id: "shop-001",
      shopName: "Maa Tara Pan Shop",
      ownerName: "Rakesh Shaw",
      mobile: "9876543210",
      whatsappNumber: "9876543210",
      area: "Kolkata",
      address: "12 Market Road, Kolkata",
      createdAt: new Date().toISOString(),
    },
    {
      id: "shop-002",
      shopName: "City Retail Corner",
      ownerName: "Sanjay Verma",
      mobile: "9123456780",
      whatsappNumber: "9123456780",
      area: "Howrah",
      address: "45 Station Lane, Howrah",
      createdAt: new Date().toISOString(),
    },
  ],
  priceRules: [],
  orders: [],
});

const hydrateState = (parsed?: Partial<TobacoState> | null): TobacoState => {
  const fallback = defaultState();
  const parsedProducts = Array.isArray(parsed?.products) && parsed.products.length > 0 ? parsed.products : fallback.products;
  return {
    products: parsedProducts.map((product, index, list) =>
      normalizeProduct(product as Product & { id: string }, index, list as Array<Partial<Product> & { id: string }>),
    ),
    shops: Array.isArray(parsed?.shops) && parsed.shops.length > 0 ? parsed.shops : fallback.shops,
    priceRules: Array.isArray(parsed?.priceRules) ? parsed.priceRules : [],
    orders: pruneOrdersByRetention(Array.isArray(parsed?.orders) ? parsed.orders : []),
  };
};

const areStatesEqual = (a: TobacoState, b: TobacoState) => JSON.stringify(a) === JSON.stringify(b);

const loadState = (): TobacoState => {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<TobacoState>;
    return hydrateState(parsed);
  } catch {
    return defaultState();
  }
};

const productToRow = (product: Product): ProductRow => ({
  id: product.id,
  item_number: product.itemNumber,
  name: product.name,
  description: product.description,
  mrp: product.mrp,
  srp: product.srp,
  moq: product.moq,
  pack_size: product.packSize,
  image: product.image,
  category: product.category,
});

const productFromRow = (row: ProductRow): Product => ({
  id: row.id,
  itemNumber: formatItemNumber(parseItemNumber(row.item_number) ?? ITEM_NUMBER_START),
  name: row.name,
  description: row.description,
  mrp: Number(row.mrp),
  srp: Number(row.srp),
  moq: Number(row.moq),
  packSize: row.pack_size,
  image: row.image || "/placeholder.svg",
  category: row.category,
});

const shopToRow = (shop: ShopContact): ShopRow => ({
  id: shop.id,
  shop_name: shop.shopName,
  owner_name: shop.ownerName,
  mobile: shop.mobile,
  whatsapp_number: shop.whatsappNumber,
  area: shop.area,
  address: shop.address,
  created_at: shop.createdAt,
});

const shopFromRow = (row: ShopRow): ShopContact => ({
  id: row.id,
  shopName: row.shop_name,
  ownerName: row.owner_name,
  mobile: row.mobile,
  whatsappNumber: row.whatsapp_number,
  area: row.area,
  address: row.address,
  createdAt: row.created_at,
});

const priceRuleToRow = (rule: PriceRule): PriceRuleRow => ({
  id: rule.id,
  shop_id: rule.shopId,
  product_id: rule.productId,
  custom_price: rule.customPrice,
  offer_text: rule.offerText,
  updated_at: rule.updatedAt,
});

const priceRuleFromRow = (row: PriceRuleRow): PriceRule => ({
  id: row.id,
  shopId: row.shop_id,
  productId: row.product_id,
  customPrice: Number(row.custom_price),
  offerText: row.offer_text ?? "",
  updatedAt: row.updated_at,
});

const orderToRow = (order: OrderRecord): OrderRow => ({
  id: order.id,
  shop_id: order.shopId,
  shop_name: order.shopName,
  shop_address: order.shopAddress ?? "",
  owner_name: order.ownerName,
  mobile: order.mobile,
  payment_method: order.paymentMethod,
  created_at: order.createdAt,
  status: order.status,
  subtotal: order.subtotal,
  note: order.note,
});

const orderItemRows = (order: OrderRecord): OrderItemRow[] =>
  order.items.map((item, idx) => ({
    id: `${order.id}-${idx + 1}`,
    order_id: order.id,
    product_id: item.productId,
    item_number: item.itemNumber ?? null,
    product_name: item.productName,
    image: item.image ?? null,
    pack_size: item.packSize,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
  }));

const buildStateFromRemote = (
  productRows: ProductRow[],
  shopRows: ShopRow[],
  priceRuleRows: PriceRuleRow[],
  orderRows: OrderRow[],
  orderItemRowsData: OrderItemRow[],
): TobacoState => {
  const products = productRows
    .map(productFromRow)
    .sort((a, b) => Number(a.itemNumber) - Number(b.itemNumber));
  const shops = shopRows.map(shopFromRow);
  const priceRules = priceRuleRows.map(priceRuleFromRow);
  const itemMap = new Map<string, OrderItemRow[]>();

  for (const row of orderItemRowsData) {
    const existing = itemMap.get(row.order_id);
    if (existing) {
      existing.push(row);
    } else {
      itemMap.set(row.order_id, [row]);
    }
  }

  const orders = orderRows
    .filter((row) => isOrderWithinRetention(row.created_at))
    .map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      shopName: row.shop_name,
      shopAddress: row.shop_address ?? "",
      ownerName: row.owner_name,
      mobile: row.mobile,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      status: row.status,
      note: row.note ?? "",
      subtotal: Number(row.subtotal),
      items: (itemMap.get(row.id) ?? []).map((item) => ({
        productId: item.product_id,
        itemNumber: item.item_number ?? undefined,
        productName: item.product_name,
        image: item.image ?? undefined,
        packSize: item.pack_size,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })),
    }));

  return hydrateState({ products, shops, priceRules, orders });
};

const fetchRemoteState = async (): Promise<TobacoState | null> => {
  if (!isSupabaseConfigured) return null;

  const [productsRes, shopsRes, priceRulesRes, ordersRes, orderItemsRes] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("shops").select("*"),
    supabase.from("price_rules").select("*"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("order_items").select("*"),
  ]);

  if (productsRes.error || shopsRes.error || priceRulesRes.error || ordersRes.error || orderItemsRes.error) {
    throw new Error(
      [
        productsRes.error?.message,
        shopsRes.error?.message,
        priceRulesRes.error?.message,
        ordersRes.error?.message,
        orderItemsRes.error?.message,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  const productRows = (productsRes.data ?? []) as ProductRow[];
  const shopRows = (shopsRes.data ?? []) as ShopRow[];
  const priceRows = (priceRulesRes.data ?? []) as PriceRuleRow[];
  const orderRows = (ordersRes.data ?? []) as OrderRow[];
  const orderItemRowsData = (orderItemsRes.data ?? []) as OrderItemRow[];

  const hasRemoteData = productRows.length > 0 || shopRows.length > 0 || priceRows.length > 0 || orderRows.length > 0;
  if (!hasRemoteData) return null;

  return buildStateFromRemote(productRows, shopRows, priceRows, orderRows, orderItemRowsData);
};

const purgeRemoteOrdersOlderThanRetention = async () => {
  if (!isSupabaseConfigured) return;
  const cutoffIso = new Date(retentionCutoffTimestamp()).toISOString();

  for (let loop = 0; loop < 4; loop += 1) {
    const { data: staleRows, error: staleReadError } = await supabase
      .from("orders")
      .select("id")
      .lt("created_at", cutoffIso)
      .limit(200);
    if (staleReadError) throw staleReadError;
    const staleIds = (staleRows ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
    if (staleIds.length === 0) return;

    const { error: staleDeleteError } = await supabase.from("orders").delete().in("id", staleIds);
    if (staleDeleteError) throw staleDeleteError;

    if (staleIds.length < 200) return;
  }
};

const pushStateToRemote = async (snapshot: TobacoState) => {
  if (!isSupabaseConfigured) return;

  const productRows = snapshot.products.map(productToRow);
  const shopRows = snapshot.shops.map(shopToRow);
  const priceRows = snapshot.priceRules.map(priceRuleToRow);
  const orderRows = snapshot.orders.map(orderToRow);
  const itemRows = snapshot.orders.flatMap((order) => orderItemRows(order));

  if (productRows.length > 0) {
    const { error } = await supabase.from("products").upsert(productRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (shopRows.length > 0) {
    const { error } = await supabase.from("shops").upsert(shopRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (priceRows.length > 0) {
    const { error } = await supabase.from("price_rules").upsert(priceRows, { onConflict: "shop_id,product_id" });
    if (error) throw error;
  }
  if (orderRows.length > 0) {
    const { error } = await supabase.from("orders").upsert(orderRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (snapshot.orders.length > 0) {
    const orderIds = snapshot.orders.map((order) => order.id);
    const { error: cleanupError } = await supabase.from("order_items").delete().in("order_id", orderIds);
    if (cleanupError) throw cleanupError;
    if (itemRows.length > 0) {
      const { error: insertError } = await supabase.from("order_items").insert(itemRows);
      if (insertError) throw insertError;
    }
  }
};

const logRemoteError = (error: unknown) => {
  if (hasLoggedRemoteError) return;
  hasLoggedRemoteError = true;
  console.warn("Supabase sync unavailable. Using local storage fallback.", error);
};

const TobacoContext = createContext<TobacoContextValue | undefined>(undefined);

export const TobacoProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TobacoState>(loadState);
  const stateRef = useRef(state);
  const lastRemoteRetentionCleanupAtRef = useRef(0);

  useEffect(() => {
    const prune = () => {
      setState((prev) => {
        const nextOrders = pruneOrdersByRetention(prev.orders);
        if (nextOrders.length === prev.orders.length) return prev;
        return { ...prev, orders: nextOrders };
      });
    };

    prune();
    const intervalId = window.setInterval(prune, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to persist TOBACO state to localStorage:", error);
    }
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const syncRemote = async () => {
      try {
        const now = Date.now();
        if (now - lastRemoteRetentionCleanupAtRef.current >= REMOTE_RETENTION_CLEANUP_INTERVAL_MS) {
          try {
            await purgeRemoteOrdersOlderThanRetention();
          } catch (retentionError) {
            logRemoteError(retentionError);
          }
          lastRemoteRetentionCleanupAtRef.current = now;
        }
        const remoteState = await fetchRemoteState();
        if (!active) return;
        if (!remoteState) {
          await pushStateToRemote({
            ...stateRef.current,
            orders: pruneOrdersByRetention(stateRef.current.orders),
          });
          return;
        }
        setState((prev) => (areStatesEqual(prev, remoteState) ? prev : remoteState));
      } catch (error) {
        logRemoteError(error);
      }
    };

    void syncRemote();
    const intervalId = window.setInterval(() => {
      void syncRemote();
    }, REMOTE_SYNC_INTERVAL_MS);
    const handleFocus = () => {
      void syncRemote();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const validateProductInput = (
    input: {
      id?: string;
      itemNumber: string;
      name: string;
      description: string;
      packSize: string;
      mrp: number;
      srp: number;
      moq: number;
      category: Product["category"];
      image?: string;
    },
    mode: "create" | "update",
  ) => {
    const parsedItemNumber = parseItemNumber(input.itemNumber);
    const name = input.name.trim();
    const description = input.description.trim();
    const packSize = input.packSize.trim();
    const mrp = Number(input.mrp);
    const srp = Number(input.srp);
    const moq = Number(input.moq);

    if (!name || !description || !packSize) {
      return { ok: false, message: "Name, description and pack size are required." } as const;
    }
    if (
      !Number.isFinite(mrp) ||
      !Number.isFinite(srp) ||
      !Number.isFinite(moq) ||
      mrp <= 0 ||
      srp <= 0 ||
      moq <= 0
    ) {
      return { ok: false, message: "MRP, SRP and MOQ must be valid positive numbers." } as const;
    }
    if (srp > mrp) {
      return { ok: false, message: "SRP should be less than or equal to MRP." } as const;
    }
    if (!parsedItemNumber) {
      return { ok: false, message: "Item number is required." } as const;
    }

    const itemNumber = formatItemNumber(parsedItemNumber);
    const existsByName = state.products.some(
      (product) => product.id !== input.id && product.name.toLowerCase() === name.toLowerCase(),
    );
    if (existsByName) {
      return { ok: false, message: "Item with this name already exists." } as const;
    }
    const existsByNumber = state.products.some(
      (product) => product.id !== input.id && product.itemNumber === itemNumber,
    );
    if (existsByNumber) {
      return { ok: false, message: "Item number already exists. Use another number." } as const;
    }

    return {
      ok: true,
      payload: {
        id: input.id,
        itemNumber,
        name,
        description,
        mrp,
        srp,
        moq,
        packSize,
        image: input.image?.trim() || "/placeholder.svg",
        category: input.category,
      },
      mode,
    } as const;
  };

  const addProduct = (input: AddProductInput): AddProductResult => {
    const validation = validateProductInput(
      {
        itemNumber: input.itemNumber,
        name: input.name,
        description: input.description,
        packSize: input.packSize,
        mrp: Number(input.mrp),
        srp: Number(input.srp),
        moq: Number(input.moq),
        category: input.category,
        image: input.image,
      },
      "create",
    );
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }

    const slug = validation.payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);

    const product: Product = {
      id: `${slug || "item"}-${Date.now().toString().slice(-6)}`,
      itemNumber: validation.payload.itemNumber,
      name: validation.payload.name,
      description: validation.payload.description,
      mrp: validation.payload.mrp,
      srp: validation.payload.srp,
      moq: validation.payload.moq,
      packSize: validation.payload.packSize,
      image: validation.payload.image,
      category: validation.payload.category,
    };

    const nextProducts = [product, ...state.products];
    setState((prev) => ({ ...prev, products: [product, ...prev.products] }));

    if (isSupabaseConfigured) {
      void supabase.from("products").upsert(nextProducts.map(productToRow), { onConflict: "id" }).then(({ error }) => {
        if (error) logRemoteError(error);
      });
    }

    return { ok: true, message: "Item added successfully.", product };
  };

  const updateProduct = (input: UpdateProductInput): AddProductResult => {
    const existing = state.products.find((product) => product.id === input.id);
    if (!existing) return { ok: false, message: "Item not found." };

    const validation = validateProductInput(
      {
        id: input.id,
        itemNumber: input.itemNumber,
        name: input.name,
        description: input.description,
        packSize: input.packSize,
        mrp: Number(input.mrp),
        srp: Number(input.srp),
        moq: Number(input.moq),
        category: input.category,
        image: input.image,
      },
      "update",
    );
    if (!validation.ok) return { ok: false, message: validation.message };

    const updated: Product = {
      id: input.id,
      itemNumber: validation.payload.itemNumber,
      name: validation.payload.name,
      description: validation.payload.description,
      mrp: validation.payload.mrp,
      srp: validation.payload.srp,
      moq: validation.payload.moq,
      packSize: validation.payload.packSize,
      image: validation.payload.image,
      category: validation.payload.category,
    };

    const nextProducts = state.products.map((product) => (product.id === updated.id ? updated : product));

    setState((prev) => ({
      ...prev,
      products: prev.products.map((product) => (product.id === updated.id ? updated : product)),
      orders: prev.orders.map((order) => ({
        ...order,
        items: order.items.map((item) =>
          item.productId === updated.id
            ? {
                ...item,
                itemNumber: updated.itemNumber,
                productName: updated.name,
                image: updated.image,
                packSize: updated.packSize,
              }
            : item,
        ),
      })),
    }));

    if (isSupabaseConfigured) {
      void supabase.from("products").upsert(nextProducts.map(productToRow), { onConflict: "id" }).then(({ error }) => {
        if (error) logRemoteError(error);
      });
    }

    return { ok: true, message: "Item updated successfully.", product: updated };
  };

  const deleteProduct = async (productId: string): Promise<DeleteProductResult> => {
    const target = state.products.find((product) => product.id === productId);
    if (!target) return { ok: false, message: "Item not found." };

    if (isSupabaseConfigured) {
      const { error: rulesError } = await supabase.from("price_rules").delete().eq("product_id", productId);
      if (rulesError) {
        return { ok: false, message: `Unable to remove pricing: ${rulesError.message}` };
      }
      const { error: productError } = await supabase.from("products").delete().eq("id", productId);
      if (productError) {
        return { ok: false, message: `Unable to remove item from cloud: ${productError.message}` };
      }
    }

    setState((prev) => ({
      ...prev,
      products: prev.products.filter((product) => product.id !== productId),
      priceRules: prev.priceRules.filter((rule) => rule.productId !== productId),
      orders: prev.orders.map((order) => ({
        ...order,
        items: order.items.filter((item) => item.productId !== productId),
      })),
    }));

    return { ok: true, message: `${target.name} deleted.` };
  };

  const addShop = (input: Omit<ShopContact, "id" | "createdAt">) => {
    const shop: ShopContact = {
      ...input,
      id: `shop-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, shops: [shop, ...prev.shops] }));

    if (isSupabaseConfigured) {
      void supabase.from("shops").upsert(shopToRow(shop), { onConflict: "id" }).then(({ error }) => {
        if (error) logRemoteError(error);
      });
    }

    return shop;
  };

  const upsertPriceRule = (shopId: string, productId: string, customPrice: number, offerText: string) => {
    const now = new Date().toISOString();
    const ruleId = `pr-${shopId}-${productId}`;
    const nextRule: PriceRule = {
      id: ruleId,
      shopId,
      productId,
      customPrice,
      offerText: offerText.trim(),
      updatedAt: now,
    };

    setState((prev) => {
      const existing = prev.priceRules.find((rule) => rule.shopId === shopId && rule.productId === productId);
      if (existing) {
        return {
          ...prev,
          priceRules: prev.priceRules.map((rule) => (rule.id === existing.id ? nextRule : rule)),
        };
      }
      return { ...prev, priceRules: [nextRule, ...prev.priceRules] };
    });

    if (isSupabaseConfigured) {
      void supabase
        .from("price_rules")
        .upsert(priceRuleToRow(nextRule), { onConflict: "shop_id,product_id" })
        .then(({ error }) => {
          if (error) logRemoteError(error);
        });
    }
  };

  const getRuleForShopProduct = (shopId: string, productId: string) =>
    state.priceRules.find((rule) => rule.shopId === shopId && rule.productId === productId);

  const resolvePrice = (shopId: string, productId: string, fallbackPrice: number) =>
    getRuleForShopProduct(shopId, productId)?.customPrice ?? fallbackPrice;

  const createOrder = async ({ shopId, quantities, paymentMethod, note }: CreateOrderPayload): Promise<CreateOrderResult> => {
    const shop = state.shops.find((item) => item.id === shopId);
    if (!shop) {
      return { ok: false, message: "Please select a valid shop contact first." };
    }

    const selected = state.products
      .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
      .filter(({ quantity }) => quantity > 0);

    if (selected.length === 0) {
      return { ok: false, message: "Select at least one item to create order." };
    }

    const lowMoqItem = selected.find(({ product, quantity }) => quantity < product.moq);
    if (lowMoqItem) {
      return {
        ok: false,
        message: `${lowMoqItem.product.name} minimum order is ${lowMoqItem.product.moq} units.`,
      };
    }

    const items = selected.map(({ product, quantity }) => {
      const unitPrice = resolvePrice(shopId, product.id, product.srp);
      return {
        productId: product.id,
        itemNumber: product.itemNumber,
        productName: product.name,
        image: product.image,
        packSize: product.packSize,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    let nextOrderId = getNextOrderId(state.orders);
    if (isSupabaseConfigured) {
      const { data: remoteOrderRows, error: remoteOrderError } = await supabase
        .from("orders")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (remoteOrderError) {
        return {
          ok: false,
          message: `Unable to fetch latest order number: ${remoteOrderError.message}`,
        };
      }
      const mergedIds = [...state.orders.map((order) => order.id), ...(remoteOrderRows ?? []).map((row) => String(row.id ?? ""))];
      nextOrderId = getNextOrderIdFromIds(mergedIds);
    }

    const order: OrderRecord = {
      id: nextOrderId,
      shopId: shop.id,
      shopName: shop.shopName,
      shopAddress: shop.address,
      ownerName: shop.ownerName,
      mobile: shop.mobile,
      paymentMethod,
      createdAt: new Date().toISOString(),
      status: "pending",
      items,
      subtotal,
      note: note.trim(),
    };

    if (isSupabaseConfigured) {
      const productRows = state.products.map(productToRow);
      const productIdMap = new Map<string, string>();
      for (const product of state.products) {
        productIdMap.set(product.id, product.id);
      }

      const { error: productSeedError } = await supabase.from("products").upsert(productRows, { onConflict: "id" });
      if (productSeedError) {
        const { data: remoteProducts, error: remoteProductsError } = await supabase
          .from("products")
          .select("id,item_number,name");
        if (remoteProductsError) {
          return {
            ok: false,
            message: `Unable to sync items for order: ${productSeedError.message}`,
          };
        }

        for (const { product } of selected) {
          const match = (remoteProducts ?? []).find(
            (remote) =>
              remote.id === product.id ||
              String(remote.item_number ?? "") === product.itemNumber ||
              String(remote.name ?? "").toLowerCase() === product.name.toLowerCase(),
          );
          if (!match?.id) {
            return {
              ok: false,
              message: `Item sync mismatch for "${product.name}". Refresh and try again.`,
            };
          }
          productIdMap.set(product.id, match.id);
        }
      }

      const { error: shopSeedError } = await supabase.from("shops").upsert(shopToRow(shop), { onConflict: "id" });
      if (shopSeedError) {
        return {
          ok: false,
          message: `Unable to sync shop for order: ${shopSeedError.message}`,
        };
      }

      const { error: orderError } = await supabase.from("orders").upsert(orderToRow(order), { onConflict: "id" });
      if (orderError) {
        return {
          ok: false,
          message: `Unable to save order: ${orderError.message}`,
        };
      }

      const { error: cleanupError } = await supabase.from("order_items").delete().eq("order_id", order.id);
      if (cleanupError) {
        return {
          ok: false,
          message: `Unable to prepare order items: ${cleanupError.message}`,
        };
      }

      const rows = orderItemRows(order).map((row) => ({
        ...row,
        product_id: productIdMap.get(row.product_id) ?? row.product_id,
      }));
      if (rows.length > 0) {
        const { error: itemError } = await supabase.from("order_items").insert(rows);
        if (itemError) {
          return {
            ok: false,
            message: `Unable to save order items: ${itemError.message}`,
          };
        }
      }
    }

    setState((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
    return { ok: true, message: "Order created successfully.", order };
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((order) => (order.id === orderId ? { ...order, status } : order)),
    }));

    if (isSupabaseConfigured) {
      void supabase.from("orders").update({ status }).eq("id", orderId).then(({ error }) => {
        if (error) logRemoteError(error);
      });
    }
  };

  const clearAllOrders = async (): Promise<ClearOrdersResult> => {
    if (isSupabaseConfigured) {
      const { error: itemError } = await supabase.from("order_items").delete().neq("id", "");
      if (itemError) {
        return { ok: false, message: `Unable to remove order items: ${itemError.message}` };
      }

      const { error: orderError } = await supabase.from("orders").delete().neq("id", "");
      if (orderError) {
        return { ok: false, message: `Unable to remove orders: ${orderError.message}` };
      }
    }

    setState((prev) => ({ ...prev, orders: [] }));
    return { ok: true, message: "All old bills/orders removed. New bills will start from 1." };
  };

  const value = useMemo<TobacoContextValue>(
    () => ({
      products: state.products,
      shops: state.shops,
      priceRules: state.priceRules,
      orders: state.orders,
      addProduct,
      updateProduct,
      deleteProduct,
      addShop,
      upsertPriceRule,
      getRuleForShopProduct,
      resolvePrice,
      createOrder,
      updateOrderStatus,
      clearAllOrders,
    }),
    [state.products, state.shops, state.priceRules, state.orders],
  );

  return <TobacoContext.Provider value={value}>{children}</TobacoContext.Provider>;
};

export const useTobaco = () => {
  const context = useContext(TobacoContext);
  if (!context) {
    throw new Error("useTobaco must be used inside TobacoProvider");
  }
  return context;
};
