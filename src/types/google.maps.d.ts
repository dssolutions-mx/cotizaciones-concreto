// Type definitions for Google Maps Place Autocomplete Web Component

declare namespace google.maps {
  // Extend the existing 'places' namespace if it exists, or create it.
  namespace places {
    // Define the structure of the Place object returned by the gmp-placeselect event
    // This is based on common properties and what's typically requested.
    // Adjust fields as necessary based on your 'requested-fields' attribute.
    interface GmpPlace {
      id?: string;
      displayName?: string;
      formattedAddress?: string;
      location?: google.maps.LatLngLiteral; // Assuming location is LatLngLiteral
      // Add other properties you request and use, e.g.:
      // addressComponents?: google.maps.GeocoderAddressComponent[];
      // photos?: google.maps.places.Photo[];
      // primaryType?: string;
      // etc.
    }

    // Define the event detail for gmp-placeselect
    interface GmpPlaceSelectEventDetail {
      place: GmpPlace;
    }
  }
}

// Define the structure of the Place object we expect from gmp-placeselect event
// This should align with the 'requested-fields' attribute on the web component.
export interface GmpPlaceResult {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  name?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  // Add other properties you request and use from 'requested-fields'
  // e.g., addressComponents, etc.
}

// Define the CustomEvent detail structure for 'gmp-placeselect'
export interface GmpPlaceSelectEventDetail {
  place: GmpPlaceResult;
}

// Augment JSX.IntrinsicElements to include the Google Maps Place Autocomplete element
// This helps TypeScript recognize the web component in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { // Using React.HTMLAttributes directly for base
          // Standard HTML attributes that might be specifically used or overridden
          id?: string;
          class?: string; // 'class' is technically 'className' in React, but for web components, 'class' might be passed directly.
          style?: React.CSSProperties;
          placeholder?: string;
          value?: string | undefined; // Explicitly allow undefined for value
          // Add ref if you are using it directly on the custom element in TSX
          // ref?: React.Ref<HTMLElement>; // Or a more specific type if the element has a known API

          // Custom attributes for the web component (kebab-case)
          'requested-fields'?: string;
          'country-codes'?: string;
          'place-types'?: string; // Corrected from 'types'
          'location-bias'?: string;
          'location-restriction'?: string;
          // Add any other specific attributes for gmp-place-autocomplete
          // Ensure all attributes used in ConstructionSiteForm.tsx are listed here
        },
        HTMLElement
      >;
    }
  }
}

// Export an empty object to make this a module file if it's not already.
// This is sometimes needed for global augmentations to be picked up.
export {}; 