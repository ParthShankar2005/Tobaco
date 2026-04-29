import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export type AuthRole = "admin" | "shopkeeper";

export interface BillPrintSettings {
  billTitle: string;
  showGstNumber: boolean;
  showMobile: boolean;
  showWhatsapp: boolean;
  showAddress: boolean;
  showShopAddress: boolean;
}

interface AuthSession {
  role: AuthRole;
  username: string;
  displayName: string;
  shopId?: string;
  loginAt: string;
}

export interface UserProfile {
  businessName: string;
  ownerName: string;
  gstNumber: string;
  mobileNumber: string;
  whatsappNumber: string;
  address: string;
  email: string;
  logoDataUrl: string;
  billPrintSettings: BillPrintSettings;
  updatedAt: string;
}

interface LoginResult {
  ok: boolean;
  message: string;
}

interface ChangePasswordResult {
  ok: boolean;
  message: string;
}

interface CreateShopkeeperLoginPayload {
  shopId: string;
  username: string;
  password: string;
  displayName: string;
  useGstBill: boolean;
}

interface CreateShopkeeperLoginResult {
  ok: boolean;
  message: string;
}

interface ResetShopkeeperPasswordResult {
  ok: boolean;
  message: string;
}

interface UpdateShopkeeperAccountPayload {
  accountId: string;
  shopId: string;
  username: string;
  displayName: string;
  active: boolean;
  useGstBill: boolean;
}

interface UpdateShopkeeperAccountResult {
  ok: boolean;
  message: string;
}

interface DeleteShopkeeperAccountResult {
  ok: boolean;
  message: string;
}

interface AdminAuth {
  username: string;
  password: string;
  displayName: string;
}

export interface ShopkeeperAccount {
  id: string;
  shopId: string;
  username: string;
  password: string;
  displayName: string;
  active: boolean;
  useGstBill: boolean;
  createdAt: string;
}

interface RoleAuthContextValue {
  session: AuthSession | null;
  shopkeeperAccounts: ShopkeeperAccount[];
  getDistributorProfile: () => UserProfile;
  getCurrentUserProfile: () => UserProfile;
  getProfileForUser: (role: AuthRole, username: string) => UserProfile;
  getShopkeeperAccount: (username: string) => ShopkeeperAccount | undefined;
  saveCurrentUserProfile: (profile: Omit<UserProfile, "updatedAt">) => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => ChangePasswordResult;
  resetShopkeeperPassword: (accountId: string, newPassword: string) => ResetShopkeeperPasswordResult;
  updateShopkeeperAccount: (payload: UpdateShopkeeperAccountPayload) => UpdateShopkeeperAccountResult;
  deleteShopkeeperAccount: (accountId: string) => DeleteShopkeeperAccountResult;
  login: (role: AuthRole, username: string, password: string) => LoginResult;
  createShopkeeperLogin: (payload: CreateShopkeeperLoginPayload) => CreateShopkeeperLoginResult;
  logout: () => void;
}

interface RequireRoleProps {
  allowedRoles: AuthRole[];
}

interface AdminAuthRow {
  id: string;
  username: string;
  password: string;
  display_name: string;
  updated_at: string;
}

interface ShopkeeperAccountRow {
  id: string;
  shop_id: string;
  username: string;
  password: string;
  display_name: string;
  active: boolean;
  use_gst_bill: boolean | null;
  created_at: string;
}

interface UserProfileRow {
  role: AuthRole;
  username: string;
  business_name: string;
  owner_name: string;
  gst_number: string;
  mobile_number: string;
  whatsapp_number: string;
  address: string;
  email: string;
  logo_data_url: string | null;
  settings_json: Record<string, unknown> | null;
  updated_at: string;
}

interface RemoteAuthState {
  adminAuth: AdminAuth;
  shopkeeperAccounts: ShopkeeperAccount[];
  profiles: Record<string, UserProfile>;
}

