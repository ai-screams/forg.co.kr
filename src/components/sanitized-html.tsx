import { withAltText } from "@/lib/img-alt";
import { withImgBase } from "@/lib/img-base";

/**
 * A post's or comment's body: HTML nh3 sanitised at ETL Stage 2 (ADR-0008),
 * with `/img/posts/…` pointed at the image host and alt text on the pictures
 * that had none (`picture` for a recovered one, `src/lib/img-alt.ts`).
 *
 * Below 800px only: divider lines of "____" and long URLs have no break point
 * and pushed a phone-width page sideways (the Zeroboard body cell had
 * `word-break:break-all` for the same reason), and a table too wide for the
 * column scrolls inside the body, not the page. On a desktop both would
 * change the original layout.
 */
export function SanitizedHtml({
  html,
  className,
  picture = "글에 붙은 그림",
}: {
  html: string;
  className: string;
  picture?: string;
}) {
  return (
    <div
      className={[className, "max-frame:overflow-x-auto max-frame:[overflow-wrap:break-word]"].join(
        " ",
      )}
      dangerouslySetInnerHTML={{ __html: withImgBase(withAltText(html, picture)) }}
    />
  );
}
