export type PaymentMethod = "cash" | "online";
export type PaymentVerificationStatus = "cash" | "pending" | "verified" | "rejected";

export type OrderStatus = "pending" | "accepted" | "rejected";

export interface ShopContact {
  id: string;
  shopName: string;
  ownerName: string;
  mobile: string;
  whatsappNumber: string;
  area: string;
  address: string;
  createdAt: string;
}

export interface PriceRule {
  id: string;
  shopId: string;
  productId: string;
  customPrice: number;
  offerText: string;
  updatedAt: string;
}

export interface OrderLine {
  productId: string;
  itemNumber?: string;
  productName: string;
  image?: string;
  packSize: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderRecord {
  id: string;
  shopId: string;
  shopName: string;
  shopAddress?: string;
  ownerName: string;
  mobile: string;
  paymentMethod: PaymentMethod;
  paymentVerificationStatus: PaymentVerificationStatus;
  onlinePaymentReference: string;
  onlinePaymentNote: string;
  paymentVerificationNote: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderLine[];
  subtotal: number;
  note: string;
}
