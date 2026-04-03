export type ApartmentSearchSource = "rentcast" | "api" | "mock";

export type ApartmentSearchResult = {
  id: string;
  name: string;
  address: string;
  distanceMiles: number | null;
  bedroomsLabel: string;
  priceLabel: string;
  highlights: string[];
  websiteUrl: string | null;
  source: ApartmentSearchSource;
};
