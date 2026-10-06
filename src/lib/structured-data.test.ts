import { describe, expect, it } from "vitest";

import { getBoard } from "@/lib/boards";
import { getPost } from "@/lib/posts";
import { kst } from "@/lib/seo";
import {
  breadcrumbJsonLd,
  plainText,
  postJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/structured-data";
import type { Post } from "@/types/post";

async function post(id: string): Promise<Post> {
  const p = await getPost("UoBoard", id);
  if (!p) throw new Error(`UoBoard/${id} is gone from the content`);
  return p;
}

const BOARD = getBoard("UoBoard");

describe("a post's structured data", () => {
  // Fails if: the post loses a field Google requires (author, date, text),
  // or its address is not the public one.
  it("describes a dated post as a forum post on forg.co.kr", async () => {
    const data = postJsonLd(await post("26397"), BOARD);
    expect(data).toMatchObject({
      "@type": "DiscussionForumPosting",
      url: "https://forg.co.kr/UoBoard/26397/",
      headline: "아 액땜인가... ㅠㅜ",
      datePublished: "2007-10-19T21:05:03+09:00",
      author: { "@type": "Person", name: "santiago" },
      isPartOf: { url: "https://forg.co.kr/UoBoard/" },
    });
    expect(data?.["text"]).toContain("샤워");
    expect(data).not.toHaveProperty("image");
  });

  // Fails if: a post without a date, or one of lost pictures alone, gets
  // markup Google would reject, or a post of pictures loses them.
  it("gives a post with nothing Google can show none", async () => {
    expect(postJsonLd(await post("1745"), BOARD)).toBeNull();
    const events = getBoard("Events");
    const lost = await getPost("Events", "365");
    const kept = await getPost("Events", "436");
    if (!lost || !kept) throw new Error("Events/365 or 436 is gone from the content");
    expect(postJsonLd(lost, events)).toBeNull();
    const pictures = postJsonLd(kept, events)?.["image"] as string[];
    expect(pictures.length).toBeGreaterThan(0);
    expect(pictures.every((u) => /^https:\/\/[^/]+\/(img\/)?posts\/Events\/436\//.test(u))).toBe(
      true,
    );
  });

  // Fails if: an undated comment or one with no words (an emoticon alone) is
  // listed, a comment keeps its markup, or its date lacks Korean time.
  it("lists the dated comments with words, as text", async () => {
    const p = await post("26397");
    const [first, second] = p.comments;
    if (!first || !second) throw new Error("UoBoard/26397 lost its comments");
    const data = postJsonLd(
      {
        ...p,
        comments: [
          { ...first, createdAt: "1970-01-01T00:00:00" },
          { ...second, bodyHtml: '<img src="/img/emoticon/m_smile.gif">' },
          ...p.comments.slice(2),
        ],
      },
      BOARD,
    );
    const comments = data?.["comment"] as { datePublished: string; text: string }[];
    expect(comments).toHaveLength(p.comments.length - 2);
    expect(comments.every((c) => c.datePublished.endsWith("+09:00"))).toBe(true);
    expect(data?.["commentCount"]).toBe(p.comments.length);
    expect(comments.every((c) => !c.datePublished.startsWith("1970"))).toBe(true);
    expect(comments.some((c) => /<[a-z]/i.test(c.text))).toBe(false);
  });

  // Fails if: a post's view count is dropped, or one without a count gets a
  // counter anyway.
  it("counts views where the board showed them", async () => {
    const counted = await getPost("Reveal", "2593");
    if (!counted || counted.hits === null) throw new Error("Reveal/2593 lost its view count");
    expect(postJsonLd(counted, getBoard("Reveal"))?.["interactionStatistic"]).toMatchObject({
      userInteractionCount: counted.hits,
    });
    expect(postJsonLd(await post("26397"), BOARD)).not.toHaveProperty("interactionStatistic");
  });

  // Fails if: the trail skips a step or points off the public host.
  it("walks home › board › post", async () => {
    const items = breadcrumbJsonLd(await post("26397"), BOARD)["itemListElement"] as {
      position: number;
      item: string;
    }[];
    expect(items.map((i) => [i.position, i.item])).toEqual([
      [1, "https://forg.co.kr/"],
      [2, "https://forg.co.kr/UoBoard/"],
      [3, "https://forg.co.kr/UoBoard/26397/"],
    ]);
  });
});

// Fails if: the site's name or address in search results changes by accident.
it("names the site on its home page", () => {
  expect(websiteJsonLd()).toMatchObject({
    "@type": "WebSite",
    name: "forg.co.kr 디지털 박물관",
    url: "https://forg.co.kr/",
  });
});

// Fails if: a post's text can close the script tag that carries it.
it("keeps a post's text inside its script tag", () => {
  expect(serializeJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain("</");
});

// Fails if: a forg time goes out without Korean time, or a date alone or one
// that has its offset gets a second.
it("marks forg's times as Korean time", () => {
  expect(kst("2007-10-19T21:05:03")).toBe("2007-10-19T21:05:03+09:00");
  expect(kst("2007-10-19T21:05")).toBe("2007-10-19T21:05+09:00");
  expect(kst("2007-10-19")).toBe("2007-10-19");
  expect(kst("2019-01-28T15:38:00+09:00")).toBe("2019-01-28T15:38:00+09:00");
});

describe("plainText", () => {
  // Fails if: a style's rules, a tag or an entity reaches a description, two
  // lines run together, or an impossible character reference stops the build.
  it("keeps the words only", () => {
    expect(plainText("<style>p{color:red}</style><p>가&amp;나</p><p>다<br>라&middot;</p>")).toBe(
      "가&나 다 라·",
    );
    expect(plainText("a&#65;b&#x42;c&#0;d")).toBe("aAbBc d");
    expect(plainText("가&mdash;나 &starf;")).toBe("가—나 ★");
  });
});
