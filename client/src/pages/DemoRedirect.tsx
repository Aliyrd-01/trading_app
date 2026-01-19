import { useMemo, useState } from "react";

export default function DemoRedirect() {
  const [loading, setLoading] = useState(true);
  const iframeSrc = useMemo(() => `https://cryptoanalyz.net/demo_static.html?cb=${Date.now()}`, []);

  return (
    <div className="min-h-[100dvh] w-full bg-[#0f1320] relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Загрузка демо...</p>
          </div>
        </div>
      )}
      <iframe
        src={iframeSrc}
        className="w-full h-[100dvh] border-none"
        allow="fullscreen"
        allowFullScreen
        title="Demo Application"
        onLoad={() => setLoading(false)}
        style={{ opacity: loading ? 0 : 1 }}
      />
    </div>
  );
}

