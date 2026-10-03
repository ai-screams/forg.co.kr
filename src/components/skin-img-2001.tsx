import { LazyImg } from "@/components/lazy-img";
import { skinAsset2001, type Skin2001 } from "@/lib/skins-2001";

/** A recovered 2001 skin image at its own size, or nothing when Wayback never kept it. */
export function SkinImg2001({
  skin,
  file,
  alt = "",
}: {
  skin: Skin2001;
  file: string;
  alt?: string;
}) {
  const url = skinAsset2001(skin, file);
  return url ? <LazyImg src={url} alt={alt} className="inline-block align-middle" /> : null;
}
