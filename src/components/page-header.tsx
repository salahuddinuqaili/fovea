export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8">
      <div className="max-w-2xl">
        {kicker ? (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">{kicker}</div>
        ) : null}
        <h1 className="font-display text-4xl leading-none tracking-tight text-fg md:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
