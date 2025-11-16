// Nigerian State Capitals with Coordinates (Latitude, Longitude)
const stateCoordinates = {
  'abia': { name: 'Abia', capital: 'Umuahia', lat: 5.5254, lng: 7.4868 },
  'adamawa': { name: 'Adamawa', capital: 'Yola', lat: 9.2094, lng: 12.4767 },
  'akwa-ibom': { name: 'Akwa Ibom', capital: 'Uyo', lat: 5.0378, lng: 7.9085 },
  'anambra': { name: 'Anambra', capital: 'Awka', lat: 6.2107, lng: 7.0719 },
  'bauchi': { name: 'Bauchi', capital: 'Bauchi', lat: 10.3158, lng: 9.8442 },
  'bayelsa': { name: 'Bayelsa', capital: 'Yenagoa', lat: 4.9267, lng: 6.2676 },
  'benue': { name: 'Benue', capital: 'Makurdi', lat: 7.7316, lng: 8.5378 },
  'borno': { name: 'Borno', capital: 'Maiduguri', lat: 11.8333, lng: 13.1500 },
  'cross-river': { name: 'Cross River', capital: 'Calabar', lat: 4.9517, lng: 8.3417 },
  'delta': { name: 'Delta', capital: 'Asaba', lat: 6.1987, lng: 6.7337 },
  'ebonyi': { name: 'Ebonyi', capital: 'Abakaliki', lat: 6.3250, lng: 8.1137 },
  'edo': { name: 'Edo', capital: 'Benin City', lat: 6.3350, lng: 5.6037 },
  'ekiti': { name: 'Ekiti', capital: 'Ado-Ekiti', lat: 7.6211, lng: 5.2208 },
  'enugu': { name: 'Enugu', capital: 'Enugu', lat: 6.4403, lng: 7.4943 },
  'gombe': { name: 'Gombe', capital: 'Gombe', lat: 10.2904, lng: 11.1711 },
  'imo': { name: 'Imo', capital: 'Owerri', lat: 5.4840, lng: 7.0351 },
  'jigawa': { name: 'Jigawa', capital: 'Dutse', lat: 11.7570, lng: 9.3384 },
  'kaduna': { name: 'Kaduna', capital: 'Kaduna', lat: 10.5222, lng: 7.4383 },
  'kano': { name: 'Kano', capital: 'Kano', lat: 12.0022, lng: 8.5920 },
  'katsina': { name: 'Katsina', capital: 'Katsina', lat: 12.9908, lng: 7.6017 },
  'kebbi': { name: 'Kebbi', capital: 'Birnin Kebbi', lat: 12.4539, lng: 4.1975 },
  'kogi': { name: 'Kogi', capital: 'Lokoja', lat: 7.7974, lng: 6.7407 },
  'kwara': { name: 'Kwara', capital: 'Ilorin', lat: 8.4966, lng: 4.5426 },
  'lagos': { name: 'Lagos', capital: 'Ikeja', lat: 6.6018, lng: 3.3515 },
  'nasarawa': { name: 'Nasarawa', capital: 'Lafia', lat: 8.4939, lng: 8.5211 },
  'niger': { name: 'Niger', capital: 'Minna', lat: 9.6137, lng: 6.5569 },
  'ogun': { name: 'Ogun', capital: 'Abeokuta', lat: 7.1475, lng: 3.3619 },
  'ondo': { name: 'Ondo', capital: 'Akure', lat: 7.2571, lng: 5.2058 },
  'osun': { name: 'Osun', capital: 'Osogbo', lat: 7.7670, lng: 4.5560 },
  'oyo': { name: 'Oyo', capital: 'Ibadan', lat: 7.3775, lng: 3.9470 },
  'plateau': { name: 'Plateau', capital: 'Jos', lat: 9.9182, lng: 8.8920 },
  'rivers': { name: 'Rivers', capital: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  'sokoto': { name: 'Sokoto', capital: 'Sokoto', lat: 13.0622, lng: 5.2339 },
  'taraba': { name: 'Taraba', capital: 'Jalingo', lat: 8.8833, lng: 11.3667 },
  'yobe': { name: 'Yobe', capital: 'Damaturu', lat: 11.7478, lng: 11.9605 },
  'zamfara': { name: 'Zamfara', capital: 'Gusau', lat: 12.1704, lng: 6.6590 },
  'fct': { name: 'Federal Capital Territory', capital: 'Abuja', lat: 9.0765, lng: 7.3986 }
}

const stateAliases = {
  'federal-capital-territory': 'fct',
  'abuja': 'fct',
}

const slugify = (value) => {
  if (!value) return ''
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
}

const titleCase = (value) => {
  if (!value) return ''
  return value
    .toString()
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const generateOffsetFromSlug = (slug) => {
  if (!slug) {
    return { latOffset: 0, lngOffset: 0 }
  }

  let hash = 0
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 33 + slug.charCodeAt(i)) >>> 0
  }

  const latOffset = (((hash % 1600) / 1600) - 0.5) * 1.2 // +/- 0.6 degrees
  const lngOffset = ((((Math.floor(hash / 1600)) % 1600) / 1600) - 0.5) * 1.2

  return { latOffset, lngOffset }
}

