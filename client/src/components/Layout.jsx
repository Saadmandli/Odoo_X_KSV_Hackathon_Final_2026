import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Bell,
  Car,
  ChartColumn,
  ClipboardList,
  History,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { get, post } from "../lib/api";
import { Avatar, CarbonChip, Sheet, Wordmark } from "./ui";

// Five is the most a thumb can comfortably reach on a phone; the rest live
// behind "More".
const TABS = [
  { to: "/dashboard", label: "Search", icon: Search },
  { to: "/trips", label: "Trips", icon: ClipboardList },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history", label: "History", icon: History },
];

const MORE = [
  { to: "/vehicles", label: "My vehicles", icon: Car },
  { to: "/reports", label: "Reports", icon: ChartColumn },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const { user, org, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState({ notifications: [], unread: 0 });
  const [carbonKg, setCarbonKg] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Read once per mount. Failing quietly is fine: the header should never break
  // because a report could not be computed.
  useEffect(() => {
    get("/reports")
      .then((d) => setCarbonKg(d.summary?.co2SavedKg ?? 0))
      .catch(() => {});
  }, []);

  // Light poll so a driver sees a new booking without refreshing.
  useEffect(() => {
    let alive = true;
    const load = () => get("/notifications").then((d) => alive && setNotifications(d)).catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const openBell = async () => {
    setShowBell(true);
    if (notifications.unread > 0) {
      await post("/notifications/read", {}).catch(() => {});
      setNotifications((n) => ({ ...n, unread: 0 }));
    }
  };

  const desktopNav = [...TABS, ...MORE];

  return (
    <div className="flex min-h-full flex-col bg-surface-sunken">
      <header className="safe-top sticky top-0 z-[900] bg-white">
        {/* A hairline of brand green above the header: enough to colour the
            whole page without tinting surfaces that need to stay readable. */}
        <div className="h-[3px] bg-gradient-to-r from-brand-600 via-brand-500 to-brand-300" />

        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 border-b border-slate-300 px-4 shadow-xs">
          <button onClick={() => navigate("/dashboard")} className="shrink-0 transition hover:opacity-90">
            <Wordmark size="md" />
          </button>

          <CarbonChip kg={carbonKg} className="hidden sm:inline-flex" />

          <nav className="ml-4 hidden flex-1 items-center gap-1.5 md:flex">
            {desktopNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] transition-all duration-150 ${
                    isActive
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-900 font-bold hover:bg-slate-100 hover:text-black"
                  }`
                }
              >
                <Icon size={18} strokeWidth={2.2} />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] transition-all duration-150 ${
                    isActive
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-900 font-bold hover:bg-slate-100 hover:text-black"
                  }`
                }
              >
                <ShieldCheck size={18} strokeWidth={2.2} />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={openBell}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition"
            >
              <Bell size={21} strokeWidth={2.2} />
              {notifications.unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow-sm">
                  {notifications.unread}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowMore(true)}
              aria-label="Account"
              className="flex h-10 items-center gap-2 rounded-xl px-1.5 hover:bg-slate-100 transition"
            >
              <Avatar name={user?.name} color={user?.avatarColor} size={32} />
            </button>
          </div>
        </div>

        {/* On a phone the carbon figure gets its own strip rather than being
            squeezed out of the header row. */}
        {carbonKg > 0 && (
          <div className="flex items-center justify-center border-b border-slate-200 bg-brand-50/70 py-1.5 sm:hidden">
            <CarbonChip kg={carbonKg} className="border-0 bg-transparent px-0 py-0" />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom tab bar — phones only. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[900] border-t border-slate-300 bg-white/95 backdrop-blur-md md:hidden shadow-lg">
        <div className="grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                  isActive ? "text-slate-950 font-extrabold" : "text-slate-700 hover:text-slate-950"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-950"
          >
            <Menu size={21} strokeWidth={2} />
            More
          </button>
        </div>
      </nav>

      <Sheet open={showMore} onClose={() => setShowMore(false)} title="Account">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user?.name} color={user?.avatarColor} size={44} />
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{user?.name}</div>
            <div className="truncate text-sm text-slate-500">{user?.email}</div>
            <div className="mt-0.5 text-xs text-brand-700">{org?.name}</div>
          </div>
        </div>

        <div className="space-y-1">
          {MORE.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => {
                setShowMore(false);
                navigate(to);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50"
            >
              <Icon size={18} className="text-slate-400" />
              {label}
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => {
                setShowMore(false);
                navigate("/admin");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck size={18} className="text-slate-400" />
              Admin dashboard
            </button>
          )}

          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </Sheet>

      <Sheet open={showBell} onClose={() => setShowBell(false)} title="Notifications">
        {notifications.notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Nothing new right now.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.notifications.map((n) => (
              <div key={n.id} className="py-3">
                <div className="text-[15px] font-medium text-slate-900">{n.title}</div>
                <div className="text-sm text-slate-600">{n.body}</div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
