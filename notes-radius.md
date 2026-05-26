# Meta API Location Types and Radius

## Supported location_types for adgeolocation search:
- country, country_group, region, city, zip, geo_market, electoral_district, subcity, neighborhood, medium_geo_area

## Key findings:
- Manhattan returns as type "subcity" (not "city") for Manhattan, NY
- Cities return type "city" 
- Subcities return type "subcity"
- The search API returns the `type` field for each result

## Radius support per type in targeting_spec:
- cities: YES - radius 10-50 mi / 17-80 km, uses { key, radius, distance_unit }
- custom_locations: YES - radius 0.63-50 mi / 1-80 km, uses { latitude, longitude, radius, distance_unit } or { address_string, radius }
- regions: NO
- countries: NO  
- zips: NO
- geo_markets: NO
- subcity: treated same as city in targeting

## Implementation:
1. Add 'subcity', 'neighborhood' to location_types in search query
2. For radius UI: show on city and subcity types
3. normalizeGeoFromObjects: treat subcity same as city (push to cities array with optional radius)
4. Radius UI: inline input next to each city/subcity chip, with mile/km toggle
