/** Filters only observed OSM tags. Missing tags are unknown, not a confirmed absence. */
export function filterOsmPlaces(places, filters) {
  return places.filter((place) =>
    (filters.filter === "all" || (filters.filter === "with" ? Boolean(place.website) : !place.website)) &&
    (filters.phoneFilter !== "with" || Boolean(place.phone)) &&
    (filters.socialFilter !== "with" || Boolean(place.social?.instagram || place.social?.facebook))
  );
}
