/**
 * One JSON-LD block for search engines (`src/lib/structured-data.ts`). An
 * inline script, so the postbuild that strips the React runtime keeps it.
 */

import { serializeJsonLd } from "@/lib/structured-data";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
