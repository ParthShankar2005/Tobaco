import { products, Product } from "@/data/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Printer, AlertCircle } from "lucide-react";

interface ShopDetails {
  shopName: string;
  ownerName: string;
  mobile: string;
  address: string;
  pinCode: string;
  paymentMethod: "cash" | "online";
}

interface OrderSummaryProps {
  quantities: Record<string, number>;
  shopDetails: ShopDetails;
  onGenerateBill: () => void;
}

const OrderSummary = ({ quantities, shopDetails, onGenerateBill }: OrderSummaryProps) => {
  const orderedProducts = products.filter((p) => quantities[p.id] > 0);
  
  const subtotal = orderedProducts.reduce(
    (sum, p) => sum + p.srp * quantities[p.id],
    0
  );
  
  const totalItems = orderedProducts.reduce(
    (sum, p) => sum + quantities[p.id],
    0
  );

  const isFormValid = 
    shopDetails.shopName.trim() !== "" &&
    shopDetails.ownerName.trim() !== "" &&
    shopDetails.mobile.length === 10 &&
    shopDetails.address.trim() !== "" &&
    shopDetails.pinCode.length === 6;

  const canPlaceOrder = orderedProducts.length > 0 && isFormValid;

  return (
    <Card className="sticky top-4">
      <CardHeader className="gradient-burgundy text-primary-foreground rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShoppingCart className="h-5 w-5" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {orderedProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No products selected</p>
            <p className="text-sm mt-1">Add products to start your order</p>
          </div>
        ) : (
          <>
            {/* Order Items */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {orderedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {quantities[product.id]} × ₹{product.srp}
                    </div>
                  </div>
                  <div className="font-bold text-primary">
                    ₹{quantities[product.id] * product.srp}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-semibold">{totalItems}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span className="text-primary">₹{subtotal}</span>
              </div>
            </div>

            {/* Validation Messages */}
            {!isFormValid && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Please fill in all shop details to generate bill</span>
              </div>
            )}

            {/* Generate Bill Button */}
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={onGenerateBill}
              disabled={!canPlaceOrder}
            >
              <Printer className="h-5 w-5 mr-2" />
              Generate Bill
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderSummary;
