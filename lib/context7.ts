import { Context7 } from "@upstash/context7-sdk";

const apiKey = process.env.CONTEXT7_API_KEY;

export function createContext7Client() {
  if (!apiKey) throw new Error("CONTEXT7_API_KEY is not set");
  return new Context7({ apiKey });
}

export async function searchLibrary(query: string, libraryName: string) {
  const client = createContext7Client();
  return client.searchLibrary(query, libraryName);
}

export async function getContext(libraryId: string, question: string, opts?: any) {
  const client = createContext7Client();
  return client.getContext(question, libraryId, opts || { type: "txt" });
}

export default { createContext7Client, searchLibrary, getContext };
