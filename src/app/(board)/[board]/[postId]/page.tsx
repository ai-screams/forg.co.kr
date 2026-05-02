/**
 * Single-post route — `/[board]/[postId]`.
 *
 * Statically exported (`output: "export"`); every (board, postId) pair we
 * have content for is materialised at build time via `generateStaticParams`.
 * `dynamicParams = false` turns missing ids into build errors instead of
 * runtime 404s, which is what we want for a frozen archive.
 *
 * Per the Next.js 16 / React 19 RSC contract, the `params` argument is a
 * Promise — `await` before destructuring.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EraToggle } from "@/components/era-toggle";
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
    <div className="flex min-h-screen flex-col bg-(--era-page-bg)">
      <header className="border-b border-(--era-input-border) bg-(--era-content-bg)">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-forg-ink font-forg text-lg font-bold">
            forg.co.kr
          </Link>
          <EraToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <PostView post={post} />
      </main>

      <footer className="text-forg-cream border-t border-(--era-input-border) bg-(--era-footer-bg)">
        <div className="mx-auto max-w-3xl px-6 py-4 text-xs">
          <p>
            forg.co.kr 디지털 박물관 · 비영리 보존 프로젝트 · 원본 글의 저작권은 작성자에게 있음
          </p>
        </div>
      </footer>
    </div>
  );
}