const normalizeState = (state) => {
  if (!state) return null
  let slug = slugify(state)
  if (stateAliases[slug]) {
    slug = stateAliases[slug]
  }
  return slug
}

/**
 * Get location coordinates with improved LGA handling
 * Uses geocoding when available, falls back to improved offset calculation
 */
const getLocationCoordinates = async (stateInput, lgaInput) => {
  const stateSlug = normalizeState(stateInput)
  if (!stateSlug || !stateCoordinates[stateSlug]) {
    throw new Error(`Invalid state: ${stateInput}`)
  }

  const stateInfo = stateCoordinates[stateSlug]

  if (!lgaInput) {
    return {
      lat: stateInfo.lat,
      lng: stateInfo.lng,
      stateName: stateInfo.name,
      stateSlug,
      lgaName: null,
      lgaSlug: null,
    }
  }

  const lgaSlug = slugify(lgaInput)
  
  // Try to get LGA coordinates from geocoding service
  try {
    const { getLGACoordinates } = await import('./lgaGeocoder.js')
    const lgaCoords = await getLGACoordinates(stateSlug, lgaSlug, stateCoordinates)
    
    return {
      lat: lgaCoords.lat,
      lng: lgaCoords.lng,
      stateName: stateInfo.name,
      stateSlug,
      lgaName: titleCase(lgaInput),
      lgaSlug,
    }
  } catch (error) {
    // Fallback to improved offset calculation if geocoding fails
    console.warn(`Geocoding failed for ${lgaInput}, ${stateInfo.name}, using offset calculation:`, error.message)
    
    // Improved offset calculation based on LGA characteristics
    const { latOffset, lngOffset } = generateOffsetFromSlug(lgaSlug)
    
    // Adjust offset based on LGA name patterns (more accurate distribution)
    let adjustedLatOffset = latOffset
    let adjustedLngOffset = lngOffset
    
    // If LGA name contains directional indicators, adjust accordingly
    const lgaLower = lgaSlug.toLowerCase()
    if (lgaLower.includes('north') || lgaLower.includes('northern')) {
      adjustedLatOffset += 0.2 // Move north
    }
    if (lgaLower.includes('south') || lgaLower.includes('southern')) {
      adjustedLatOffset -= 0.2 // Move south
    }
    if (lgaLower.includes('east') || lgaLower.includes('eastern')) {
      adjustedLngOffset += 0.2 // Move east
    }
    if (lgaLower.includes('west') || lgaLower.includes('western')) {
      adjustedLngOffset -= 0.2 // Move west
    }
    
    return {
      lat: stateInfo.lat + adjustedLatOffset,
      lng: stateInfo.lng + adjustedLngOffset,
      stateName: stateInfo.name,
      stateSlug,
      lgaName: titleCase(lgaInput),
      lgaSlug,
    }
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in kilometers
  
  // Convert degrees to radians
  const toRad = (degree) => degree * (Math.PI / 180)
  
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  const distance = R * c
  
  return Math.round(distance) // Return rounded distance in km
}

/**
 * Calculate distance and duration using OSRM (Open Source Routing Machine) API
 * This provides more accurate road-based distance and duration
 * 
 * @param {number} startLat - Starting latitude
 * @param {number} startLon - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLon - Ending longitude
 * @returns {Promise<{distance: number, duration: number}>} Distance in km and duration in minutes
 */
async function calculateOSRMDistance(startLat, startLon, endLat, endLon) {
  try {
    const axios = (await import('axios')).default
    // OSRM API expects: lon,lat;lon,lat format
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`
    
    console.log(`OSRM API call: ${url}`)
    
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Holage/1.0'
      }
    })

    const data = response.data

    // Check if response is valid
    if (!data || data.code !== 'Ok') {
      throw new Error(data?.code === 'NoRoute' ? 'No route found between locations' : 'Invalid OSRM response')
    }

    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('No routes in OSRM response')
    }

    const route = data.routes[0]
    
    // Validate route data
    if (typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      throw new Error('Invalid route data: missing distance or duration')
    }

    // Convert distance from meters to kilometers
    const distanceKm = route.distance / 1000
    // Convert duration from seconds to minutes
    const durationMin = route.duration / 60

    console.log(`OSRM result: ${distanceKm.toFixed(2)} km, ${durationMin.toFixed(1)} minutes`)

    return {
      distance: Math.round(distanceKm * 10) / 10, // Round to 1 decimal place
      duration: Math.round(durationMin)
    }
  } catch (error) {
    console.error('OSRM API error:', error.message)
    // Re-throw with more context if it's an axios error
    if (error.response) {
      throw new Error(`OSRM API error: ${error.response.status} - ${error.response.statusText}`)
    }
    throw error
  }
}

/**
 * Calculate estimated distance between two Nigerian states/LGAs
 * 
 * @param {string} pickupState - Pickup state code (e.g., 'lagos', 'abuja')
 * @param {string} destinationState - Destination state code
 * @param {string} pickupLga - Pickup LGA slug (optional)
 * @param {string} destinationLga - Destination LGA slug (optional)
 * @param {object} pickupCoordinates - Optional: {lat, lng} for pickup location
 * @param {object} destinationCoordinates - Optional: {lat, lng} for destination location
 * @returns {Promise<object>} Object containing distance and route info
 */
// Validate coordinates are within Nigeria bounds
function validateNigeriaCoordinates(lat, lng) {
  // Nigeria bounds: approximately lat 4.2-13.9, lng 2.7-14.7
  if (lat < 4 || lat > 14 || lng < 2 || lng > 15) {
    console.warn(`Coordinates out of Nigeria bounds: lat=${lat}, lng=${lng}`)
    return false
  }
  return true
}

// Check if coordinates might be swapped and correct them
function correctSwappedCoordinates(lat, lng, stateName) {
  // If latitude is less than longitude and both are reasonable for Nigeria, they might be swapped
  // Also check if lat is suspiciously low for northern states
  const northernStates = ['kano', 'kaduna', 'sokoto', 'katsina', 'zamfara', 'kebbi', 'jigawa', 'yobe', 'borno', 'bauchi', 'gombe', 'adamawa', 'taraba']
  const isNorthernState = northernStates.includes(stateName?.toLowerCase() || '')
  
  // Northern states should have lat > 10, if lat < 10 and lng is reasonable, might be swapped
  if (isNorthernState && lat < 10 && lng > 4 && lng < 15) {
    console.warn(`Possible swapped coordinates for ${stateName}: lat=${lat}, lng=${lng}. Swapping...`)
    return { lat: lng, lng: lat }
  }
  
  // General check: if lat < lng and both are in Nigeria range, might be swapped
  if (lat < lng && lat > 2 && lat < 15 && lng > 2 && lng < 15) {
    // But only swap if the swapped version makes more sense (lat should be in 4-14 range)
    const swappedLat = lng
    if (swappedLat >= 4 && swappedLat <= 14) {
      console.warn(`Possible swapped coordinates: lat=${lat}, lng=${lng}. Swapping...`)
      return { lat: lng, lng: lat }
    }
  }
  
  return { lat, lng }
}

async function calculateStateDistance(pickupState, destinationState, pickupLga = null, destinationLga = null, pickupCoordinates = null, destinationCoordinates = null) {
  let pickupInfo, destinationInfo
  
  // Use provided coordinates if available, otherwise get from state/LGA
  if (pickupCoordinates && pickupCoordinates.lat && pickupCoordinates.lng) {
    // Check and correct swapped coordinates
    const corrected = correctSwappedCoordinates(pickupCoordinates.lat, pickupCoordinates.lng, pickupState)
    
    // Validate coordinates
    if (!validateNigeriaCoordinates(corrected.lat, corrected.lng)) {
      console.warn(`Invalid pickup coordinates for ${pickupState}/${pickupLga}: lat=${corrected.lat}, lng=${corrected.lng}. Attempting to geocode...`)
      // Fall back to geocoding if coordinates are invalid
      pickupInfo = await getLocationCoordinates(pickupState, pickupLga)
    } else {
      pickupInfo = {
        lat: corrected.lat,
        lng: corrected.lng,
        stateName: pickupState ? titleCase(pickupState) : 'Unknown',
        stateSlug: normalizeState(pickupState) || '',
        lgaName: pickupLga ? titleCase(pickupLga) : null,
        lgaSlug: pickupLga ? slugify(pickupLga) : null,
      }
    }
  } else {
    pickupInfo = await getLocationCoordinates(pickupState, pickupLga)
  }
  
  if (destinationCoordinates && destinationCoordinates.lat && destinationCoordinates.lng) {
    // Check and correct swapped coordinates
    const corrected = correctSwappedCoordinates(destinationCoordinates.lat, destinationCoordinates.lng, destinationState)
    
    // Validate coordinates
    if (!validateNigeriaCoordinates(corrected.lat, corrected.lng)) {
      console.warn(`Invalid destination coordinates for ${destinationState}/${destinationLga}: lat=${corrected.lat}, lng=${corrected.lng}. Attempting to geocode...`)
      // Fall back to geocoding if coordinates are invalid
      destinationInfo = await getLocationCoordinates(destinationState, destinationLga)
    } else {
      destinationInfo = {
        lat: corrected.lat,
        lng: corrected.lng,
        stateName: destinationState ? titleCase(destinationState) : 'Unknown',
        stateSlug: normalizeState(destinationState) || '',
        lgaName: destinationLga ? titleCase(destinationLga) : null,
        lgaSlug: destinationLga ? slugify(destinationLga) : null,
      }
    }
  } else {
    destinationInfo = await getLocationCoordinates(destinationState, destinationLga)
  }
  
  // Log coordinates being used for debugging
  console.log(`Distance calculation: ${pickupState}/${pickupLga} (${pickupInfo.lat}, ${pickupInfo.lng}) to ${destinationState}/${destinationLga} (${destinationInfo.lat}, ${destinationInfo.lng})`)

  // If both state and LGA match
  if (
    pickupInfo.stateSlug === destinationInfo.stateSlug &&
    (pickupInfo.lgaSlug || '') === (destinationInfo.lgaSlug || '')
  ) {
    return {
      pickupState: pickupInfo.stateName,
      pickupLga: pickupInfo.lgaName,
      destinationState: destinationInfo.stateName,
      destinationLga: destinationInfo.lgaName,
      distance: 0,
      estimatedDuration: '0 hours',
      route: pickupInfo.lgaName
        ? `Within ${pickupInfo.lgaName}, ${pickupInfo.stateName}`
        : `Within ${pickupInfo.stateName} State`,
    }
  }

  // Try to use OSRM API for accurate road-based distance if coordinates are available
  let distance, estimatedDuration
  
  try {
    const osrmResult = await calculateOSRMDistance(
      pickupInfo.lat,
      pickupInfo.lng,
      destinationInfo.lat,
      destinationInfo.lng
    )
    
    distance = osrmResult.distance
    const durationMinutes = osrmResult.duration
    
    // Format duration
    if (durationMinutes < 60) {
      estimatedDuration = `${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}`
    } else if (durationMinutes < 1440) {
      const hours = Math.floor(durationMinutes / 60)
      const minutes = durationMinutes % 60
      if (minutes === 0) {
        estimatedDuration = `${hours} ${hours === 1 ? 'hour' : 'hours'}`
      } else {
        estimatedDuration = `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
      }
    } else {
      const days = Math.floor(durationMinutes / 1440)
      const remainingHours = Math.floor((durationMinutes % 1440) / 60)
      if (remainingHours === 0) {
        estimatedDuration = `${days} ${days === 1 ? 'day' : 'days'}`
      } else {
        estimatedDuration = `${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`
      }
    }
  } catch (osrmError) {
    // Fallback to Haversine distance if OSRM fails
    console.warn('OSRM calculation failed, using Haversine distance:', osrmError.message)
    distance = haversineDistance(
      pickupInfo.lat,
      pickupInfo.lng,
      destinationInfo.lat,
      destinationInfo.lng,
    )

    const averageSpeed = 60
    const durationHours = Math.ceil(distance / averageSpeed)

    if (durationHours < 1) {
      estimatedDuration = 'Less than 1 hour'
    } else if (durationHours === 1) {
      estimatedDuration = '1 hour'
    } else if (durationHours < 24) {
      estimatedDuration = `${durationHours} hours`
    } else {
      const days = Math.ceil(durationHours / 24)
      estimatedDuration = `${days} ${days === 1 ? 'day' : 'days'}`
    }
  }

  const pickupLabel = pickupInfo.lgaName
    ? `${pickupInfo.lgaName} (${pickupInfo.stateName})`
    : `${pickupInfo.stateName}`
  const destinationLabel = destinationInfo.lgaName
    ? `${destinationInfo.lgaName} (${destinationInfo.stateName})`
    : `${destinationInfo.stateName}`

  return {
    pickupState: pickupInfo.stateName,
    pickupLga: pickupInfo.lgaName,
    destinationState: destinationInfo.stateName,
    destinationLga: destinationInfo.lgaName,
    distance,
    estimatedDuration,
    route: `${pickupLabel} → ${destinationLabel}`,
  }
}

