import type { ApartmentSearchResult } from "../types/apartmentSearch";

type LatLng = { latitude: number; longitude: number };

type RentCastListing = {
  id: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  price?: number;
  daysOnMarket?: number;
  listingAgent?: { name?: string; website?: string | null };
  listingOffice?: { name?: string; website?: string | null };
};

function milesBetween(from: LatLng, to: LatLng): number {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function listingToResult(listing: RentCastListing, center: LatLng): ApartmentSearchResult | null {
  const line1 = listing.addressLine1?.trim();
  const line2 = listing.addressLine2?.trim();
  const formatted = listing.formattedAddress?.trim();
  const address =
    formatted ||
    [line1, line2, listing.city, listing.state, listing.zipCode].filter(Boolean).join(", ") ||
    null;
  if (!address) return null;

  const name =
    line1 && line2 ? `${line1}, ${line2}` : line1 || formatted || "Rental listing";

  const lat = listing.latitude;
  const lon = listing.longitude;
  const distanceMiles =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? milesBetween(center, { latitude: lat, longitude: lon })
      : null;

  const beds = listing.bedrooms;
  const bedroomsLabel =
    beds === 0 ? "Studio" : typeof beds === "number" ? `${beds} bedroom${beds === 1 ? "" : "s"}` : "Bedrooms vary";

  const price = listing.price;
  const priceLabel =
    typeof price === "number" && Number.isFinite(price) ? `$${Math.round(price)}/mo` : "Rent on request";

  const highlights: string[] = ["RentCast rental listing"];
  if (listing.propertyType) highlights.push(listing.propertyType);
  if (typeof listing.bathrooms === "number") highlights.push(`${listing.bathrooms} bath`);
  if (typeof listing.squareFootage === "number") highlights.push(`${listing.squareFootage} sq ft`);
  if (typeof listing.daysOnMarket === "number") highlights.push(`${listing.daysOnMarket} days on market`);

  const websiteUrl =
    normalizeWebsite(listing.listingAgent?.website) ??
    normalizeWebsite(listing.listingOffice?.website) ??
    `https://www.google.com/search?q=${encodeURIComponent(`${address} for rent`)}`;

  return {
    id: `rentcast-${listing.id}`,
    name,
    address,
    distanceMiles,
    bedroomsLabel,
    priceLabel,
    highlights,
    websiteUrl,
    source: "rentcast",
  };
}

const PROXY_PATH = "/api/rentcast/listings/rental/long-term";

/**
 * Fetches long-term rental listings near a point via the Vite dev/preview proxy
 * (`/api/rentcast` → api.rentcast.io). Set `RENTCAST_API_KEY` in `.env` (not `VITE_`).
 */
export async function fetchRentCastApartmentsNear(
  center: LatLng,
  options?: { radiusMiles?: number; limit?: number }
): Promise<ApartmentSearchResult[]> {
  const radius = options?.radiusMiles ?? 15;
  const limit = options?.limit ?? 25;
  const params = new URLSearchParams({
    latitude: String(center.latitude),
    longitude: String(center.longitude),
    radius: String(Math.min(100, Math.max(1, radius))),
    limit: String(Math.min(500, Math.max(1, limit))),
    status: "Active",
  });

  const response = await fetch(`${PROXY_PATH}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const snippet = await response.text().catch(() => "");
    throw new Error(`RentCast ${response.status}: ${snippet.slice(0, 200)}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const out: ApartmentSearchResult[] = [];
  for (const item of data) {
    const mapped = listingToResult(item as RentCastListing, center);
    if (mapped) out.push(mapped);
  }

  out.sort((a, b) => {
    if (a.distanceMiles == null && b.distanceMiles == null) return 0;
    if (a.distanceMiles == null) return 1;
    if (b.distanceMiles == null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });

  return out.slice(0, 20);
}
