/**
 * Single-post route — `/[board]/[postId]`.
 *
 * Statically exported (`output: "export"`); every (board, postId) pair we
 * have content for is materialised at build time via `generateStaticParams`.
 * `dynamicParams = false` turns missing ids into build errors instead of
 * runtime 404s, which is what we want for a frozen archive.
 *
 * Per the Next.js 16 / React 19 RSC contract, the `params` argument is a
 * Promise — `await` before destructuring. Page chrome (header/footer)
 * lives in the root layout; this page renders only the article container.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { PostView } from "@/components/post-view";
import { getBoard, isBoardId } from "@/lib/boards";
import { isUnknownDate } from "@/lib/dates";
import { getAdjacentPosts, getAllPostParams, getPost } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";
import { breadcrumbJsonLd, postJsonLd } from "@/lib/structured-data";

export const dynamicParams = false;

interface RouteParams {
  board: string;
  postId: string;
}

interface RouteProps {
  params: Promise<RouteParams>;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  return getAllPostParams();
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { board, postId } = await params;
  if (!isBoardId(board)) return {};

  const post = await getPost(board, postId);
  if (!post) return {};

  const { nameKr } = getBoard(board);
  // A post of pictures alone has no text: say where it is from instead.
  const description = post.bodyText.slice(0, 160).trim() || `${nameKr}에 올라온 글 — forg.co.kr`;

  return pageMeta({
    title: `${post.title} · ${nameKr} — forg.co.kr`,
    shareTitle: post.title,
    description,
    path: `/${board}/${postId}/`,
    article: {
      authors: [post.author],
      publishedTime: isUnknownDate(post.createdAt) ? undefined : post.createdAt,
    },
  });
}

export default async function PostPage({ params }: RouteProps) {
  const { board, postId } = await params;

  if (!isBoardId(board)) notFound();

  const [post, adjacent] = await Promise.all([
    getPost(board, postId),
    getAdjacentPosts(board, postId),
  ]);
  if (!post) notFound();

  const meta = getBoard(board);
  const forum = postJsonLd(post, meta);
  return (
    <>
      {forum && <JsonLd data={forum} />}
      <JsonLd data={breadcrumbJsonLd(post, meta)} />
      <PostView post={post} adjacent={adjacent} />
    </>
  );
}
