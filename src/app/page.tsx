import { Suspense } from "react";
import { LogsProvider } from "@/components/logs-provider";
import { LogsView } from "@/components/logs-view";

export default function Home() {
  return (
    <Suspense>
      <LogsProvider>
        <LogsView />
      </LogsProvider>
    </Suspense>
  );
}
