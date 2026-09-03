const CANONICAL_WMS_ORIGIN = 'https://www.anhwms.com';
const WMS_HOSTS = new Set(['anhwms.com', 'www.anhwms.com', 'localhost', '127.0.0.1']);

function toOrigin(value: string) {
  return new URL(value).origin;
}

export function isWmsShareOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return WMS_HOSTS.has(host) || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function resolvePublicShareOrigin(requestUrl: string) {
  const requestOrigin = toOrigin(requestUrl);
  if (isWmsShareOrigin(requestOrigin)) {
    return requestOrigin;
  }

  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    try {
      const configuredOrigin = toOrigin(configured);
      if (isWmsShareOrigin(configuredOrigin)) {
        return configuredOrigin;
      }
    } catch {
      // Ignore invalid NEXT_PUBLIC_SITE_URL and keep the request origin.
    }
  }

  return requestOrigin || CANONICAL_WMS_ORIGIN;
}

export function buildInboundSharePath(slug: string) {
  return `/share/inbound/${encodeURIComponent(slug)}`;
}

export function buildInboundShareUrl(slug: string, origin: string) {
  return `${origin.replace(/\/$/, '')}${buildInboundSharePath(slug)}`;
}
