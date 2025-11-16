import axios from 'axios'

// Cache for LGA coordinates to avoid repeated API calls
const lgaCoordinatesCache = new Map()

/**
 * Geocode an LGA to get its coordinates using Nominatim (OpenStreetMap)
 * @param {string} lgaName - Name of the LGA
 * @param {string} stateName - Name of the state (for better accuracy)
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
async function geocodeLGA(lgaName, stateName) {
  const cacheKey = `${stateName}-${lgaName}`.toLowerCase()
  
  // Check cache first
  if (lgaCoordinatesCache.has(cacheKey)) {
    return lgaCoordinatesCache.get(cacheKey)
  }

  try {
    // Use Nominatim API (OpenStreetMap) - free and no API key required
    const query = `${lgaName}, ${stateName}, Nigeria`
    const encodedQuery = encodeURIComponent(query)
    
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&countrycodes=ng`,
      {
        headers: {
          'User-Agent': 'Holage/1.0 (contact@holage.com)'
        }
      }
    )

    const data = response.data

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
      
      // Validate coordinates (Nigeria is roughly between 4-14°N and 3-15°E)
      if (result.lat >= 4 && result.lat <= 14 && result.lng >= 3 && result.lng <= 15) {
        // Cache the result
        lgaCoordinatesCache.set(cacheKey, result)
        
        // Rate limiting: Nominatim allows 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1100))
        
        return result
      }
    }

    return null
  } catch (error) {
    console.error(`Error geocoding LGA ${lgaName}, ${stateName}:`, error.message)
    return null
  }
}

/**
 * Get coordinates for an LGA, with fallback to state capital if LGA not found
 * @param {string} stateSlug - State slug
 * @param {string} lgaSlug - LGA slug
 * @param {object} stateCoordinates - State coordinates map
 * @returns {Promise<{lat: number, lng: number}>}
 */
export async function getLGACoordinates(stateSlug, lgaSlug, stateCoordinates) {
  if (!stateSlug || !lgaSlug) {
    // Fallback to state capital
    const stateInfo = stateCoordinates[stateSlug]
    if (stateInfo) {
      return { lat: stateInfo.lat, lng: stateInfo.lng }
    }
    throw new Error(`Invalid state: ${stateSlug}`)
  }

  // Convert slugs to names for geocoding
  const stateName = stateCoordinates[stateSlug]?.name || stateSlug
  const lgaName = lgaSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Try to get LGA coordinates
  const lgaCoords = await geocodeLGA(lgaName, stateName)
  
  if (lgaCoords) {
    return lgaCoords
  }

  // Fallback to state capital if LGA geocoding fails
  const stateInfo = stateCoordinates[stateSlug]
  if (stateInfo) {
    console.warn(`Using state capital coordinates for ${lgaName}, ${stateName}`)
    return { lat: stateInfo.lat, lng: stateInfo.lng }
  }

  throw new Error(`Invalid state: ${stateSlug}`)
}

/**
 * Batch geocode multiple LGAs (with rate limiting)
 * @param {Array<{stateSlug: string, lgaSlug: string, stateName: string, lgaName: string}>} lgas
 * @returns {Promise<Map<string, {lat: number, lng: number}>>}
 */
export async function batchGeocodeLGAs(lgas, stateCoordinates) {
  const results = new Map()
  
  for (const { stateSlug, lgaSlug, stateName, lgaName } of lgas) {
    try {
      const coords = await getLGACoordinates(stateSlug, lgaSlug, stateCoordinates)
      results.set(`${stateSlug}-${lgaSlug}`, coords)
    } catch (error) {
      console.error(`Failed to geocode ${lgaName}, ${stateName}:`, error.message)
    }
  }
  
  return results
}

export { lgaCoordinatesCache }

