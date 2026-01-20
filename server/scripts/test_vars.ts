
import { substituteVariables } from "../lib/variableSubstitution";

console.log("Importing...");
try {
    const res = substituteVariables("Hello {{client_name}}", { clientName: "World" } as any, {} as any);
    console.log("Result:", res);
} catch (e) {
    console.error(e);
}
