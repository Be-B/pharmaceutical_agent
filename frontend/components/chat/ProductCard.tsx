type Product = {
  name: string;
  source: string;
  item_code?: string;
  company?: string;
  image_url?: string;
  snippet?: string;
};

export function ProductCard({ p }: { p: Product }) {
  return (
    <div className="border rounded-lg p-3 my-2 bg-gray-50">
      <div className="flex items-start gap-3">
        {p.image_url && (
          <img
            src={p.image_url}
            alt={p.name}
            className="w-16 h-16 object-contain bg-white rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{p.name}</div>
          <div className="text-xs text-gray-500">
            {p.source === "drug" ? "의약품" : "건강기능식품"} · {p.company} ·{" "}
            {p.item_code}
          </div>
          {p.snippet && (
            <div className="text-sm mt-1 text-gray-700 line-clamp-3">
              {p.snippet}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
