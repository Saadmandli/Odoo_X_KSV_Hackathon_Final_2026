import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Car, ShieldCheck } from "lucide-react";
import { get } from "../lib/api";
import MapView from "../components/MapView";
import { Spinner } from "../components/ui";

/**
 * Opened by whoever the rider shared the link with — no account, no sign-in.
 * Shows only the vehicle's position and ETA, and stops once the trip ends.
 */
export default function PublicTrack() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const tick = () =>
      get(`/public/track/${token}`)
        .then((d) => alive && setData(d))
        .catch((err) => alive && setError(err.message));

    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 text-center">
        <div>
          <p className="text-[15px] font-medium text-slate-900">{error}</p>
          <p className="mt-1 text-sm text-slate-500">The trip may have already finished.</p>
        </div>
      </div>
    );
  }

  if (!data) return <Spinner label="Loading trip" />;

  return (
    <div className="safe-top safe-bottom mx-auto min-h-full max-w-2xl px-4 py-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Car size={17} />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">Carpool</span>
      </div>

      {data.active ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {data.driverName} is on the way
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {data.etaMinutes ? `About ${data.etaMinutes} minutes to go` : "Waiting for a location update"}
          </p>

          <MapView
            origin={data.origin}
            dest={data.destination}
            geometry={data.routeGeometry}
            vehicle={data.position}
            className="mt-4 h-72 w-full sm:h-96"
          />

          <div className="card mt-3 divide-y divide-slate-100">
            <div className="flex items-start gap-2 p-4">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
              <div>
                <div className="text-xs text-slate-500">From</div>
                <div className="text-[15px] text-slate-800">{data.from}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-4">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-600" />
              <div>
                <div className="text-xs text-slate-500">To</div>
                <div className="text-[15px] text-slate-800">{data.to}</div>
              </div>
            </div>
            <div className="p-4 text-sm text-slate-600">{data.vehicle}</div>
          </div>
        </>
      ) : (
        <div className="card mt-6 p-6 text-center">
          <p className="text-[15px] font-medium text-slate-900">This trip has finished</p>
          <p className="mt-1 text-sm text-slate-500">
            {data.driverName} completed the journey from {data.from} to {data.to}.
          </p>
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={12} />
        Location sharing ends automatically when the trip does
      </p>
    </div>
  );
}
