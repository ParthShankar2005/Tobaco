import { NavLink } from "@/components/NavLink";
import { useRoleAuth } from "@/auth/roleAuth";
import OrderNotificationBell, { OrderNotificationItem } from "@/components/dashboard/OrderNotificationBell";
import ProfileCircleMenu from "@/components/dashboard/ProfileCircleMenu";
import { useTobaco } from "./state";
import { Database, LayoutDashboard, Package, ReceiptText, Users2 } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";

const navBaseClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors border border-transparent hover:bg-primary/10";
const navActiveClass = "bg-primary text-primary-foreground";

const TobacoLayout = () => {
  const { session, logout } = useRoleAuth();
  const { orders } = useTobaco();
  const navigate = useNavigate();

  const handleLogout = () => {
    const role = session?.role;
    logout();
    navigate(role === "admin" ? "/admin-login" : "/shopkeeper-login");
  };

  const storageSizeKb = Math.max(1, Math.round(JSON.stringify(orders).length / 1024));

  const notificationScope = session ? `${session.role}:${session.username}` : "guest";
  const notifications = orders
    .filter((order) => (session?.role === "admin" ? true : order.shopId === session?.shopId))
    .flatMap<OrderNotificationItem>((order) => {
      if (session?.role === "admin") {
        if (order.status === "pending") {
          return [
            {
              id: `${order.id}:pending`,
              title: `Pending: ${order.id}`,
              description: `${order.shopName} | ₹${order.subtotal}`,
              createdAt: order.createdAt,
            },
          ];
        }
        if (order.status === "rejected") {
          return [
            {
              id: `${order.id}:cancelled`,
              title: `Cancelled: ${order.id}`,
              description: `${order.shopName} order cancelled`,
              createdAt: order.createdAt,
            },
          ];
        }
        return [];
      }

      if (order.status === "accepted") {
        return [
          {
            id: `${order.id}:accepted`,
            title: `Accepted: ${order.id}`,
            description: "Distributor accepted your order.",
            createdAt: order.createdAt,
          },
        ];
      }
      if (order.status === "rejected") {
        return [
          {
            id: `${order.id}:cancelled`,
            title: `Cancelled: ${order.id}`,
            description: "Distributor cancelled/rejected your order.",
            createdAt: order.createdAt,
          },
        ];
      }
      if (order.status === "pending") {
        return [
          {
            id: `${order.id}:pending`,
            title: `Pending: ${order.id}`,
            description: "Your order is pending distributor approval.",
            createdAt: order.createdAt,
          },
        ];
      }
      return [];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside className="gradient-burgundy sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-primary-foreground/10 p-4 text-primary-foreground lg:flex">
          <div className="mb-6 border-b border-primary-foreground/20 pb-4">
            <h1 className="font-serif text-2xl font-bold">TOBACO</h1>
            <p className="text-xs opacity-80">{session?.role === "admin" ? "Distributor Dashboard" : "Shopkeeper Dashboard"}</p>
          </div>

          <nav className="space-y-2 overflow-y-auto pr-1">
            {session?.role === "admin" && (
              <>
                <NavLink to="/distributor/dashboard" className={navBaseClass} activeClassName={navActiveClass}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </NavLink>
                <NavLink to="/distributor/orders" className={navBaseClass} activeClassName={navActiveClass}>
                  <ReceiptText className="h-4 w-4" />
                  Order
                </NavLink>
                <NavLink to="/distributor/items" className={navBaseClass} activeClassName={navActiveClass}>
                  <Package className="h-4 w-4" />
                  Items
                </NavLink>
                <NavLink to="/distributor/bills" className={navBaseClass} activeClassName={navActiveClass}>
                  <ReceiptText className="h-4 w-4" />
                  Bill
                </NavLink>
                <NavLink to="/distributor/sheets" className={navBaseClass} activeClassName={navActiveClass}>
                  <Database className="h-4 w-4" />
                  Order Sheets
                </NavLink>
                <NavLink to="/distributor/users" className={navBaseClass} activeClassName={navActiveClass}>
                  <Users2 className="h-4 w-4" />
                  Users
                </NavLink>
                <NavLink to="/distributor/shops" className={navBaseClass} activeClassName={navActiveClass}>
                  <Users2 className="h-4 w-4" />
                  Shop Management
                </NavLink>
              </>
            )}

            {session?.role === "shopkeeper" && (
              <>
                <NavLink to="/shopkeeper/items" className={navBaseClass} activeClassName={navActiveClass}>
                  <Package className="h-4 w-4" />
                  Items
                </NavLink>
                <NavLink to="/shopkeeper/orders" className={navBaseClass} activeClassName={navActiveClass}>
                  <ReceiptText className="h-4 w-4" />
                  My Orders
                </NavLink>
              </>
            )}
          </nav>

        </aside>

        <div className="min-w-0 flex-1 p-4 lg:p-8">
          <div className="mb-4 rounded-lg gradient-burgundy p-3 text-primary-foreground lg:hidden">
            <div className="text-sm font-semibold">TOBACO Dashboard</div>
            <div className="text-xs opacity-80">Use desktop view for full sidebar navigation.</div>
          </div>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground">TOBACO Control Center</h2>
              <p className="text-sm text-muted-foreground">
                Items, users, shops, bills, orders and order-sheet workflow in one dashboard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <OrderNotificationBell scopeKey={notificationScope} items={notifications} />
              <ProfileCircleMenu onLogout={handleLogout} orderCount={orders.length} storageSizeKb={storageSizeKb} />
            </div>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default TobacoLayout;
