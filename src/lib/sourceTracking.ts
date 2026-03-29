export interface SourceTrackingPayload {
  source: string | null;
  referrer: string | null;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

const TRACKING_KEYS = ["source", "src", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function getTrackingQueryString(params: URLSearchParams): string {
  const trackingParams = new URLSearchParams();
  TRACKING_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      trackingParams.set(key, value);
    }
  });
  const queryString = trackingParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function getSourceTrackingPayload(params: URLSearchParams, pathname: string): SourceTrackingPayload {
  const source = params.get("source") ?? params.get("src") ?? params.get("utm_source");
  const fullPath = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;

  return {
    source: source ?? null,
    referrer: typeof document !== "undefined" ? (document.referrer || null) : null,
    landing_path: fullPath,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
  };
}
