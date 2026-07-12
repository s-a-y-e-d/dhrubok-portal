import type { Dictionary } from "@/lib/i18n/dictionaries";

export function PublicFooter({ dictionary, title, body }: { dictionary: Dictionary; title?: string; body?: string }) {
  return (
    <footer className="public-footer">
      <div className="container">
        <strong>{title || dictionary.brand.name}</strong>
        <p>{body || dictionary.brand.tagline}</p>
      </div>
    </footer>
  );
}
