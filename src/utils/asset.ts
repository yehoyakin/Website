export const asset = (path: string) =>
  `${import.meta.env.BASE_URL}${encodeURI(path.replace(/^\/+/, ""))}`;

/**
 * True for absolute URLs (https:, protocol-relative //, data:, blob:) that must
 * be used as-is instead of being prefixed with BASE_URL by asset().
 */
export const isRemoteUrl = (path: string) =>
  /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path.trim()) ||
  /^data:/i.test(path.trim());
