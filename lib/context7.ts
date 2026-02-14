import { Context7, Context7Error } from "@upstash/context7-sdk";

const apiKey = process.env.CONTEXT7_API_KEY;

export function createContext7Client() {
  if (!apiKey) throw new Error("CONTEXT7_API_KEY is not set");
  return new Context7({ apiKey });
}

export async function searchLibrary(query: string, libraryName: string) {
  const client = createContext7Client();
  try {
    const results = await client.searchLibrary(query, libraryName);
    return results;
  } catch (err) {
    if (err instanceof Context7Error) throw err;
    throw err;
  }
}

export async function getContext(libraryId: string, question: string, opts?: any) {
  const client = createContext7Client();
  return client.getContext(question, libraryId, opts || { type: "txt" });
}

export default { createContext7Client, searchLibrary, getContext };
