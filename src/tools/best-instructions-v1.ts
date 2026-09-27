/**
 * EVAL ARM — the server instructions `best` shipped until 2026-09-27 (744 chars). Frozen: the
 * `best-v1` and `best-no-type-rules` arms were measured with these bytes. The reference
 * implementation's current instructions are in best-instructions.ts.
 */
export const bestInstructionsV1 = `\
Dutch building and weather data for energy questions, plus chart/table/map rendering.

- get_building_profile: BAG register facts and the registered EP-Online energy label for one address. Every EP-Online energy figure is CALCULATED by the label method; this server has NO metered energy consumption.
- get_weather_context: daily weather, weighted degree days and solar irradiance for a Dutch location; pass get_building_profile coordinaten.lat/lon as latitude/longitude.
- Every data tool returns \`interpretation\` (alerts, notes, constants) as its first key. Read it first: it holds the computed values and the reading rules for the returned record.
- render_chart / render_table / render_map draw data you already fetched; they fetch nothing.`;
