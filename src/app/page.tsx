/**
 * Museum landing — each era's front page inside the era frame
 * (`<EraShell>`, shared with every route): the 2014 eight-box grid
 * (`home-2014.tsx`), the 2003 main frame (`home-2003.tsx`) and the 2001
 * front page (`home-2001.tsx`). All three render server-side and
 * `<html data-era>` shows one (CSS in `src/styles/eras.css`), so the era toggle is
 * instant and the static export ships every layout.
 */

import { EraShell } from "@/components/era-shell";
import { Home2001Content } from "@/components/home-2001";
import { Home2003Content } from "@/components/home-2003";
import { Home2014Content } from "@/components/home-2014";

export default function HomePage() {
  return (
    <EraShell
      content2014={<Home2014Content />}
      content2003={<Home2003Content />}
      content2001={<Home2001Content />}
    />
  );
}
