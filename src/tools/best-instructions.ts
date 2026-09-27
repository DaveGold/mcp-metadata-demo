/**
 * Server instructions (reference implementation). Kept within 512 characters: some hosts cut them
 * there and some never deliver them, so every line is also in a tool description head
 * (evals/results/2026-09-27-host-delivery.json). They repeat the two things that must hold before
 * any call: what the server does NOT have, and where the guidance is.
 */
export const bestInstructions = `\
Dutch building (BAG, EP-Online label) and weather data for energy questions, plus chart/table/map rendering.

- Every EP-Online energy figure is CALCULATED; this server has NO metered energy consumption.
- Pass get_building_profile coordinaten.lat/lon to get_weather_context.
- Every data tool returns \`interpretation\` first: read it before the data; it holds the computed values and reading rules.
- render_chart / render_table / render_map draw data you already fetched; they fetch nothing.`;
