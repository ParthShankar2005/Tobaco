import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRoleAuth, UserProfile } from "@/auth/roleAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTobaco } from "../../../state";
import { LogOut, Settings } from "lucide-react";

interface ProfileCircleMenuProps {
  onLogout: () => void;
  orderCount: number;
  storageSizeKb: number;
}

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
};

const ProfileCircleMenu = ({ onLogout, orderCount, storageSizeKb }: ProfileCircleMenuProps) => {
  const { toast } = useToast();
  const { session, getCurrentUserProfile, saveCurrentUserProfile, changeCurrentUserPassword } = useRoleAuth();
  const { shops } = useTobaco();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState<Omit<UserProfile, "updatedAt">>({
    businessName: "",
    ownerName: "",
    gstNumber: "",
    mobileNumber: "",
    whatsappNumber: "",
    address: "",
    email: "",
    logoDataUrl: "",
    billPrintSettings: {
      billTitle: "TOBACO",
      showGstNumber: true,
      showMobile: true,
      showWhatsapp: true,
      showAddress: true,
      showShopAddress: true,
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const profile = useMemo(() => getCurrentUserProfile(), [getCurrentUserProfile, session?.username, session?.role]);
  const mappedShop = useMemo(
    () => (session?.role === "shopkeeper" ? shops.find((shop) => shop.id === session.shopId) : null),
    [shops, session?.role, session?.shopId],
  );

  const fillFormFromCurrentProfile = () => {
    const currentProfile = getCurrentUserProfile();
    const currentMappedShop =
      session?.role === "shopkeeper" ? shops.find((shop) => shop.id === session.shopId) : null;
    const fallbackBusinessName =
      currentProfile.businessName || currentMappedShop?.shopName || session?.displayName || "";
    const fallbackOwnerName =
      currentProfile.ownerName || currentMappedShop?.ownerName || session?.displayName || "";
    const fallbackMobileNumber =
      currentProfile.mobileNumber || currentMappedShop?.mobile || "";
    const fallbackWhatsappNumber =
      currentProfile.whatsappNumber || currentMappedShop?.whatsappNumber || currentMappedShop?.mobile || "";
    const fallbackAddress = currentProfile.address || currentMappedShop?.address || "";

    setForm({
      businessName: fallbackBusinessName,
      ownerName: fallbackOwnerName,
      gstNumber: currentProfile.gstNumber,
      mobileNumber: fallbackMobileNumber,
      whatsappNumber: fallbackWhatsappNumber,
      address: fallbackAddress,
      email: currentProfile.email,
      logoDataUrl: currentProfile.logoDataUrl,
      billPrintSettings: currentProfile.billPrintSettings,
    });
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  useEffect(() => {
    if (!settingsOpen) return;
    fillFormFromCurrentProfile();
    // Initialize form only when opening the dialog/user context changes.
    // Avoid continuous resets while user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, session?.username, session?.role]);

  const handleSave = () => {
    if (!form.businessName.trim() || !form.ownerName.trim()) {
      toast({
        title: "Missing details",
        description: "Business name and owner name are required.",
        variant: "destructive",
      });
      return;
    }

    saveCurrentUserProfile({
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      gstNumber: form.gstNumber.trim(),
      mobileNumber: form.mobileNumber.replace(/\D/g, "").slice(0, 10),
      whatsappNumber: form.whatsappNumber.replace(/\D/g, "").slice(0, 10),
      address: form.address.trim(),
      email: form.email.trim(),
      logoDataUrl: form.logoDataUrl,
      billPrintSettings: {
        ...form.billPrintSettings,
        billTitle: form.billPrintSettings.billTitle.trim() || "TOBACO",
      },
    });

    const wantsPasswordChange =
      passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword;

    if (wantsPasswordChange) {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        toast({
          title: "Password update failed",
          description: "Fill current, new, and confirm password fields.",
          variant: "destructive",
        });
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast({
          title: "Password update failed",
          description: "New password and confirm password do not match.",
          variant: "destructive",
        });
        return;
      }

      const passwordResult = changeCurrentUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (!passwordResult.ok) {
        toast({
          title: "Password update failed",
          description: passwordResult.message,
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Settings saved",
      description: wantsPasswordChange ? "Profile and password updated successfully." : "Profile updated successfully.",
    });
    setSettingsOpen(false);
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file for logo.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, logoDataUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border bg-card px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {initialsFromName(profile.ownerName || session?.displayName || "User")}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold leading-none">{session?.displayName}</div>
              <div className="mt-1 text-[11px] text-muted-foreground capitalize">{session?.role}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{session?.displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              fillFormFromCurrentProfile();
              setSettingsOpen(true);
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onLogout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>
              Fill GST, name, number, and address details for invoice and business records.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={form.businessName}
                onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
                placeholder="Tobaco Distribution Network"
              />
            </div>
            <div className="space-y-2">
              <Label>Owner / Contact Name</Label>
              <Input
                value={form.ownerName}
                onChange={(event) => setForm((prev) => ({ ...prev, ownerName: event.target.value }))}
                placeholder="Owner name"
              />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input
                value={form.gstNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, gstNumber: event.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                value={form.mobileNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, mobileNumber: event.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                placeholder="10-digit mobile"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input
                value={form.whatsappNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, whatsappNumber: event.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                placeholder="10-digit WhatsApp"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="example@domain.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                rows={3}
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Complete business address"
              />
            </div>
            {session?.role === "admin" && (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Shop Logo (for bill print)</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                  <p className="text-xs text-muted-foreground">
                    Auto-fit logo on bill. Recommended around 100px x 100px.
                  </p>
                  {form.logoDataUrl && (
                    <img
                      src={form.logoDataUrl}
                      alt="Logo preview"
                      className="h-16 w-16 rounded-md border object-contain bg-white"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Bill Title</Label>
                  <Input
                    value={form.billPrintSettings.billTitle}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        billPrintSettings: { ...prev.billPrintSettings, billTitle: event.target.value },
                      }))
                    }
                    placeholder="TOBACO"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Print Fields</Label>
                  <div className="space-y-2 rounded-md border p-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.billPrintSettings.showGstNumber}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            billPrintSettings: { ...prev.billPrintSettings, showGstNumber: event.target.checked },
                          }))
                        }
                      />
                      Show GST Number
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.billPrintSettings.showMobile}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            billPrintSettings: { ...prev.billPrintSettings, showMobile: event.target.checked },
                          }))
                        }
                      />
                      Show Mobile
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.billPrintSettings.showWhatsapp}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            billPrintSettings: { ...prev.billPrintSettings, showWhatsapp: event.target.checked },
                          }))
                        }
                      />
                      Show WhatsApp
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.billPrintSettings.showAddress}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            billPrintSettings: { ...prev.billPrintSettings, showAddress: event.target.checked },
                          }))
                        }
                      />
                      Show Distributor Address
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.billPrintSettings.showShopAddress}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            billPrintSettings: { ...prev.billPrintSettings, showShopAddress: event.target.checked },
                          }))
                        }
                      />
                      Show Shop Address on Label
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Change Password</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  placeholder="Current password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  placeholder="New password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  placeholder="Confirm password"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div>Storage: Local browser + Supabase sync</div>
            <div>Saved bills/orders: {orderCount}</div>
            <div>DB size: {storageSizeKb} KB</div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSave}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileCircleMenu;
