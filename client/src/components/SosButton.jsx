import { useState } from "react";
import { CircleAlert, Phone, ShieldAlert } from "lucide-react";
import { post } from "../lib/api";
import { Sheet } from "./ui";

/**
 * The emergency button, shown while a trip is under way.
 *
 * Two competing requirements shape this. It must not fire from a pocket or a
 * mis-tap, because a false alarm that reaches the whole organisation teaches
 * people to ignore the next one. And it must not stand between someone and
 * help. The compromise is a confirmation sheet with the real action under one
 * more press — no countdown, no hold-to-arm, nothing that costs seconds — and
 * a note field that is always optional.
 */
export function SosButton({ rideId, className = "" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");

  /**
   * Location is requested but never waited on indefinitely. A device that is
   * slow to get a fix, or a permission the person never granted, must not
   * hold up the alert — it goes out with whatever is known.
   */
  const currentPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      const done = (value) => resolve(value);
      const timer = setTimeout(() => done(null), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer);
          done({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          done(null);
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    });

  const raise = async () => {
    setBusy(true);
    setError("");
    try {
      const where = await currentPosition();
      const res = await post("/sos", {
        rideId,
        ...(where ?? {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSent(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    // Reset only once the sheet is closed, so the confirmation stays readable
    // while it is on screen.
    setTimeout(() => {
      setSent(null);
      setNote("");
      setError("");
    }, 200);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-[15px] font-bold text-rose-700 transition-all duration-200 hover:border-rose-300 hover:bg-rose-100 active:scale-[0.99] ${className}`}
      >
        <ShieldAlert size={17} />
        Emergency SOS
      </button>

      <Sheet open={open} onClose={close} title={sent ? "Help is on the way" : "Raise an emergency alert"}>
        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div className="text-sm text-rose-800">
                <p className="font-semibold">Your alert has been sent.</p>
                <p className="mt-1 leading-relaxed">
                  {sent.notified} {sent.notified === 1 ? "person has" : "people have"} been
                  notified, including your administrator. Your location was shared with them.
                </p>
              </div>
            </div>

            {/* The app raises the alarm inside the company. It is not a
                substitute for the emergency services, and should never imply
                that it is. */}
            <a
              href="tel:112"
              className="btn-primary w-full bg-gradient-to-r from-rose-600 to-rose-700 shadow-rose-700/20 hover:from-rose-700 hover:to-rose-800"
            >
              <Phone size={16} />
              Call emergency services (112)
            </a>

            <button className="btn-secondary w-full" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              This alerts your organisation's administrator and everyone else on this trip, and
              shares your current location with them.
            </p>

            <div>
              <label className="label" htmlFor="sos-note">
                What is happening? <span className="font-medium normal-case">(optional)</span>
              </label>
              <textarea
                id="sos-note"
                className="field min-h-[76px] resize-none"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything that would help someone find you"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </p>
            )}

            <button
              onClick={raise}
              disabled={busy}
              className="btn-primary w-full bg-gradient-to-r from-rose-600 to-rose-700 shadow-rose-700/20 hover:from-rose-700 hover:to-rose-800"
            >
              <ShieldAlert size={17} />
              {busy ? "Sending…" : "Send alert now"}
            </button>

            <button className="btn-quiet w-full" onClick={close}>
              Cancel
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
