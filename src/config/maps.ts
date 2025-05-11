// Google Maps API Key - Replace with your actual API key
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Debug Google Maps API key issues
if (typeof window !== 'undefined') {
  console.log('Maps config loaded. API key status:', {
    exists: !!GOOGLE_MAPS_API_KEY,
    length: GOOGLE_MAPS_API_KEY?.length || 0,
    isEmpty: GOOGLE_MAPS_API_KEY === '',
    isUndefined: GOOGLE_MAPS_API_KEY === undefined,
    envVarExists: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  });

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('⚠️ Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file');
  } else if (GOOGLE_MAPS_API_KEY.length < 20) {
    console.error('⚠️ Google Maps API key appears to be invalid (too short). API key:', GOOGLE_MAPS_API_KEY);
  }
}

// Default map center (Mexico City)
export const DEFAULT_MAP_CENTER = {
  lat: 19.4326,
  lng: -99.1332
}; 