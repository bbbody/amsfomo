import Link from "next/link";
import { Header } from "@/components/header";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-lg space-y-6">
          <p className="text-sm text-foreground leading-relaxed">
            Work in progress to help more easily keep an eye on upcoming events in Amsterdam.
          </p>
          <p className="text-sm font-bold text-foreground leading-relaxed">
            Pinned events are stored locally on your device so open on the same device to see your pins and take them with you.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            &larr; Back
          </Link>
        </div>
      </main>
    </div>
  );
}
