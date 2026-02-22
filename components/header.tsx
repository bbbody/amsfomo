import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header({ lastUpdated }: { lastUpdated?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div>
          <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80">
            AMSFOMO
          </Link>
          {lastUpdated && (
            <p className="text-[11px] text-muted-foreground leading-none">
              Updated{" "}
              {new Date(lastUpdated).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/about"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
