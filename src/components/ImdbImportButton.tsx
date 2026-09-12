import { lazy, Suspense, useState } from "react";
import { Download } from "lucide-react";

const ImdbImport = lazy(() => import("./ImdbImport"));
export function ImdbImportButton({
  className = "button secondary",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Download size={16} />
        Import IMDb Watchlist
      </button>
      {open && (
        <Suspense
          fallback={
            <div className="toast visible" role="status">
              Opening IMDb import…
            </div>
          }
        >
          <ImdbImport onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
