const BIGINT_BUFFER_WARNING = "bigint: Failed to load bindings, pure JS will be used";

export function suppressKnownSolanaNativeFallbackWarning(): void {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith(BIGINT_BUFFER_WARNING)) {
      return;
    }
    originalWarn(...args);
  };

  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    if (text.startsWith(BIGINT_BUFFER_WARNING)) {
      return true;
    }
    return originalStderrWrite(chunk as string & Uint8Array, ...(args as []));
  }) as typeof process.stderr.write;
}