const SESSION_STORAGE_KEY = "tobaco-role-auth-v1";
const SHOPKEEPER_ACCOUNTS_STORAGE_KEY = "tobaco-shopkeeper-accounts-v1";
const USER_PROFILES_STORAGE_KEY = "tobaco-user-profiles-v1";
const ADMIN_AUTH_STORAGE_KEY = "tobaco-admin-auth-v1";
const AUTH_SYNC_INTERVAL_MS = 3000;
const ADMIN_AUTH_ROW_ID = "admin";

let hasLoggedAuthRemoteError = false;

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const defaultBillPrintSettings = (): BillPrintSettings => ({
  billTitle: "TOBACO",
  showGstNumber: true,
  showMobile: true,
  showWhatsapp: true,
  showAddress: true,
  showShopAddress: true,
});

const defaultAdminAuth = (): AdminAuth => ({
  username: "distributor",
  password: "dist@123",
  displayName: "Distributor Admin",
});

const defaultShopkeeperAccounts = (): ShopkeeperAccount[] => [
  {
    id: "acc-shop-001",
    shopId: "shop-001",
    username: "shopkeeper",
    password: "shop@123",
    displayName: "Maa Tara Pan Shop",
    active: true,
    useGstBill: true,
    createdAt: new Date().toISOString(),
  },
];

const defaultAdminProfile = (): UserProfile => ({
  businessName: "Tobaco Distribution Network",
  ownerName: "Distributor Admin",
  gstNumber: "",
  mobileNumber: "",
  whatsappNumber: "",
  address: "",
  email: "",
  logoDataUrl: "",
  billPrintSettings: defaultBillPrintSettings(),
  updatedAt: new Date().toISOString(),
});

const defaultShopkeeperProfile = (displayName = ""): UserProfile => ({
  businessName: displayName,
  ownerName: displayName,
  gstNumber: "",
  mobileNumber: "",
  whatsappNumber: "",
  address: "",
  email: "",
  logoDataUrl: "",
  billPrintSettings: defaultBillPrintSettings(),
  updatedAt: new Date().toISOString(),
});

const profileStorageKey = (role: AuthRole, username: string) => `${role}:${normalizeUsername(username)}`;

const defaultRouteForRole = (role: AuthRole) => {
  if (role === "admin") return "/distributor";
  return "/shopkeeper";
};

const loadSession = (): AuthSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.role || !parsed.username || !parsed.displayName || !parsed.loginAt) return null;
    return {
      role: parsed.role,
      username: parsed.username,
      displayName: parsed.displayName,
      shopId: parsed.shopId,
      loginAt: parsed.loginAt,
    };
  } catch {
    return null;
  }
};

const loadAdminAuth = (): AdminAuth => {
  if (typeof window === "undefined") return defaultAdminAuth();
  try {
    const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return defaultAdminAuth();
    const parsed = JSON.parse(raw) as Partial<AdminAuth>;
    if (!parsed.username || !parsed.password || !parsed.displayName) return defaultAdminAuth();
    return {
      username: parsed.username,
      password: parsed.password,
      displayName: parsed.displayName,
    };
  } catch {
    return defaultAdminAuth();
  }
};