/**
 * Get all states with their coordinates
 * @returns {object} All state coordinates
 */
function getAllStates() {
  return stateCoordinates
}

/**
 * Get tonnage rate per KM based on weight bands
 * @param {number} weight - Weight in tons
 * @returns {number} Rate per ton-KM
 */
function getTonnageRate(weight) {
  if (weight < 5) return 15        // Less than 5 tons
  if (weight <= 10) return 20      // 5-10 tons
  if (weight <= 20) return 25      // 10-20 tons
  if (weight <= 30) return 30      // 20-30 tons
  if (weight <= 40) return 30      // 30-40 tons
  return 35                         // 40+ tons
}

/**
 * Calculate estimated shipping cost based on diesel consumption and tonnage
 * Formula: (Distance ÷ Fuel Efficiency × Diesel Rate) + (Tonnage × Distance × Rate per Ton-KM) + Base Fee + Fragile Fee + Insurance Fee
 * 
 * @param {number} distance - Distance in kilometers
 * @param {number} weight - Weight in tons
 * @param {object} options - Optional parameters
 * @param {number} options.dieselRate - Current diesel price per liter (default: ₦1,200)
 * @param {number} options.fuelEfficiency - KM per liter for loaded truck (default: 3 km/L)
 * @param {number} options.baseFee - Base service fee (default: ₦10,000)
 * @param {boolean} options.fragileItems - Whether items are fragile/perishable (adds ₦300,000)
 * @param {boolean} options.insurance - Whether insurance is selected (adds ₦200,000)
 * @returns {object} Cost breakdown
 */
