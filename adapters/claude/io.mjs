/** Reads all of a stream as UTF-8, strips a BOM and parses it as JSON. */
export async function readStdinJson(stream = process.stdin) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8").replace(/^﻿/, "");
  return JSON.parse(text);
}
