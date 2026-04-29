import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, MapPin, Phone, CreditCard } from "lucide-react";

interface ShopDetails {
  shopName: string;
  ownerName: string;
  mobile: string;
  address: string;
  pinCode: string;
  paymentMethod: "cash" | "online";
}

interface OrderFormProps {
  shopDetails: ShopDetails;
  onDetailsChange: (details: ShopDetails) => void;
}

const OrderForm = ({ shopDetails, onDetailsChange }: OrderFormProps) => {
  const handleChange = (field: keyof ShopDetails, value: string) => {
    onDetailsChange({ ...shopDetails, [field]: value });
  };

  return (
    <Card className="sticky top-4">
      <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Store className="h-5 w-5" />
          Shop Details
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Shop Name */}
        <div className="space-y-2">
          <Label htmlFor="shopName" className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            Shop Name *
          </Label>
          <Input
            id="shopName"
            placeholder="Enter your shop name"
            value={shopDetails.shopName}
            onChange={(e) => handleChange("shopName", e.target.value)}
            className="border-2 focus:border-primary"
          />
        </div>

        {/* Owner Name */}
        <div className="space-y-2">
          <Label htmlFor="ownerName">Owner Name *</Label>
          <Input
            id="ownerName"
            placeholder="Enter owner name"
            value={shopDetails.ownerName}
            onChange={(e) => handleChange("ownerName", e.target.value)}
            className="border-2 focus:border-primary"
          />
        </div>

        {/* Mobile */}
        <div className="space-y-2">
          <Label htmlFor="mobile" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Mobile Number *
          </Label>
          <Input
            id="mobile"
            type="tel"
            placeholder="Enter 10-digit mobile number"
            value={shopDetails.mobile}
            onChange={(e) => handleChange("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="border-2 focus:border-primary"
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Full Address *
          </Label>
          <Textarea
            id="address"
            placeholder="Enter complete delivery address"
            value={shopDetails.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="border-2 focus:border-primary resize-none"
            rows={3}
          />
        </div>

        {/* Pin Code */}
        <div className="space-y-2">
          <Label htmlFor="pinCode">Pin Code *</Label>
          <Input
            id="pinCode"
            placeholder="Enter 6-digit pin code"
            value={shopDetails.pinCode}
            onChange={(e) => handleChange("pinCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="border-2 focus:border-primary"
          />
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Payment Method *
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChange("paymentMethod", "cash")}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                shopDetails.paymentMethod === "cash"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="text-2xl mb-1">💵</div>
              <div className="font-semibold">Cash</div>
              <div className="text-xs text-muted-foreground">Pay on Delivery</div>
            </button>
            <button
              type="button"
              onClick={() => handleChange("paymentMethod", "online")}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                shopDetails.paymentMethod === "online"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="text-2xl mb-1">📱</div>
              <div className="font-semibold">Online</div>
              <div className="text-xs text-muted-foreground">UPI / Bank Transfer</div>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderForm;
