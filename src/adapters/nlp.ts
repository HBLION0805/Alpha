/**
 * Adapter: natural (MIT) — the only file that imports it. Porter stemming only; callers own stopwords, aliases and thresholds.
 * Deep import on purpose: the package root also loads storage backends (dotenv banner on stdout, ~1s startup).
 */
import { createRequire } from "node:module";

const PorterStemmer = createRequire(import.meta.url)("natural/lib/natural/stemmers/porter_stemmer.js") as { stem(w: string): string };
export const stemWord = (w: string): string => PorterStemmer.stem(w);
