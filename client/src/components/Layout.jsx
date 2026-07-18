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
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { get, post } from "../lib/api";
import { Avatar, Sheet } from "./ui";

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
  const [showBell, setShowBell] = useState(false);
  const [showMore, setShowMore] = useState(false);

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
      <header className="safe-top sticky top-0 z-[900] border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Car size={17} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Carpool</span>
          </button>

          <nav className="ml-4 hidden flex-1 items-center gap-0.5 md:flex">
            {desktopNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <ShieldCheck size={15} />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={openBell}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Bell size={19} />
              {notifications.unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {notifications.unread}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowMore(true)}
              aria-label="Account"
              className="flex h-10 items-center gap-2 rounded-lg px-1 hover:bg-slate-100"
            >
              <Avatar name={user?.name} color={user?.avatarColor} size={30} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom tab bar — phones only. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[900] border-t border-slate-200 bg-white md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${
                  isActive ? "text-brand-700" : "text-slate-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500"
          >
            <Menu size={20} strokeWidth={1.8} />
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
