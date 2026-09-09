import { useEffect, useState } from "react";
import environment from "~/src/core/environment";

export const getBuildDate = () => document?.getElementById('__NEXT_DATA__')?.getAttribute('data-build-date') || null;

export const useBuildInfo = (returntType="string") => {
  const [buildInfo, setBuildInfo] = useState<string|object>("");

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fetch actual build timestamp from static file
    fetch('/build-info.json')
      .then(res => res.json())
      .then(data => {
        const script = document.getElementById('__NEXT_DATA__');
        const raw = script?.textContent?.trim();
        let buildId = null;

        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            buildId = parsed?.buildId;
          } catch (err) {
            console.warn('Failed to parse __NEXT_DATA__ payload', err);
          }
        }

        const formatted = [
          buildId ? `<br/> ID: ${buildId}` : null,
          data?.formatted ? `<br/> Built: ${data.formatted}` : null,
          data?.target ? `<br/> Target: ${data.target}` : null,
        ]
          .filter(Boolean)
          .join('');
          // console.log("[ BUILD INFO ]", { buildId, formatted, data });
        if (formatted && returntType === "object") {
          const obj = {
            id: buildId,
            ...data,
            target: data?.target,
          }
          setBuildInfo(obj);
        } else
        if (formatted) setBuildInfo(formatted);
      })
      .catch(err => {
        console.warn('Failed to load build info', err);
        // Fallback to just buildId if build-info.json is missing
        const script = document.getElementById('__NEXT_DATA__');
        const raw = script?.textContent?.trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const buildId = parsed?.buildId;
            if (buildId) setBuildInfo(`<br/> ID: ${buildId}`);
          } catch (err) {
            console.warn('Failed to parse __NEXT_DATA__ payload', err);
          }
        }
      });
  }, []);

  return buildInfo as any;
}
export default function HiddenBuildId({ hide = true }: { hide?: boolean }): any {
  const name = environment.merchant.name;
  const about = environment.merchant.settings?.about;
  // console.log({ about })

  return (
    <>
      {/* This part is safe for SEO */}
      <span id="buildId" style={hide?{ display: 'none' }:{}}>
        {name} | {about?.title} | {about?.description}
      </span>

      {/* This part is NOT rendered in the DOM, only logged */}
      {typeof window !== "undefined" && process.env.NODE_ENV !== "production" && (
        console.info(`[BUILD] Check /build-info.json for build timestamp`)
      )}
    </>
  );
}
