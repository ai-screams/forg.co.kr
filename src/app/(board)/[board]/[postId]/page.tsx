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

import { PostView } from "@/components/post-view";
import { getBoard, isBoardId } from "@/lib/boards";
import { getAllPostParams, getPost } from "@/lib/posts";

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

  const boardMeta = getBoard(board);
  const titleSuffix = boardMeta ? ` · ${boardMeta.nameKr}` : "";
  const description = post.bodyText.slice(0, 160).trim();

  return {
    title: `${post.title}${titleSuffix} — forg.co.kr`,
    description: description || undefined,
    openGraph: {
      title: post.title,
      description: description || undefined,
      type: "article",
      authors: [post.author],
      publishedTime: post.createdAt,
    },
  };
}

export default async function PostPage({ params }: RouteProps) {
  const { board, postId } = await params;

  if (!isBoardId(board)) notFound();

  const post = await getPost(board, postId);
  if (!post) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <PostView post={post} />
    </div>
  );
}
