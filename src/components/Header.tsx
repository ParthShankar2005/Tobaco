const Header = () => {
  return (
    <header className="gradient-hero text-primary-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Logo */}
          <div className="bg-cream rounded-full p-4 shadow-lg">
            <div className="text-foreground font-serif font-bold text-2xl md:text-3xl tracking-wider">
              TOBACO
            </div>
            <div className="text-xs text-muted-foreground tracking-widest">
              LICENSED TRADE SUPPLY
            </div>
          </div>
          
          {/* Title */}
          <h1 className="font-serif text-3xl md:text-5xl font-bold mt-4">
            Distributor Order Portal
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-2xl">
            Wholesale Tobacco Items for Distributors and Shop Buyers
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm md:text-base">
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-full">
              <span className="text-gold font-bold">Wholesale</span>
              <span className="text-primary-foreground/70">Rates</span>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-full">
              <span className="text-gold font-bold">MOQ Based</span>
              <span className="text-primary-foreground/70">Ordering</span>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-full">
              <span className="text-gold font-bold">Licensed</span>
              <span className="text-primary-foreground/70">Retail Trade</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
