import { readFileSync } from "node:fs";
import path from "node:path";

import Script from "next/script";

// The ATS shell is sourced from index.html, which Next.js does not track as a
// module dependency. Render it at request time so deployments cannot reuse a
// stale prerendered shell after index.html changes.
export const dynamic = "force-dynamic";

function readStaticAppBody() {
  const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? html;

  return bodyHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").trim();
}

export default function HomePage() {
  const appBody = readStaticAppBody();

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: appBody }} />
      <Script
        id="agodly-api-base"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "window.AGODLY_API_BASE = window.location.origin;"
        }}
      />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js" strategy="afterInteractive" />
      <Script src="/ats-script" strategy="afterInteractive" />
    </>
  );
}
