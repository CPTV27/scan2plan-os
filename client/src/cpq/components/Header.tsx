import { Link } from "wouter";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          <Link 
            href="/new-cpq" 
            className="flex items-center gap-2 text-xl font-bold text-primary hover-elevate active-elevate-2 px-3 py-2 rounded-md" 
            data-testid="link-home"
          >
            <span className="text-2xl">S2P</span>
          </Link>
        </div>
      </div>
    </header>
  );
}



