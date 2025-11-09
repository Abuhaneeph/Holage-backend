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

const getLocationCoordinates = (stateInput, lgaInput) => {
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
  const { latOffset, lngOffset } = generateOffsetFromSlug(lgaSlug)

  return {
    lat: stateInfo.lat + latOffset,
    lng: stateInfo.lng + lngOffset,
    stateName: stateInfo.name,
    stateSlug,
    lgaName: titleCase(lgaInput),
    lgaSlug,
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
 * Calculate estimated distance between two Nigerian states
 * 
 * @param {string} pickupState - Pickup state code (e.g., 'lagos', 'abuja')
 * @param {string} destinationState - Destination state code
 * @returns {object} Object containing distance and route info
 */
function calculateStateDistance(pickupState, destinationState, pickupLga = null, destinationLga = null) {
  const pickupInfo = getLocationCoordinates(pickupState, pickupLga)
  const destinationInfo = getLocationCoordinates(destinationState, destinationLga)

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

  const distance = haversineDistance(
    pickupInfo.lat,
    pickupInfo.lng,
    destinationInfo.lat,
    destinationInfo.lng,
  )

  const averageSpeed = 60
  const durationHours = Math.ceil(distance / averageSpeed)

  let estimatedDuration
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
 * Formula: (Distance ÷ Fuel Efficiency × Diesel Rate) + (Tonnage × Distance × Rate per Ton-KM) + Base Fee
 * 
 * @param {number} distance - Distance in kilometers
 * @param {number} weight - Weight in tons
 * @param {object} options - Optional parameters
 * @param {number} options.dieselRate - Current diesel price per liter (default: ₦1,200)
 * @param {number} options.fuelEfficiency - KM per liter for loaded truck (default: 3 km/L)
 * @param {number} options.baseFee - Base service fee (default: ₦10,000)
 * @returns {object} Cost breakdown
 */
function estimateShippingCost(distance, weight = 1, options = {}) {
  // Default values
  const dieselRate = options.dieselRate || 1200        // ₦1,200 per liter
  const fuelEfficiency = options.fuelEfficiency || 3   // 3 km per liter
  const baseFee = options.baseFee || 10000             // ₦10,000 base service fee
  
  // Calculate diesel cost
  const litersNeeded = distance / fuelEfficiency
  const dieselCost = litersNeeded * dieselRate
  
  // Calculate tonnage cost
  const tonnageRatePerKm = getTonnageRate(weight)
  const tonnageCost = weight * distance * tonnageRatePerKm
  
  // Calculate total cost
  const totalCost = dieselCost + tonnageCost + baseFee
  
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

