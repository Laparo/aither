# Context7 (Installation & Nutzung)

Kurzanleitung zur Integration von Context7 in dieses Projekt (`aither`).

- Paket installiert: `@upstash/context7-sdk`
- Env-Variable: `CONTEXT7_API_KEY` (API-Key im Format `ctx7sk_...`)

Beispiel (TypeScript):

```ts
import { Context7 } from "@upstash/context7-sdk";

const client = new Context7({ apiKey: process.env.CONTEXT7_API_KEY });

async function getDocs(libraryName: string, question: string) {
  const libs = await client.searchLibrary(question, libraryName);
  if (!libs || libs.length === 0) return null;
  const lib = libs[0];
  let context;
  try {
    // getContext may throw; guard and return a defined fallback on error
    context = await client.getContext(lib.id, question, { type: "txt" });
  } catch (err) {
    // Surface the error to the existing logging/monitoring pipeline and
    // return a safe fallback so callers can handle an empty context.
    console.error('Context7 getContext failed', { libraryId: lib.id, err });
    context = { text: "", error: String(err) };
  }
  return { lib, context };
}

export { getDocs };
```

Empfehlungen:
- Setze `CONTEXT7_API_KEY` in deiner lokalen `.env.local` (niemals echte Keys commiten).
- Verwende `searchLibrary` vor `getContext`, um die passende Library-ID zu ermitteln.
- Bei produktiver Nutzung Caching für die Abfragen in `lib/cache` oder Redis verwenden.
