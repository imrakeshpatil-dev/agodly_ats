// Runs once when the Next.js server process starts. The Node-only work lives in
// instrumentation.node.ts and is imported ONLY inside the nodejs-runtime branch,
// so the Edge bundle never tries to resolve Node built-ins like `fs`.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { init } = await import("./instrumentation.node");
    await init();
  }
}
