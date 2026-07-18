import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Wordmark } from "../components/ui";

/**
 * Shown while the stored session is resolved (PS 5.1). It is not a timed
 * delay: the moment auth settles it hands over, so a returning user goes
 * straight to the dashboard rather than waiting out an animation.
 *
 * Because it is on screen for a fraction of a second, it is deliberately the
 * one full-bleed brand moment in the product — the same green the sign-in
 * panel uses, so the app opens with a colour rather than a white flash.
 */
export default function Splash() {
  const { status, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "loading") return;
    navigate(status === "authed" ? (isAdmin ? "/admin" : "/dashboard") : "/login", {
      replace: true,
    });
  }, [status, isAdmin, navigate]);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-brand-300/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-[0.06]" />

      <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Wordmark size="xl" tone="light" />
        <p className="mt-2.5 text-center text-[15px] font-medium text-brand-100/80">
          Share the drive. Cut the carbon.
        </p>
      </div>

      <div className="relative mt-10 h-1 w-32 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-brand-300" />
      </div>

      <style>{`
        @keyframes loading {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
