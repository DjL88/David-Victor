/**
 * Server-Side Location & Geocoding Service
 *
 * Implements Map & Geocoder Provider Abstraction:
 * 1. Google Maps Geocoding API if GOOGLE_MAPS_API_KEY is configured.
 * 2. In DEMO mode: provides deterministic UK test coordinates.
 * 3. In STAGING / PRODUCTION: requires real geocoding provider, avoiding mock fallback.
 */

import { Coordinates, Address } from '../src/commerce/models';
import { LocationResolutionResult } from '../src/commerce/CommerceClient';
import { ServerRuntimeMode, getServerRuntimeMode } from './runtimeMode';

export class LocationService {
  /**
   * Resolves a free-text address query or GPS coordinates into a verified location.
   */
  static async resolveLocation(
    query: string | Coordinates,
    appMode?: ServerRuntimeMode
  ): Promise<LocationResolutionResult> {
    const resolvedMode = appMode || getServerRuntimeMode();

    // 1. Direct GPS coordinates resolution
    if (typeof query === 'object' && 'latitude' in query && 'longitude' in query) {
      return this.reverseGeocode(query, resolvedMode);
    }

    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!trimmed) {
      throw new Error('Address query cannot be empty');
    }

    const rawApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const apiKey = rawApiKey.startsWith('AIza') ? rawApiKey : '';

