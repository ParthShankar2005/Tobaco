import { useRef } from "react";
import { products } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, X, Download } from "lucide-react";

interface ShopDetails {
  shopName: string;
  ownerName: string;
  mobile: string;
  address: string;
  pinCode: string;
  paymentMethod: "cash" | "online";
}

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  quantities: Record<string, number>;
  shopDetails: ShopDetails;
}

const BillModal = ({ isOpen, onClose, quantities, shopDetails }: BillModalProps) => {
  const billRef = useRef<HTMLDivElement>(null);
  
  const orderedProducts = products.filter((p) => quantities[p.id] > 0);
  const subtotal = orderedProducts.reduce(
    (sum, p) => sum + p.srp * quantities[p.id],
    0
  );
  const totalItems = orderedProducts.reduce(
    (sum, p) => sum + quantities[p.id],
    0
  );

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = currentDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const billNumber = `TOB-${Date.now().toString().slice(-8)}`;

  const handlePrint = () => {
    const printContent = billRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TOBACO Invoice - ${billNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .bill { max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #6B1F3D; padding-bottom: 15px; margin-bottom: 15px; }
            .logo { font-size: 28px; font-weight: bold; color: #6B1F3D; }
            .tagline { font-size: 10px; color: #888; letter-spacing: 2px; }
            .bill-info { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 15px; }
            .shop-details { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 12px; }
            .shop-name { font-size: 16px; font-weight: bold; color: #6B1F3D; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            th { background: #6B1F3D; color: white; padding: 8px 4px; text-align: left; }
            td { padding: 8px 4px; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; background: #f9f9f9; }
            .grand-total { font-size: 16px; color: #6B1F3D; border-top: 2px solid #6B1F3D; padding-top: 10px; }
            .footer { text-align: center; font-size: 11px; color: #888; border-top: 2px dashed #6B1F3D; padding-top: 15px; margin-top: 15px; }
            .payment-badge { display: inline-block; background: #D4AF37; color: #333; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 11px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Bill Content */}
        <div ref={billRef} className="bill bg-card p-6 rounded-lg border">
          {/* Header */}
          <div className="header text-center border-b-2 border-dashed border-primary pb-4 mb-4">
            <div className="logo text-3xl font-serif font-bold text-primary">
              TOBACO
            </div>
            <div className="tagline text-xs text-muted-foreground tracking-widest mt-1">
              LICENSED TRADE SUPPLY
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              By Tobaco Distribution Network
            </div>
          </div>

          {/* Bill Info */}
          <div className="bill-info flex justify-between text-sm mb-4">
            <div>
              <div className="text-muted-foreground">Bill No:</div>
              <div className="font-bold">{billNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Date & Time:</div>
              <div className="font-bold">{formattedDate}, {formattedTime}</div>
            </div>
          </div>

          {/* Shop Details */}
          <div className="shop-details bg-muted p-4 rounded-lg mb-4">
            <div className="shop-name text-lg font-bold text-primary mb-2">
              {shopDetails.shopName}
            </div>
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Owner:</span> {shopDetails.ownerName}</div>
              <div><span className="text-muted-foreground">Mobile:</span> {shopDetails.mobile}</div>
              <div><span className="text-muted-foreground">Address:</span> {shopDetails.address}</div>
              <div><span className="text-muted-foreground">Pin Code:</span> {shopDetails.pinCode}</div>
            </div>
            <div className="mt-3">
              <span className="payment-badge inline-block bg-gold px-3 py-1 rounded-full text-xs font-bold">
                Payment: {shopDetails.paymentMethod === "cash" ? "Cash on Delivery" : "Online Payment"}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="gradient-burgundy text-primary-foreground">
                <th className="p-2 text-left rounded-tl-lg">Item</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-center">SRP</th>
                <th className="p-2 text-right rounded-tr-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderedProducts.map((product) => (
                <tr key={product.id} className="border-b border-border">
                  <td className="p-2">
                    <div className="font-semibold">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.packSize}</div>
                  </td>
                  <td className="p-2 text-center">{quantities[product.id]}</td>
                  <td className="p-2 text-center">₹{product.srp}</td>
                  <td className="p-2 text-right font-semibold">
                    ₹{quantities[product.id] * product.srp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-primary pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Items:</span>
              <span className="font-semibold">{totalItems}</span>
            </div>
            <div className="grand-total flex justify-between text-xl font-bold text-primary">
              <span>Grand Total:</span>
              <span>₹{subtotal}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="footer text-center text-xs text-muted-foreground border-t-2 border-dashed border-primary pt-4 mt-4">
            <p className="font-semibold">Thank you for your order!</p>
            <p className="mt-1">For queries, contact your distributor</p>
            <p className="mt-2 font-bold text-primary">TOBACO - Wholesale Tobacco Items</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 no-print">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button variant="gold" className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillModal;
