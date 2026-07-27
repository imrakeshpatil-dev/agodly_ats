export default function UploadCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Resume Upload</h2>

      <label
        htmlFor="bulk-upload"
        className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30"
      >
        <svg viewBox="0 0 24 24" fill="none" className="mb-4 h-10 w-10 text-slate-400" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4m0 0-4 4m4-4 4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>

        <p className="text-base font-medium text-slate-700">Drop files here or click to upload</p>
        <p className="mt-2 text-sm text-slate-500">Supported: PDF, DOC, DOCX up to 10MB</p>
      </label>

      <input id="bulk-upload" type="file" multiple accept=".pdf,.doc,.docx" className="sr-only" />
    </section>
  );
}