    // 2. Google Maps Geocoding Provider (only if valid API key)
    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          trimmed
        )}&key=${apiKey}&region=gb`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.results && data.results.length > 0) {
            const first = data.results[0];
            const loc = first.geometry.location;
            const postalCodeComp = first.address_components.find((c: any) =>
              c.types.includes('postal_code')
            );
            const routeComp = first.address_components.find((c: any) =>
              c.types.includes('route')
            );
            const localityComp = first.address_components.find(
              (c: any) => c.types.includes('postal_town') || c.types.includes('locality')
            );

            return {
              coordinates: { latitude: loc.lat, longitude: loc.lng },
              address: {
                line1: routeComp ? routeComp.long_name : trimmed,
                city: localityComp ? localityComp.long_name : 'UK',
                postalCode: postalCodeComp ? postalCodeComp.long_name : '',
                country: 'GB',
                formattedAddress: first.formatted_address,
              },
              formattedText: first.formatted_address,
            };
          }
        }
      } catch (err) {
        console.warn('[LocationService] Google Geocoding request failed:', err);
      }
    }

    // 3. Free Geocoding: postcodes.io for UK postcodes
    const ukPostcodeMatch = trimmed.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i);
    if (ukPostcodeMatch) {
      try {
        const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed.trim())}`);
        if (pcRes.ok) {
          const pcData = (await pcRes.json()) as any;
          if (pcData?.result) {
            const r = pcData.result;
            const city = r.parish || r.admin_district || 'UK';
            const formatted = `${r.postcode}, ${city}, UK`;
            return {
              coordinates: { latitude: r.latitude, longitude: r.longitude },
              address: {
                line1: r.postcode,
                city,
                postalCode: r.postcode,
                country: 'GB',
                formattedAddress: formatted,
              },
              formattedText: formatted,
            };
          }
        }
      } catch (err) {
        console.warn('[LocationService] postcodes.io lookup failed:', err);
      }
    }

    // 4. Free Geocoding: OpenStreetMap Nominatim
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=1`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'RetailCommercePlatform/1.0' },
      });
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as any;
        if (Array.isArray(nomData) && nomData.length > 0) {
          const item = nomData[0];
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || 'UK';
          const postalCode = addr.postcode || '';
          const line1 = addr.road || addr.suburb || trimmed;
          return {
            coordinates: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
            address: {
              line1,
              city,
              postalCode,
              country: addr.country_code ? addr.country_code.toUpperCase() : 'GB',
              formattedAddress: item.display_name,
            },
            formattedText: item.display_name,
          };
        }
      }
    } catch (err) {
      console.warn('[LocationService] Nominatim lookup failed:', err);
    }

    // 5. Demo mode deterministic resolution
    if (appMode === 'demo') {
      return this.getDemoLocation(trimmed);
    }

    // 4. Staging / Production: Fail honestly if no geocoder is configured
    const err: any = new Error(
      `Geocoding provider is not configured for address "${trimmed}". In staging/production, configure GOOGLE_MAPS_API_KEY.`
    );
    err.statusCode = 503;
    err.code = 'GEOCODING_UNAVAILABLE';
    throw err;
  }

  private static async reverseGeocode(
    coords: Coordinates,
    appMode: ServerRuntimeMode
  ): Promise<LocationResolutionResult> {
    const rawApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const apiKey = rawApiKey.startsWith('AIza') ? rawApiKey : '';
    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.results && data.results.length > 0) {
            const first = data.results[0];
            const postalCodeComp = first.address_components?.find((c: any) =>
              c.types.includes('postal_code')
            );
            const localityComp = first.address_components?.find(
              (c: any) => c.types.includes('postal_town') || c.types.includes('locality') || c.types.includes('sublocality')
            );
            const countryComp = first.address_components?.find((c: any) =>
              c.types.includes('country')
            );
            const routeComp = first.address_components?.find((c: any) =>
              c.types.includes('route') || c.types.includes('street_address')
            );

            return {
              coordinates: coords,
              address: {
                line1: routeComp ? routeComp.long_name : (first.formatted_address.split(',')[0] || 'Current Location'),
                city: localityComp ? localityComp.long_name : 'UK',
                postalCode: postalCodeComp ? postalCodeComp.long_name : '',
                country: countryComp ? countryComp.short_name : 'GB',
                formattedAddress: first.formatted_address,
              },
              formattedText: first.formatted_address,
            };
          }
        }
      } catch (err) {
        console.warn('[LocationService] Reverse geocode failed:', err);
      }
    }

    // Free Reverse Geocoding: postcodes.io for UK coordinates
    try {
      const pcRes = await fetch(`https://api.postcodes.io/postcodes?lat=${coords.latitude}&lon=${coords.longitude}`);
      if (pcRes.ok) {
        const pcData = (await pcRes.json()) as any;
        if (pcData?.result && Array.isArray(pcData.result) && pcData.result.length > 0) {
          const r = pcData.result[0];
          const city = r.parish || r.admin_district || 'UK';
          const formatted = `${r.postcode}, ${city}, UK`;
          return {
            coordinates: coords,
            address: {
              line1: r.postcode,
              city,
              postalCode: r.postcode,
              country: 'GB',
              formattedAddress: formatted,
            },
            formattedText: formatted,
          };
        }
      }
    } catch (err) {
      console.warn('[LocationService] postcodes.io reverse geocode failed:', err);
    }

    // Free Reverse Geocoding: Nominatim
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'RetailCommercePlatform/1.0' },
      });
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as any;
        if (nomData?.display_name) {
          const addr = nomData.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || 'UK';
          const postalCode = addr.postcode || '';
          const line1 = addr.road || addr.suburb || 'Location';
          return {
            coordinates: coords,
            address: {
              line1,
              city,
              postalCode,
              country: addr.country_code ? addr.country_code.toUpperCase() : 'GB',
              formattedAddress: nomData.display_name,
            },
            formattedText: nomData.display_name,
          };
        }
      }
    } catch (err) {
      console.warn('[LocationService] Nominatim reverse geocode failed:', err);
    }

    if (appMode === 'demo') {
      return {
        coordinates: coords,
        address: {
          line1: 'Current GPS Location',
          city: 'Chelmsford',
          postalCode: 'CM1 1BE',
          country: 'GB',
          formattedAddress: `GPS Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        },
        formattedText: `Near High Street, Chelmsford CM1 1BE`,
      };
    }

    const err: any = new Error(
      `Reverse geocoding provider is not configured. In staging/production, configure GOOGLE_MAPS_API_KEY.`
    );
    err.statusCode = 503;
    err.code = 'GEOCODING_UNAVAILABLE';
    throw err;
  }

  private static getDemoLocation(query: string): LocationResolutionResult {
    const q = query.toUpperCase();

    if (q.includes('EC1') || q.includes('LONDON')) {
      return {
        coordinates: { latitude: 51.5200, longitude: -0.0950 },
        address: {
          line1: query,
          city: 'London',
          postalCode: 'EC1A 1BB',
          country: 'GB',
          formattedAddress: `${query}, London EC1A 1BB`,
        },
        formattedText: `${query}, London EC1A 1BB`,
      };
    }

    // Default Demo: Chelmsford CM1 1BE
    return {
      coordinates: { latitude: 51.7356, longitude: 0.4705 },
      address: {
        line1: query || 'High Street',
        city: 'Chelmsford',
        postalCode: 'CM1 1BE',
        country: 'GB',
        formattedAddress: `${query || 'High Street'}, Chelmsford CM1 1BE`,
      },
      formattedText: `${query || 'High Street'}, Chelmsford CM1 1BE`,
    };
  }
}
