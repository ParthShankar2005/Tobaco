import { Product } from "@/data/products";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface ProductCardProps {
  product: Product;
  quantity: number;
  onQuantityChange: (productId: string, quantity: number) => void;
}

const ProductCard = ({ product, quantity, onQuantityChange }: ProductCardProps) => {
  const handleIncrement = () => {
    if (quantity === 0) {
      onQuantityChange(product.id, product.moq);
    } else {
      onQuantityChange(product.id, quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity <= product.moq) {
      onQuantityChange(product.id, 0);
    } else {
      onQuantityChange(product.id, quantity - 1);
    }
  };

  const lineTotal = quantity * product.srp;

  return (
    <Card className="overflow-hidden group animate-fade-in">
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 right-3 bg-gold text-foreground px-3 py-1 rounded-full text-sm font-bold shadow-lg">
          ₹{product.srp}
        </div>
        {product.category === "cigarette" && (
          <div className="absolute top-3 left-3 gradient-burgundy text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
            Top Seller
          </div>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-serif text-xl font-bold text-foreground">
            {product.name}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            {product.description}
          </p>
        </div>
        
        {/* Price Info */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted rounded-lg p-2 text-center">
            <div className="text-muted-foreground text-xs">MRP</div>
            <div className="font-bold text-foreground">₹{product.mrp}</div>
          </div>
          <div className="bg-gold/10 rounded-lg p-2 text-center border border-gold/20">
            <div className="text-gold-dark text-xs">SRP</div>
            <div className="font-bold text-gold-dark">₹{product.srp}</div>
          </div>
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>MOQ: <span className="font-semibold text-foreground">{product.moq} units</span></span>
          <span>Pack: <span className="font-semibold text-foreground">{product.packSize}</span></span>
        </div>
        
        {/* Quantity Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleDecrement}
              disabled={quantity === 0}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-bold text-lg">{quantity}</span>
            <Button
              variant="gold"
              size="icon"
              className="h-8 w-8"
              onClick={handleIncrement}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {quantity > 0 && (
            <div className="text-right animate-scale-in">
              <div className="text-xs text-muted-foreground">Line Total</div>
              <div className="font-bold text-lg text-primary">₹{lineTotal}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
