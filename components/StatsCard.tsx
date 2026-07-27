const stats = [
  { label: "Total Files", value: 0 },
  { label: "Pending", value: 0 },
  { label: "Completed", value: 0 },
  { label: "Failed", value: 0 }
];

export default function StatsCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-slate-900">Upload Stats</h2>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
