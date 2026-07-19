import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Bell,
  Car,
  ChartColumn,
  ClipboardList,
  Globe,
  History,
  LogOut,
  Menu,
  MessagesSquare,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { get, post } from "../lib/api";
import { useIsDesktop } from "../lib/useMediaQuery";
import Popover from "./Popover";
import { Avatar, CarbonChip, Sheet, Wordmark } from "./ui";

// Five is the most a thumb can comfortably reach on a phone; the rest live
// behind "More". The sidebar shows all of them, since there is room.
const TABS = [
  { to: "/dashboard", label: "Search", icon: Search },
  { to: "/trips", label: "My trips", icon: ClipboardList },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/wallet", label: "Wallet", icon: Wallet },
];

const MORE = [
  { to: "/history", label: "Ride history", icon: History },
  { to: "/vehicles", label: "My vehicles", icon: Car },
  { to: "/reports", label: "Reports", icon: ChartColumn },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const { user, org, logout, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDesktop = useIsDesktop();

  const [notifications, setNotifications] = useState({ notifications: [], unread: 0 });
  const [carbonKg, setCarbonKg] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [showMore, setShowMore] = useState(false);

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

  const toggleBell = async () => {
    const opening = !showBell;
    setShowBell(opening);
    if (opening && notifications.unread > 0) {
      await post("/notifications/read", {}).catch(() => {});
      setNotifications((n) => ({ ...n, unread: 0 }));
    }
  };

  const notificationList = (
    <>
      {notifications.notifications.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">Nothing new right now.</p>
      ) : (
        <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {notifications.notifications.map((n) => (
            <div key={n.id} className="px-4 py-3">
              <div className="text-[15px] font-medium text-slate-900">{n.title}</div>
              <div className="mt-0.5 text-sm text-slate-600">{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const accountMenu = (
    <div className="p-1.5">
      {MORE.map(({ to, label, icon: Icon }) => (
        <button
          key={to}
          onClick={() => {
            setShowMore(false);
            navigate(to);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-slate-700 transition hover:bg-slate-50"
        >
          <Icon size={17} className="text-slate-400" />
          {label}
        </button>
      ))}

      {isAdmin && (
        <button
          onClick={() => {
            setShowMore(false);
            navigate("/admin");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-slate-700 transition hover:bg-slate-50"
        >
          <ShieldCheck size={17} className="text-slate-400" />
          Admin dashboard
        </button>
      )}

      {isOwner && (
        <button
          onClick={() => {
            setShowMore(false);
            navigate("/platform");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-slate-700 transition hover:bg-slate-50"
        >
          <Globe size={17} className="text-slate-400" />
          Platform
        </button>
      )}

      <button
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left text-[15px] text-rose-600 transition hover:bg-rose-50"
      >
        <LogOut size={17} />
        Sign out
      </button>
    </div>
  );

  const sidebarLink = ({ isActive }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
      isActive
        ? "bg-brand-600 text-white shadow-md shadow-brand-700/20"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="bg-app-wash min-h-full">
      {/* ---------------------------------------------------------- sidebar */}
      <aside className="fixed inset-y-0 left-0 z-[900] hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center px-5">
          <button onClick={() => navigate("/dashboard")} className="transition hover:opacity-90">
            <Wordmark />
          </button>
        </div>

        <div className="px-4 pb-3">
          <CarbonChip kg={carbonKg} className="w-full justify-center" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={sidebarLink}>
              {({ isActive }) => (
                <>
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          <div className="!mt-4 mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Manage
          </div>

          {MORE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={sidebarLink}>
              {({ isActive }) => (
                <>
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink to="/admin" className={sidebarLink}>
              {({ isActive }) => (
                <>
                  <ShieldCheck size={19} strokeWidth={isActive ? 2.4 : 2} />
                  Admin
                </>
              )}
            </NavLink>
          )}

          {isOwner && (
            <NavLink to="/platform" className={sidebarLink}>
              {({ isActive }) => (
                <>
                  <Globe size={19} strokeWidth={isActive ? 2.4 : 2} />
                  Platform
                </>
              )}
            </NavLink>
          )}
        </nav>

        <div className="relative border-t border-slate-200 p-3">
          <button
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
              showMore ? "bg-slate-100" : "hover:bg-slate-100"
            }`}
          >
            <Avatar name={user?.name} color={user?.avatarColor} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{user?.name}</span>
              <span className="block truncate text-xs text-slate-500">{org?.name}</span>
            </span>
          </button>

          {/* Opens upward from the sidebar footer, where the trigger is. */}
          {isDesktop && showMore && (
            <div className="animate-popover absolute bottom-full left-3 right-3 z-[1000] mb-2 origin-bottom overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <div className="truncate text-sm font-medium text-slate-900">{user?.name}</div>
                <div className="truncate text-xs text-slate-500">{user?.email}</div>
              </div>
              {accountMenu}
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------ main column */}
      <div className="md:pl-64">
        {/* Slim top bar. On desktop it only carries the bell, since navigation
            has moved to the sidebar. */}
        <header className="safe-top sticky top-0 z-[800] border-b border-slate-200 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 md:px-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="shrink-0 transition hover:opacity-90 md:hidden"
            >
              <Wordmark />
            </button>

            <div className="ml-auto flex items-center gap-1">
              {/* The panel is anchored to this wrapper on desktop, so it opens
                  from the bell rather than sliding up from the bottom edge. */}
              <div className="relative">
                <button
                  onClick={toggleBell}
                  aria-label="Notifications"
                  aria-expanded={showBell}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    showBell
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Bell size={20} strokeWidth={2} />
                  {notifications.unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {notifications.unread}
                    </span>
                  )}
                </button>

                {isDesktop && (
                  <Popover open={showBell} onClose={() => setShowBell(false)}>
                    <div className="border-b border-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-900">
                      Notifications
                    </div>
                    {notificationList}
                  </Popover>
                )}
              </div>

              <button
                onClick={() => setShowMore(true)}
                aria-label="Account"
                className="flex h-10 items-center rounded-xl px-1 transition hover:bg-slate-100 md:hidden"
              >
                <Avatar name={user?.name} color={user?.avatarColor} size={32} />
              </button>
            </div>
          </div>

          {carbonKg > 0 && (
            <div className="flex items-center justify-center border-t border-slate-100 bg-brand-50/60 py-1.5 md:hidden">
              <CarbonChip kg={carbonKg} className="border-0 bg-transparent px-0 py-0" />
            </div>
          )}
        </header>

        {/* Keyed on the path so each screen fades in rather than snapping. */}
        <main key={pathname} className="mx-auto w-full max-w-5xl animate-page px-4 pb-28 pt-5 md:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — phones only. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[900] border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-brand-700" : "text-slate-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                  {label === "My trips" ? "Trips" : label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-500"
          >
            <Menu size={20} strokeWidth={1.9} />
            More
          </button>
        </div>
      </nav>

      {/* Phones keep bottom sheets, which is the right pattern for a thumb.
          Desktop gets the anchored popovers above instead. */}
      {!isDesktop && (
        <>
          <Sheet open={showMore} onClose={() => setShowMore(false)} title="Account">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={user?.name} color={user?.avatarColor} size={44} />
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900">{user?.name}</div>
                <div className="truncate text-sm text-slate-500">{user?.email}</div>
                <div className="mt-0.5 text-xs text-brand-700">{org?.name}</div>
              </div>
            </div>
            {accountMenu}
          </Sheet>

          <Sheet open={showBell} onClose={() => setShowBell(false)} title="Notifications">
            {notificationList}
          </Sheet>
        </>
      )}
    </div>
  );
}
