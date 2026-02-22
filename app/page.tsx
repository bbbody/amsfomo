import { EventList } from "@/components/event-list";
import { Header } from "@/components/header";
import { getAllEvents, getLastUpdated } from "@/lib/events";

export default function Home() {
  const events = getAllEvents();
  const lastUpdated = getLastUpdated();

  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} />
      <main className="mx-auto max-w-6xl px-4 py-4">
        <EventList events={events} />
      </main>
    </div>
  );
}