function estimateShippingCost(distance, weight = 1, options = {}) {
  // Default values
  const dieselRate = options.dieselRate || 1200        // ₦1,200 per liter
  const fuelEfficiency = options.fuelEfficiency || 3   // 3 km per liter
  const baseFee = options.baseFee || 10000             // ₦10,000 base service fee
  const fragileFee = options.fragileItems ? 300000    // ₦300,000 for fragile/perishable items
    : 0
  const insuranceFee = options.insurance ? 200000       // ₦200,000 for insurance
    : 0
  
  // Calculate diesel cost
  const litersNeeded = distance / fuelEfficiency
  const dieselCost = litersNeeded * dieselRate
  
  // Calculate tonnage cost
  const tonnageRatePerKm = getTonnageRate(weight)
  const tonnageCost = weight * distance * tonnageRatePerKm
  
  // Calculate total cost
  const totalCost = dieselCost + tonnageCost + baseFee + fragileFee + insuranceFee
  
  return {
    distance: distance,
    weight: weight,
    dieselRate: dieselRate,
    fuelEfficiency: fuelEfficiency,
    litersNeeded: Math.round(litersNeeded * 10) / 10,
    dieselCost: Math.round(dieselCost),
    tonnageRatePerKm: tonnageRatePerKm,
    tonnageCost: Math.round(tonnageCost),
    baseFee: baseFee,
    fragileFee: fragileFee,
    insuranceFee: insuranceFee,
    totalCost: Math.round(totalCost),
    formattedCost: `₦${Math.round(totalCost).toLocaleString()}`
  }
}

export {
  calculateStateDistance,
  haversineDistance,
  getAllStates,
  estimateShippingCost,
  getTonnageRate,
  stateCoordinates,
  slugify,
  titleCase,
}

