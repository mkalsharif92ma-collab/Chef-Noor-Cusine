/**
 * Temporary brand photography.
 * Replace any URL with a local file later, e.g. "/images/hero.jpg".
 */
const unsplash = (photoId, width = 1600) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=80`

export const brandImages = {
  hero: unsplash("photo-1504674900247-0877df9cc836", 1920),
  circle: unsplash("photo-1546069901-ba9599a7e63c", 900),
  story: unsplash("photo-1414235077428-338989a2e8c0", 1400),
  cta: unsplash("photo-1476224203421-9ac39bcb3327", 1400),
  meals: [
    unsplash("photo-1567620905732-2d1ec7ab7445", 1200),
    unsplash("photo-1512621776951-a57141f2eefd", 1200),
    unsplash("photo-1467003909585-2f8a72700288", 1200),
    unsplash("photo-1473093295043-cdd812d0e601", 1200),
    unsplash("photo-1482049016688-2d3e1b311543", 1200),
    unsplash("photo-1551183053-bf71b1e09e2d", 1200),
  ],
}

export function mealFallbackImage(index = 0) {
  const list = brandImages.meals
  return list[index % list.length]
}
