import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AssistantShell } from "@/components/assistant/assistant-shell";

export const metadata: Metadata = {
  title: "Northstar Assistant",
  description: "A customer assistant with context that carries across sessions.",
};

export default async function AssistantPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <AssistantShell />;
}
