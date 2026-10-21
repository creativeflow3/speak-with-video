/** The inline error line under a dashboard control; renders nothing when there's no error. */
export function ActionError({ error, id }: { error: string | null; id?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {error}
    </p>
  );
}
