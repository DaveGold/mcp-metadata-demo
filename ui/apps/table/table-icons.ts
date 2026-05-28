/**
 * Table icon subset — ~40 Heroicons available for AI to use in table cells.
 *
 * Imported individually from ui/shared/heroicons.ts (tree-shaked).
 * The AI can reference these by kebab-case name in column config.
 *
 * Categories:
 * - Table chrome: sort arrows, search, filter
 * - Status/feedback: check, x, warning, info, shield
 * - Domain: building, euro, truck, bolt, fire, user, wrench, etc.
 * - Navigation: arrows, chevrons
 */

import {
  // Table chrome
  chevronUp,
  chevronDown,
  chevronUpDown,
  magnifyingGlass,
  funnel,
  adjustmentsHorizontal,
  chevronLeft,
  chevronRight,
  chevronDoubleLeft,
  chevronDoubleRight,
  // Status/feedback
  check,
  xmark,
  checkCircle,
  xcircle,
  exclamationTriangle,
  exclamationCircle,
  informationCircle,
  shieldCheck,
  // Domain: projects/ERP
  buildingOffice,
  buildingOffice2,
  currencyEuro,
  calculator,
  clipboardDocumentList,
  documentText,
  chartBar,
  chartPie,
  presentationChartLine,
  tableCells,
  calendar,
  clock,
  // Domain: people/fleet
  user,
  userGroup,
  truck,
  mapPin,
  wrench,
  wrenchScrewdriver,
  cog6Tooth,
  // Domain: energy/sustainability
  bolt,
  boltSlash,
  fire,
  sun,
  globeEuropeAfrica,
  arrowTrendingUp,
  arrowTrendingDown,
  minus,
  // General
  eye,
  eyeSlash,
  star,
  tag,
  arrowDownTray,
  arrowPath,
} from '../../shared/heroicons';

/** Runtime lookup map — AI picks icons by kebab-case name */
export const TABLE_ICONS: Record<string, string> = {
  // Table chrome
  'chevron-up': chevronUp,
  'chevron-down': chevronDown,
  'chevron-up-down': chevronUpDown,
  'magnifying-glass': magnifyingGlass,
  funnel: funnel,
  'adjustments-horizontal': adjustmentsHorizontal,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-double-left': chevronDoubleLeft,
  'chevron-double-right': chevronDoubleRight,
  // Status/feedback
  check: check,
  'x-mark': xmark,
  'check-circle': checkCircle,
  'x-circle': xcircle,
  'exclamation-triangle': exclamationTriangle,
  'exclamation-circle': exclamationCircle,
  'information-circle': informationCircle,
  'shield-check': shieldCheck,
  // Domain: projects/ERP
  'building-office': buildingOffice,
  'building-office-2': buildingOffice2,
  'currency-euro': currencyEuro,
  calculator: calculator,
  'clipboard-document-list': clipboardDocumentList,
  'document-text': documentText,
  'chart-bar': chartBar,
  'chart-pie': chartPie,
  'presentation-chart-line': presentationChartLine,
  'table-cells': tableCells,
  calendar: calendar,
  clock: clock,
  // Domain: people/fleet
  user: user,
  'user-group': userGroup,
  truck: truck,
  'map-pin': mapPin,
  wrench: wrench,
  'wrench-screwdriver': wrenchScrewdriver,
  'cog-6-tooth': cog6Tooth,
  // Domain: energy/sustainability
  bolt: bolt,
  'bolt-slash': boltSlash,
  fire: fire,
  sun: sun,
  'globe-europe-africa': globeEuropeAfrica,
  'arrow-trending-up': arrowTrendingUp,
  'arrow-trending-down': arrowTrendingDown,
  minus: minus,
  // General
  eye: eye,
  'eye-slash': eyeSlash,
  star: star,
  tag: tag,
  'arrow-down-tray': arrowDownTray,
  'arrow-path': arrowPath,
};
