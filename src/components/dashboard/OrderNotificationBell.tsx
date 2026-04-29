import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OrderNotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

interface OrderNotificationBellProps {
  scopeKey: string;
  items: OrderNotificationItem[];
}

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const OrderNotificationBell = ({ scopeKey, items }: OrderNotificationBellProps) => {
  const storageKey = `tobaco-notifications-read-${scopeKey}`;
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setReadIds([]);
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setReadIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadItems = useMemo(() => items.filter((item) => !readSet.has(item.id)), [items, readSet]);
  const unreadCount = unreadItems.length;

  const persistRead = (next: string[]) => {
    setReadIds(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const markAllRead = () => {
    persistRead(Array.from(new Set([...readIds, ...items.map((item) => item.id)])));
  };

  const markRead = (id: string) => {
    if (readSet.has(id)) return;
    persistRead([...readIds, id]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Order Notifications</span>
          {unreadItems.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={markAllRead}>
              Mark Read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {unreadItems.length === 0 ? (
          <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
        ) : (
          unreadItems.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={(event) => {
                event.preventDefault();
                markRead(item.id);
              }}
              className="flex flex-col items-start gap-1 py-2"
            >
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
              <div className="text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OrderNotificationBell;
