import { useState } from "react";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import OrderForm from "@/components/OrderForm";
import OrderSummary from "@/components/OrderSummary";
import BillModal from "@/components/BillModal";
import { products } from "@/data/products";
import { useToast } from "@/hooks/use-toast";
import { Package, Phone, Mail, MapPin } from "lucide-react";

interface ShopDetails {
  shopName: string;
  ownerName: string;
  mobile: string;
  address: string;
  pinCode: string;
  paymentMethod: "cash" | "online";
}

const Index = () => {
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [shopDetails, setShopDetails] = useState<ShopDetails>({
    shopName: "",
    ownerName: "",
    mobile: "",
    address: "",
    pinCode: "",
    paymentMethod: "cash",
  });
  const [isBillOpen, setIsBillOpen] = useState(false);

  const handleQuantityChange = (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (quantity > 0 && quantity < product.moq) {
      toast({
        title: "Minimum Order Quantity",
        description: `Minimum order quantity for ${product.name} is ${product.moq} units`,
        variant: "destructive",
      });
      return;
    }

    setQuantities((prev) => ({ ...prev, [productId]: quantity }));
    
    if (quantity > 0) {
      toast({
        title: "Added to order",
        description: `${quantity} × ${product.name} added`,
      });
    }
  };

  const handleGenerateBill = () => {
    setIsBillOpen(true);
    toast({
      title: "Bill Generated",
      description: "Your invoice is ready to print",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Product Catalog Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Package className="h-8 w-8 text-primary" />
            <h2 className="font-serif text-3xl font-bold text-foreground">
              Tobacco Item Catalog
            </h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Select items and quantities. All prices shown are distributor selling rates for shop buyers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantities[product.id] || 0}
                onQuantityChange={handleQuantityChange}
              />
            ))}
          </div>
        </section>

        {/* Order Section */}
        <section className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <OrderForm
              shopDetails={shopDetails}
              onDetailsChange={setShopDetails}
            />
          </div>
          <div>
            <OrderSummary
              quantities={quantities}
              shopDetails={shopDetails}
              onGenerateBill={handleGenerateBill}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="gradient-burgundy text-primary-foreground mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="font-serif text-2xl font-bold mb-2">TOBACO</div>
              <div className="text-xs tracking-widest opacity-80 mb-4">
                LICENSED TRADE SUPPLY
              </div>
              <p className="text-sm opacity-80">
                Wholesale tobacco inventory for distributors and retail shop buyers.
                Licensed sale channels only.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Contact Distributor</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gold" />
                  <span>+91 XXXXX XXXXX</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gold" />
                  <span>orders@tobaco-trade.com</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-gold mt-1" />
                  <span>Tobaco Distribution Network<br />India</span>
                </div>
              </div>
            </div>

            {/* Available Regions */}
            <div>
              <h3 className="font-semibold text-lg mb-4">We Deliver To</h3>
              <div className="grid grid-cols-2 gap-2 text-sm opacity-80">
                <span>West Bengal</span>
                <span>Maharashtra</span>
                <span>Delhi</span>
                <span>Uttar Pradesh</span>
                <span>Bihar</span>
                <span>Jharkhand</span>
                <span>Punjab</span>
                <span>Assam</span>
              </div>
            </div>
          </div>

          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm opacity-60">
            © 2026 TOBACO Distribution Portal. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Bill Modal */}
      <BillModal
        isOpen={isBillOpen}
        onClose={() => setIsBillOpen(false)}
        quantities={quantities}
        shopDetails={shopDetails}
      />
    </div>
  );
};

export default Index;
