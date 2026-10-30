import { SharedOperations } from "@/components/shared/SharedOperations";
export default function MultiplexerPage() {
  return (
    <SharedOperations
      base="/api/multiplexer"
      otherUrl="https://the-multiplexer-production.up.railway.app/shared"
      otherLabel="Open Multiplexer"
    />
  );
}
