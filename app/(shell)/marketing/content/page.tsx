import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessMarketing } from "@/lib/rbac";
import { listPosts, marketingOptions } from "@/lib/data/marketing";
import { ContentScreen } from "./ContentScreen";

export const metadata = { title: "Content Calendar" };

export default async function ContentPage() {
  const session = await auth();
  if (!canAccessMarketing(session)) redirect("/home");
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [posts, options] = await Promise.all([listPosts({ from }), marketingOptions()]);
  return <ContentScreen posts={posts} {...options} />;
}
