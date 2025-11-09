import { stateCoordinates, slugify, titleCase } from "./distanceCalculator.js"

let cachedStates = null
let lastFetch = 0
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

const fetchStatesFromRemote = async () => {
  const response = await fetch("https://locationsng-api.onrender.com/api/v1/states", {
    headers: {
      "User-Agent": "HolageServer/1.0 (contact@holage.com)",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch states: ${response.status}`)
  }

  const data = await response.json()

  return data
    .filter((item) => item?.state)
    .map((item) => ({
      name: item.state,
      slug: slugify(item.state),
      lgas: Array.isArray(item.lgas)
        ? item.lgas
            .filter(Boolean)
            .map((lga) => ({
              name: titleCase(lga),
              slug: slugify(lga),
            }))
        : [],
    }))
}

export const getStatesWithLgas = async () => {
  const now = Date.now()

  if (cachedStates && now - lastFetch < CACHE_TTL) {
    return cachedStates
  }

  try {
    const states = await fetchStatesFromRemote()
    cachedStates = states
    lastFetch = now
    return states
  } catch (error) {
    console.error("Failed to fetch states from remote source:", error.message)

    // Fallback to states from coordinates data (without LGAs)
    const fallbackStates = Object.values(stateCoordinates).map((state) => ({
      name: state.name,
      slug: slugify(state.name),
      lgas: [
        {
          name: state.capital,
          slug: slugify(state.capital),
        },
      ],
    }))

    cachedStates = fallbackStates
    lastFetch = now
    return fallbackStates
  }
}