const loadShopkeeperAccounts = (): ShopkeeperAccount[] => {
  if (typeof window === "undefined") return defaultShopkeeperAccounts();
  try {
    const raw = window.localStorage.getItem(SHOPKEEPER_ACCOUNTS_STORAGE_KEY);
    if (!raw) return defaultShopkeeperAccounts();
    const parsed = JSON.parse(raw) as ShopkeeperAccount[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultShopkeeperAccounts();
    return parsed.map((item) => ({
      ...item,
      useGstBill: item.useGstBill ?? true,
    }));
  } catch {
    return defaultShopkeeperAccounts();
  }
};

const loadProfiles = (): Record<string, UserProfile> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, UserProfile>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const adminAuthToRow = (value: AdminAuth): AdminAuthRow => ({
  id: ADMIN_AUTH_ROW_ID,
  username: normalizeUsername(value.username),
  password: value.password,
  display_name: value.displayName,
  updated_at: new Date().toISOString(),
});

const adminAuthFromRow = (row: AdminAuthRow): AdminAuth => ({
  username: row.username,
  password: row.password,
  displayName: row.display_name,
});

const shopkeeperAccountToRow = (value: ShopkeeperAccount): ShopkeeperAccountRow => ({
  id: value.id,
  shop_id: value.shopId,
  username: normalizeUsername(value.username),
  password: value.password,
  display_name: value.displayName,
  active: value.active,
  use_gst_bill: value.useGstBill,
  created_at: value.createdAt,
});

const shopkeeperAccountFromRow = (row: ShopkeeperAccountRow): ShopkeeperAccount => ({
  id: row.id,
  shopId: row.shop_id,
  username: row.username,
  password: row.password,
  displayName: row.display_name,
  active: row.active,
  useGstBill: row.use_gst_bill ?? true,
  createdAt: row.created_at,
});

const profileToRow = (role: AuthRole, username: string, profile: UserProfile): UserProfileRow => ({
  role,
  username: normalizeUsername(username),
  business_name: profile.businessName,
  owner_name: profile.ownerName,
  gst_number: profile.gstNumber,
  mobile_number: profile.mobileNumber,
  whatsapp_number: profile.whatsappNumber,
  address: profile.address,
  email: profile.email,
  logo_data_url: profile.logoDataUrl,
  settings_json: profile.billPrintSettings,
  updated_at: profile.updatedAt,
});

const profileFromRow = (row: UserProfileRow): UserProfile => ({
  businessName: row.business_name,
  ownerName: row.owner_name,
  gstNumber: row.gst_number,
  mobileNumber: row.mobile_number,
  whatsappNumber: row.whatsapp_number,
  address: row.address,
  email: row.email,
  logoDataUrl: row.logo_data_url ?? "",
  billPrintSettings: {
    ...defaultBillPrintSettings(),
    ...(row.settings_json ?? {}),
  } as BillPrintSettings,
  updatedAt: row.updated_at,
});

const rowsToProfiles = (rows: UserProfileRow[]) =>
  rows.reduce<Record<string, UserProfile>>((acc, row) => {
    acc[profileStorageKey(row.role, row.username)] = profileFromRow(row);
    return acc;
  }, {});

const profilesToRows = (profiles: Record<string, UserProfile>) =>
  Object.entries(profiles)
    .map(([key, profile]) => {
      const [role, username] = key.split(":");
      if ((role !== "admin" && role !== "shopkeeper") || !username) return null;
      return profileToRow(role as AuthRole, username, profile);
    })
    .filter((row): row is UserProfileRow => row !== null);

const areEqual = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
const parseTimestamp = (value: string | undefined) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const logAuthRemoteError = (error: unknown) => {
  if (hasLoggedAuthRemoteError) return;
  hasLoggedAuthRemoteError = true;
  console.warn("Supabase auth sync unavailable. Using local storage fallback.", error);
};

const fetchRemoteAuthState = async (): Promise<RemoteAuthState | null> => {
  if (!isSupabaseConfigured) return null;

  const [adminRes, accountsRes, profilesRes] = await Promise.all([
    supabase.from("admin_auth").select("*").limit(1),
    supabase.from("shopkeeper_accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("*"),
  ]);

  if (adminRes.error || accountsRes.error || profilesRes.error) {
    throw new Error(
      [adminRes.error?.message, accountsRes.error?.message, profilesRes.error?.message].filter(Boolean).join(" | "),
    );
  }

  const adminRows = (adminRes.data ?? []) as AdminAuthRow[];
  const accountRows = (accountsRes.data ?? []) as ShopkeeperAccountRow[];
  const profileRows = (profilesRes.data ?? []) as UserProfileRow[];

  const hasRemoteData = adminRows.length > 0 || accountRows.length > 0 || profileRows.length > 0;
  if (!hasRemoteData) return null;

  return {
    adminAuth: adminRows.length > 0 ? adminAuthFromRow(adminRows[0]) : defaultAdminAuth(),
    shopkeeperAccounts: accountRows.length > 0 ? accountRows.map(shopkeeperAccountFromRow) : defaultShopkeeperAccounts(),
    profiles: rowsToProfiles(profileRows),
  };
};

const seedRemoteAuthState = async (input: {
  adminAuth: AdminAuth;
  shopkeeperAccounts: ShopkeeperAccount[];
  profiles: Record<string, UserProfile>;
}) => {
  if (!isSupabaseConfigured) return;

  const adminPayload = adminAuthToRow(input.adminAuth);
  const { error: adminError } = await supabase.from("admin_auth").upsert(adminPayload, { onConflict: "id" });
  if (adminError) throw adminError;

  const accountRows = input.shopkeeperAccounts.map(shopkeeperAccountToRow);
  if (accountRows.length > 0) {
    const { error: accountsError } = await supabase
      .from("shopkeeper_accounts")
      .upsert(accountRows, { onConflict: "id" });
    if (accountsError) throw accountsError;
  }

  const profileRows = profilesToRows(input.profiles);
  if (profileRows.length > 0) {
    const { error: profilesError } = await supabase.from("user_profiles").upsert(profileRows, {
      onConflict: "role,username",
    });
    if (profilesError) throw profilesError;
  }
};

const RoleAuthContext = createContext<RoleAuthContextValue | undefined>(undefined);

export const RoleAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(loadSession);
  const [adminAuth, setAdminAuth] = useState<AdminAuth>(loadAdminAuth);
  const [shopkeeperAccounts, setShopkeeperAccounts] = useState<ShopkeeperAccount[]>(loadShopkeeperAccounts);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(loadProfiles);
  const adminAuthRef = useRef(adminAuth);
  const shopkeeperAccountsRef = useRef(shopkeeperAccounts);
  const profilesRef = useRef(profiles);
  const pendingProfileSyncRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(adminAuth));
  }, [adminAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SHOPKEEPER_ACCOUNTS_STORAGE_KEY, JSON.stringify(shopkeeperAccounts));
  }, [shopkeeperAccounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    adminAuthRef.current = adminAuth;
  }, [adminAuth]);

  useEffect(() => {
    shopkeeperAccountsRef.current = shopkeeperAccounts;
  }, [shopkeeperAccounts]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const syncPendingProfiles = async () => {
      const pendingEntries = Object.entries(pendingProfileSyncRef.current);
      if (pendingEntries.length === 0) return;

      const rows = pendingEntries
        .map(([key]) => {
          const [role, username] = key.split(":");
          if ((role !== "admin" && role !== "shopkeeper") || !username) {
            delete pendingProfileSyncRef.current[key];
            return null;
          }

          const profile = profilesRef.current[key];
          if (!profile) {
            delete pendingProfileSyncRef.current[key];
            return null;
          }

          pendingProfileSyncRef.current[key] = profile.updatedAt;
          return profileToRow(role as AuthRole, username, profile);
        })
        .filter((row): row is UserProfileRow => row !== null);

      if (rows.length === 0) return;
      const { error } = await supabase.from("user_profiles").upsert(rows, {
        onConflict: "role,username",
      });
      if (error) throw error;
    };

    const syncRemote = async () => {
      try {
        await syncPendingProfiles();
        const remote = await fetchRemoteAuthState();
        if (!active) return;

        if (!remote) {
          await seedRemoteAuthState({
            adminAuth: adminAuthRef.current,
            shopkeeperAccounts: shopkeeperAccountsRef.current,
            profiles: profilesRef.current,
          });
          return;
        }

        setAdminAuth((prev) => (areEqual(prev, remote.adminAuth) ? prev : remote.adminAuth));
        setShopkeeperAccounts((prev) =>
          areEqual(prev, remote.shopkeeperAccounts) ? prev : remote.shopkeeperAccounts,
        );
        setProfiles((prev) => {
          const mergedProfiles = { ...remote.profiles };

          for (const [key, pendingUpdatedAt] of Object.entries(pendingProfileSyncRef.current)) {
            const localProfile = prev[key];
            if (!localProfile) {
              delete pendingProfileSyncRef.current[key];
              continue;
            }

            const remoteProfile = remote.profiles[key];
            if (remoteProfile && parseTimestamp(remoteProfile.updatedAt) >= parseTimestamp(pendingUpdatedAt)) {
              delete pendingProfileSyncRef.current[key];
              continue;
            }

            mergedProfiles[key] = localProfile;
          }

          return areEqual(prev, mergedProfiles) ? prev : mergedProfiles;
        });
      } catch (error) {
        logAuthRemoteError(error);
      }
    };

    void syncRemote();

    const intervalId = window.setInterval(() => {
      void syncRemote();
    }, AUTH_SYNC_INTERVAL_MS);

    const handleFocus = () => {
      void syncRemote();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!session || session.role !== "shopkeeper") return;
    const activeAccount = shopkeeperAccounts.find(
      (item) => normalizeUsername(item.username) === normalizeUsername(session.username),
    );
    if (!activeAccount || !activeAccount.active) {
      setSession(null);
      return;
    }
    if (
      session.shopId !== activeAccount.shopId ||
      session.displayName !== activeAccount.displayName ||
      session.username !== activeAccount.username
    ) {
      setSession((prev) => {
        if (!prev || prev.role !== "shopkeeper") return prev;
        if (normalizeUsername(prev.username) !== normalizeUsername(session.username)) return prev;
        return {
          ...prev,
          username: activeAccount.username,
          displayName: activeAccount.displayName,
          shopId: activeAccount.shopId,
        };
      });
    }
  }, [session, shopkeeperAccounts]);

  const getProfileForUser = (role: AuthRole, username: string): UserProfile => {
    const key = profileStorageKey(role, username);
    const existing = profiles[key];
    if (existing) {
      const fallback = role === "admin" ? defaultAdminProfile() : defaultShopkeeperProfile(username);
      return {
        ...fallback,
        ...existing,
        billPrintSettings: {
          ...defaultBillPrintSettings(),
          ...(existing.billPrintSettings ?? {}),
        },
      };
    }
    if (role === "admin") return defaultAdminProfile();
    const account = shopkeeperAccounts.find((item) => normalizeUsername(item.username) === normalizeUsername(username));
    return defaultShopkeeperProfile(account?.displayName || username);
  };

  const getShopkeeperAccount = (username: string) =>
    shopkeeperAccounts.find((item) => normalizeUsername(item.username) === normalizeUsername(username));

  const getCurrentUserProfile = (): UserProfile => {
    if (!session) return defaultAdminProfile();
    return getProfileForUser(session.role, session.username);
  };

  const getDistributorProfile = (): UserProfile => getProfileForUser("admin", adminAuth.username);

  const saveCurrentUserProfile = (profile: Omit<UserProfile, "updatedAt">) => {
    if (!session) return;
    const updatedProfile: UserProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    const key = profileStorageKey(session.role, session.username);
    pendingProfileSyncRef.current[key] = updatedProfile.updatedAt;
    profilesRef.current = {
      ...profilesRef.current,
      [key]: updatedProfile,
    };

    setProfiles((prev) => ({
      ...prev,
      [key]: updatedProfile,
    }));

    if (isSupabaseConfigured) {
      const row = profileToRow(session.role, session.username, updatedProfile);
      void supabase.from("user_profiles").upsert(row, { onConflict: "role,username" }).then(({ error }) => {
        if (error) logAuthRemoteError(error);
      });
    }
  };

  const login = (role: AuthRole, username: string, password: string): LoginResult => {
    const normalizedUsername = normalizeUsername(username);

    if (role === "admin") {
      if (normalizedUsername !== normalizeUsername(adminAuth.username) || password !== adminAuth.password) {
        return { ok: false, message: "Invalid username or password." };
      }

      setSession({
        role: "admin",
        username: adminAuth.username,
        displayName: adminAuth.displayName,
        loginAt: new Date().toISOString(),
      });

      const key = profileStorageKey("admin", adminAuth.username);
      setProfiles((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: defaultAdminProfile() };
      });

      return { ok: true, message: "Login successful." };
    }

    const account = shopkeeperAccounts.find((item) => normalizeUsername(item.username) === normalizedUsername);
    if (!account) return { ok: false, message: "Shopkeeper ID does not exist. Contact distributor." };
    if (!account.active) return { ok: false, message: "This shopkeeper ID is inactive. Contact distributor." };
    if (account.password !== password) return { ok: false, message: "Invalid username or password." };

    setSession({
      role: "shopkeeper",
      username: account.username,
      displayName: account.displayName,
      shopId: account.shopId,
      loginAt: new Date().toISOString(),
    });

    const key = profileStorageKey("shopkeeper", account.username);
    setProfiles((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: defaultShopkeeperProfile(account.displayName) };
    });

    return { ok: true, message: "Login successful." };
  };

  const createShopkeeperLogin = ({
    shopId,
    username,
    password,
    displayName,
    useGstBill,
  }: CreateShopkeeperLoginPayload): CreateShopkeeperLoginResult => {
    const normalizedUsername = normalizeUsername(username);
    const trimmedPassword = password.trim();
    if (!shopId) return { ok: false, message: "Please select a shop first." };
    if (normalizedUsername.length < 4) return { ok: false, message: "Username must be at least 4 characters." };
    if (trimmedPassword.length < 6) return { ok: false, message: "Password must be at least 6 characters." };
    if (!displayName.trim()) return { ok: false, message: "Display name is required." };

    const alreadyExists = shopkeeperAccounts.some(
      (item) => normalizeUsername(item.username) === normalizedUsername || item.shopId === shopId,
    );
    if (alreadyExists) return { ok: false, message: "This username or shop already has a shopkeeper ID." };

    const account: ShopkeeperAccount = {
      id: `acc-${Date.now().toString().slice(-8)}`,
      shopId,
      username: normalizedUsername,
      password: trimmedPassword,
      displayName: displayName.trim(),
      active: true,
      useGstBill,
      createdAt: new Date().toISOString(),
    };
    setShopkeeperAccounts((prev) => [account, ...prev]);

    const key = profileStorageKey("shopkeeper", account.username);
    const profile = defaultShopkeeperProfile(account.displayName);
    setProfiles((prev) => ({
      ...prev,
      [key]: prev[key] ?? profile,
    }));

    if (isSupabaseConfigured) {
      void supabase
        .from("shopkeeper_accounts")
        .upsert(shopkeeperAccountToRow(account), { onConflict: "id" })
        .then(({ error }) => {
          if (error) logAuthRemoteError(error);
        });

      void supabase.from("user_profiles").upsert(profileToRow("shopkeeper", account.username, profile), {
        onConflict: "role,username",
      }).then(({ error }) => {
        if (error) logAuthRemoteError(error);
      });
    }

    return { ok: true, message: "Shopkeeper ID created successfully." };
  };

  const changeCurrentUserPassword = (currentPassword: string, newPassword: string): ChangePasswordResult => {
    if (!session) return { ok: false, message: "No active user session." };
    const nextPassword = newPassword.trim();
    if (nextPassword.length < 6) return { ok: false, message: "New password must be at least 6 characters." };

    if (session.role === "admin") {
      if (currentPassword !== adminAuth.password) return { ok: false, message: "Current password is incorrect." };
      const nextAdmin = { ...adminAuth, password: nextPassword };
      setAdminAuth(nextAdmin);

      if (isSupabaseConfigured) {
        void supabase.from("admin_auth").upsert(adminAuthToRow(nextAdmin), { onConflict: "id" }).then(({ error }) => {
          if (error) logAuthRemoteError(error);
        });
      }
      return { ok: true, message: "Password changed successfully." };
    }

    const target = shopkeeperAccounts.find(
      (item) => normalizeUsername(item.username) === normalizeUsername(session.username),
    );
    if (!target) return { ok: false, message: "Shopkeeper account not found." };
    if (target.password !== currentPassword) return { ok: false, message: "Current password is incorrect." };

    const updatedAccount = { ...target, password: nextPassword };
    setShopkeeperAccounts((prev) => prev.map((item) => (item.id === target.id ? updatedAccount : item)));

    if (isSupabaseConfigured) {
      void supabase
        .from("shopkeeper_accounts")
        .upsert(shopkeeperAccountToRow(updatedAccount), { onConflict: "id" })
        .then(({ error }) => {
          if (error) logAuthRemoteError(error);
        });
    }
    return { ok: true, message: "Password changed successfully." };
  };

  const resetShopkeeperPassword = (accountId: string, newPassword: string): ResetShopkeeperPasswordResult => {
    const nextPassword = newPassword.trim();
    if (nextPassword.length < 6) return { ok: false, message: "Reset password must be at least 6 characters." };

    const target = shopkeeperAccounts.find((item) => item.id === accountId);
    if (!target) return { ok: false, message: "Shopkeeper account not found." };

    const updatedAccount = { ...target, password: nextPassword };
    setShopkeeperAccounts((prev) => prev.map((item) => (item.id === accountId ? updatedAccount : item)));

    if (isSupabaseConfigured) {
      void supabase
        .from("shopkeeper_accounts")
        .upsert(shopkeeperAccountToRow(updatedAccount), { onConflict: "id" })
        .then(({ error }) => {
          if (error) logAuthRemoteError(error);
        });
    }
    return { ok: true, message: "Shopkeeper password reset successful." };
  };

  const updateShopkeeperAccount = ({
    accountId,
    shopId,
    username,
    displayName,
    active,
    useGstBill,
  }: UpdateShopkeeperAccountPayload): UpdateShopkeeperAccountResult => {
    const target = shopkeeperAccounts.find((item) => item.id === accountId);
    if (!target) return { ok: false, message: "Shopkeeper account not found." };

    const nextUsername = normalizeUsername(username);
    const nextDisplayName = displayName.trim();
    if (!shopId) return { ok: false, message: "Shop mapping is required." };
    if (nextUsername.length < 4) return { ok: false, message: "Username must be at least 4 characters." };
    if (!nextDisplayName) return { ok: false, message: "Display name is required." };

    const usernameTaken = shopkeeperAccounts.some(
      (item) => item.id !== accountId && normalizeUsername(item.username) === nextUsername,
    );
    if (usernameTaken) return { ok: false, message: "Username already exists." };

    const updatedAccount: ShopkeeperAccount = {
      ...target,
      shopId,
      username: nextUsername,
      displayName: nextDisplayName,
      active,
      useGstBill,
    };

    setShopkeeperAccounts((prev) => prev.map((item) => (item.id === accountId ? updatedAccount : item)));

    const oldProfileKey = profileStorageKey("shopkeeper", target.username);
    const newProfileKey = profileStorageKey("shopkeeper", updatedAccount.username);
    setProfiles((prev) => {
      const next = { ...prev };
      const existingProfile = next[oldProfileKey] ?? defaultShopkeeperProfile(updatedAccount.displayName);
      delete next[oldProfileKey];
      next[newProfileKey] = {
        ...existingProfile,
        businessName: existingProfile.businessName || updatedAccount.displayName,
        ownerName: existingProfile.ownerName || updatedAccount.displayName,
        updatedAt: new Date().toISOString(),
      };
      return next;
    });

    setSession((prev) => {
      if (!prev || prev.role !== "shopkeeper") return prev;
      if (normalizeUsername(prev.username) !== normalizeUsername(target.username)) return prev;
      if (!active) return null;
      return {
        ...prev,
        username: updatedAccount.username,
        displayName: updatedAccount.displayName,
        shopId: updatedAccount.shopId,
      };
    });

    if (isSupabaseConfigured) {
      void (async () => {
        const { error: accountError } = await supabase
          .from("shopkeeper_accounts")
          .upsert(shopkeeperAccountToRow(updatedAccount), { onConflict: "id" });
        if (accountError) {
          logAuthRemoteError(accountError);
          return;
        }

        if (normalizeUsername(target.username) !== normalizeUsername(updatedAccount.username)) {
          const { error: deleteOldProfileError } = await supabase
            .from("user_profiles")
            .delete()
            .eq("role", "shopkeeper")
            .eq("username", normalizeUsername(target.username));
          if (deleteOldProfileError) {
            logAuthRemoteError(deleteOldProfileError);
            return;
          }
        }

        const nextProfile =
          getProfileForUser("shopkeeper", updatedAccount.username) ?? defaultShopkeeperProfile(updatedAccount.displayName);
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert(profileToRow("shopkeeper", updatedAccount.username, nextProfile), {
            onConflict: "role,username",
          });
        if (profileError) logAuthRemoteError(profileError);
      })();
    }

    return { ok: true, message: "Shopkeeper account updated." };
  };

  const deleteShopkeeperAccount = (accountId: string): DeleteShopkeeperAccountResult => {
    const target = shopkeeperAccounts.find((item) => item.id === accountId);
    if (!target) return { ok: false, message: "Shopkeeper account not found." };

    setShopkeeperAccounts((prev) => prev.filter((item) => item.id !== accountId));
    setProfiles((prev) => {
      const next = { ...prev };
      delete next[profileStorageKey("shopkeeper", target.username)];
      return next;
    });
    setSession((prev) => {
      if (!prev || prev.role !== "shopkeeper") return prev;
      return normalizeUsername(prev.username) === normalizeUsername(target.username) ? null : prev;
    });

    if (isSupabaseConfigured) {
      void (async () => {
        const { error: accountError } = await supabase.from("shopkeeper_accounts").delete().eq("id", accountId);
        if (accountError) {
          logAuthRemoteError(accountError);
          return;
        }
        const { error: profileError } = await supabase
          .from("user_profiles")
          .delete()
          .eq("role", "shopkeeper")
          .eq("username", normalizeUsername(target.username));
        if (profileError) logAuthRemoteError(profileError);
      })();
    }

    return { ok: true, message: "Shopkeeper account deleted." };
  };

  const logout = () => {
    setSession(null);
  };

  const value = useMemo<RoleAuthContextValue>(
    () => ({
      session,
      shopkeeperAccounts,
      getDistributorProfile,
      getCurrentUserProfile,
      getProfileForUser,
      getShopkeeperAccount,
      saveCurrentUserProfile,
      changeCurrentUserPassword,
      resetShopkeeperPassword,
      updateShopkeeperAccount,
      deleteShopkeeperAccount,
      login,
      createShopkeeperLogin,
      logout,
    }),
    [session, shopkeeperAccounts, profiles, adminAuth],
  );

  return <RoleAuthContext.Provider value={value}>{children}</RoleAuthContext.Provider>;
};

export const useRoleAuth = () => {
  const context = useContext(RoleAuthContext);
  if (!context) throw new Error("useRoleAuth must be used inside RoleAuthProvider");
  return context;
};

export const RequireRole = ({ allowedRoles }: RequireRoleProps) => {
  const { session } = useRoleAuth();
  const location = useLocation();

  if (!session) {
    const loginPath = allowedRoles.includes("admin") ? "/admin-login" : "/shopkeeper-login";
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(session.role)) return <Navigate to={defaultRouteForRole(session.role)} replace />;
  return <Outlet />;
};

export const getDefaultRouteForRole = defaultRouteForRole;
