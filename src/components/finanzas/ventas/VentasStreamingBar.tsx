'use client';

export function VentasStreamingBar({
  streaming,
  streamingPercent,
}: {
  streaming: boolean;
  streamingPercent: number;
}) {
  if (!streaming) return null;

  return (
    <div className="glass-thick rounded-2xl border border-label-tertiary/10 p-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-label-tertiary/10">
        <div
          className="h-2 rounded-full bg-systemBlue transition-all duration-300"
          style={{ width: `${streamingPercent}%` }}
        />
      </div>
      <p className="mt-2 text-right text-caption text-label-tertiary">
        Cargando datos… {streamingPercent}%
      </p>
    </div>
  );
}
