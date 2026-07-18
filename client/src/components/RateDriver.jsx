import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { get, post } from "../lib/api";
import { Banner } from "./ui";

/**
 * Shown to a passenger once their trip is complete. Ratings are per-ride and
 * editable, so a second visit prefills what they already gave rather than
 * silently creating a duplicate.
 */
export default function RateDriver({ rideId, driverName }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get(`/ratings/mine/${rideId}`)
      .then(({ rating }) => {
        if (!rating) return;
        setStars(rating.stars);
        setComment(rating.comment ?? "");
        setSaved(true);
      })
      .catch(() => {});
  }, [rideId]);

  const submit = async () => {
    if (stars === 0) return setError("Pick a rating first");

    setBusy(true);
    setError("");
    try {
      await post("/ratings", { rideId, stars, comment: comment.trim() || undefined });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = hover || stars;

  return (
    <div className="card mt-3 p-4">
      <h2 className="text-[15px] font-semibold text-slate-900">
        {saved ? "Your rating" : `How was your ride with ${driverName.split(" ")[0]}?`}
      </h2>

      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setStars(n);
              setSaved(false);
            }}
            className="p-1 transition-transform active:scale-90"
          >
            <Star
              size={26}
              className={n <= shown ? "text-amber-400" : "text-slate-300"}
              fill={n <= shown ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>

      {!saved && (
        <>
          <input
            className="field mt-3"
            placeholder="Add a note (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
          />
          <div className="mt-3">
            <Banner>{error}</Banner>
          </div>
          <button className="btn-primary btn-sm mt-3 w-full" onClick={submit} disabled={busy}>
            {busy ? "Saving" : "Submit rating"}
          </button>
        </>
      )}

      {saved && (
        <p className="mt-1 text-xs text-slate-500">
          Thanks. Tap a star to change it.
        </p>
      )}
    </div>
  );
}
