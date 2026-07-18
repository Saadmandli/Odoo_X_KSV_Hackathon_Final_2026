import { useEffect, useState } from "react";
import { CarFront, Fuel, Plus, Trash2, Users } from "lucide-react";
import { del, get, post } from "../lib/api";
import { filterRegistration } from "../lib/inputs";
import { Banner, EmptyState, Sheet, Spinner, StatusChip } from "../components/ui";

const BLANK = {
  model: "",
  registrationNumber: "",
  seatingCapacity: 4,
  fuelType: "Petrol",
  mileageKmpl: 18,
  color: "",
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    get("/vehicles")
      .then((d) => setVehicles(d.vehicles))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await post("/vehicles", {
        model: form.model.trim(),
        registrationNumber: form.registrationNumber.trim(),
        seatingCapacity: Number(form.seatingCapacity),
        fuelType: form.fuelType,
        mileageKmpl: Number(form.mileageKmpl),
        color: form.color.trim() || undefined,
      });
      await load();
      setShowForm(false);
      setForm(BLANK);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vehicle) => {
    setError("");
    try {
      await del(`/vehicles/${vehicle.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!vehicles) return error ? <Banner>{error}</Banner> : <Spinner label="Loading vehicles" />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">My vehicles</h1>
          <p className="mt-1 text-sm text-slate-500">
            You need at least one vehicle before you can offer a ride.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm shrink-0">
          <Plus size={15} />
          Add
        </button>
      </div>

      <div className="mt-4">
        <Banner>{error}</Banner>
      </div>

      {vehicles.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={CarFront}
            title="No vehicles yet"
            hint="Add your car to start offering seats on your commute."
            action={
              <button onClick={() => setShowForm(true)} className="btn-secondary btn-sm">
                Add a vehicle
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <CarFront size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{v.model}</span>
                    {v.isApproved ? (
                      <StatusChip status="COMPLETED">Approved</StatusChip>
                    ) : (
                      <StatusChip status="PENDING">Awaiting approval</StatusChip>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-sm tracking-wide text-slate-600">
                    {v.registrationNumber}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {v.seatingCapacity} seats
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Fuel size={12} />
                      {v.fuelType} · {v.mileageKmpl} km/l
                    </span>
                    {v.color && <span>{v.color}</span>}
                  </div>
                </div>

                <button
                  onClick={() => remove(v)}
                  aria-label={`Remove ${v.model}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {!v.isApproved && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Your administrator has not approved this vehicle for ride sharing yet.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={showForm} onClose={() => !busy && setShowForm(false)} title="Add a vehicle">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Model</label>
            <input
              className="field"
              required
              value={form.model}
              onChange={set("model")}
              placeholder="Maruti Swift"
            />
          </div>

          <div>
            <label className="label">Registration number</label>
            <input
              className="field font-mono uppercase"
              required
              value={form.registrationNumber}
              onChange={(e) =>
                setForm({ ...form, registrationNumber: filterRegistration(e.target.value) })
              }
              placeholder="GJ18AB4471"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Seats</label>
              <select className="field" value={form.seatingCapacity} onChange={set("seatingCapacity")}>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fuel</label>
              <select className="field" value={form.fuelType} onChange={set("fuelType")}>
                {["Petrol", "Diesel", "CNG", "Electric"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mileage (km/l)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max="60"
                className="field"
                value={form.mileageKmpl}
                onChange={set("mileageKmpl")}
              />
              <p className="mt-1 text-xs text-slate-500">Used to work out a fair fare.</p>
            </div>
            <div>
              <label className="label">Colour</label>
              <input className="field" value={form.color} onChange={set("color")} placeholder="White" />
            </div>
          </div>

          <Banner>{formError}</Banner>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving" : "Save vehicle"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
