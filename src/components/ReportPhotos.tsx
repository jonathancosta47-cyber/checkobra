export function ReportPhotos({ photos, label = "Foto" }: { photos: string[]; label?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: Math.ceil(photos.length / 3) }, (_, row) => (
        <div key={row} className="grid grid-cols-3 gap-2" data-pdf-block>
          {photos.slice(row * 3, row * 3 + 3).map((src, column) => (
            <img key={column} src={src} alt={`${label} ${row * 3 + column + 1}`} className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
      ))}
    </div>
  );
}