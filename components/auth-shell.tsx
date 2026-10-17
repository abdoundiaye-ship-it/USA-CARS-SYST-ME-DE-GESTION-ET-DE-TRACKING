/** Mise en page des écrans d’authentification (centrés, lisibles dès 400 px). */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">USA CARS</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        {description && <p className="text-muted mt-2 text-sm">{description}</p>}
      </div>
      <div className="border-border bg-card rounded-lg border p-4 sm:p-6">{children}</div>
    </main>
  );
}
