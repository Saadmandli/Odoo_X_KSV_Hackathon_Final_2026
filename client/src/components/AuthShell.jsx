import { Leaf, ShieldCheck, Wallet } from "lucide-react";
import { CommuteScene } from "./illustrations";
import { Wordmark } from "./ui";

/**
 * The frame around signing in and signing up.
 *
 * Both screens previously drew their own centred glass card, which meant the
 * product introduced itself twice, differently. Here the introduction is made
 * once — on a brand panel that states what EcoMiles is — and each page supplies
 * only its form.
 *
 * The panel is hidden below `lg`. On a phone it would push the form under the
 * fold, and the first thing someone needs on a small screen is the email field,
 * not the pitch.
 */
export function AuthShell({ children }) {
  return (
    <div className="safe-top safe-bottom flex min-h-screen w-full bg-surface-sunken selection:bg-brand-500 selection:text-white">
      <BrandPanel />

      <main className="flex w-full flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          {/* The wordmark the panel would have carried, for the screens that
              are too narrow to show it. */}
          <div className="mb-8 lg:hidden">
            <Wordmark size="lg" />
            <p className="mt-1.5 text-[13px] font-semibold text-brand-700">
              Share the drive · Cut the carbon
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

const PROMISES = [
  {
    icon: ShieldCheck,
    title: "Colleagues only",
    body: "Everyone here signs in with your company's email domain. No strangers.",
  },
  {
    icon: Wallet,
    title: "Cost, not fare",
    body: "Fares are suggested from real fuel, distance and mileage — never marked up.",
  },
  {
    icon: Leaf,
    title: "Measured impact",
    body: "Carbon saved is counted from completed trips, not estimated from sign-ups.",
  },
];

function BrandPanel() {
  return (
    <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 px-10 py-12 lg:flex xl:w-[50%] xl:px-14">
      {/* Depth behind the content: two soft lights and a faint grid, so the
          panel is not a flat rectangle of green. */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-brand-300/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-[0.07]" />

      <div className="relative">
        <Wordmark size="lg" tone="light" />
      </div>

      <div className="relative py-8">
        <h1 className="max-w-[13ch] text-[40px] font-black leading-[1.08] tracking-tight text-white xl:text-[46px]">
          Share the drive. Cut the carbon.
        </h1>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-brand-100/90">
          Find a colleague already going your way, watch the trip live, and settle up at what
          the journey actually cost.
        </p>

        {/* Framed rather than bled into the panel: the artwork carries its own
            sky, and against dark green an unframed light rectangle reads as a
            rendering fault instead of a picture. */}
        <div className="mt-8 max-w-[440px] overflow-hidden rounded-2xl shadow-[0_20px_40px_-12px_rgba(2,44,34,0.55)] ring-1 ring-white/15">
          <CommuteScene className="block w-full" />
        </div>
      </div>

      <ul className="relative space-y-4">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200 ring-1 ring-inset ring-white/15">
              <Icon size={16} />
            </span>
            <div>
              <p className="text-[13.5px] font-bold text-white">{title}</p>
              <p className="mt-0.5 max-w-[40ch] text-[12.5px] leading-relaxed text-brand-100/70">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
