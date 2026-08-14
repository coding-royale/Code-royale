import { AppShell } from "@/components/app-shell";
import { PracticeLobby } from "./practice-lobby";

export default function PracticePage() {
  return (
    <AppShell>
      <div className="p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Practice Arena</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the problem set and pick any challenge to solve. Filter by difficulty or go random.
          </p>
        </header>
        <PracticeLobby />
      </div>
    </AppShell>
  );
}
