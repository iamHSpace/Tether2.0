export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-6">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Tether for Business</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Discover creators with verified metrics. Build partnerships you can trust.</p>
      <div className="flex gap-3">
        <a href="/signup" className="btn-primary">Get started free</a>
        <a href="/login" className="btn-secondary">Sign in</a>
      </div>
    </div>
  );
}
