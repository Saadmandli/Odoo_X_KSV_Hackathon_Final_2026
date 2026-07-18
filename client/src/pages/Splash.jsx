import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Wordmark } from "../components/ui";

/**
 * Shown while the stored session is resolved (PS 5.1). It is not a timed
 * delay: the moment auth settles it hands over, so a returning user goes
 * straight to the dashboard rather than waiting out an animation.
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
    <div className="flex min-h-full flex-col items-center justify-center bg-white px-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Wordmark size="xl" />
        <p className="mt-2 text-center text-[15px] text-brand-700">
          Share the drive. Cut the carbon.
        </p>
      </div>

      <div className="mt-10 h-1 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-brand-600" />
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
