/**
 * Interactive Leaflet map component for the render_map MCP App tool.
 *
 * Displays markers (cars, buildings, projects, pins) on an OpenStreetMap base layer.
 * Tiles load directly from tile.openstreetmap.org — the host CSP allow-list is
 * declared on the UI resource via _meta.ui.csp.resourceDomains.
 *
 * @see src/servers/utility-tools/tools/render-map.ts for the MCP tool definition
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import * as leaflet from 'leaflet';
import { McpBridgeService } from '../../shared/mcp-bridge.service';

// ── Types ────────────────────────────────────────────────────────────────────

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  description?: string;
  type?: 'car' | 'building' | 'project' | 'pin';
  color?: string;
}

interface MapInput {
  /**
   * Either:
   * - Array of marker objects (keyed)
   * - Array of positional rows: `[lat, lng, label, description?, type?, color?]`
   *
   * The server normalizes to keyed form before setting structuredContent, so
   * in production apps only see the first shape. The viewer's demo injection
   * path bypasses the server, so the UI also normalizes defensively.
   */
  markers: MapMarker[] | unknown[][];
  title?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
}

// ── Marker normalization ────────────────────────────────────────────────────

/**
 * Normalize markers to keyed shape regardless of input form. Positional rows
 * map by fixed position: `[lat, lng, label, description?, type?, color?]`.
 *
 * Production: server already normalizes, so this is a no-op pass-through.
 * Viewer demos: inject structuredContent directly, so positional rows arrive
 * here un-normalized — this function bridges that.
 */
function normalizeMarkers(raw: MapInput['markers']): MapMarker[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (Array.isArray(raw[0])) {
    return (raw as unknown[][]).map((row) => ({
      lat: row[0] as number,
      lng: row[1] as number,
      label: (row[2] as string) ?? '',
      description: row[3] as string | undefined,
      type: row[4] as 'car' | 'building' | 'project' | 'pin' | undefined,
      color: row[5] as string | undefined,
    }));
  }
  return raw as MapMarker[];
}

// ── Marker SVG icons ─────────────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
  car: '#002b49',
  building: '#496457',
  project: '#004c69',
  pin: '#002b49',
};

function svgPin(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="36"><path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z" fill="${fill}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="3.5" fill="#fff"/></svg>`;
}

function svgCar(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="15" fill="${fill}" stroke="#fff" stroke-width="2"/><path d="M8 18.5v-3l2-5h12l2 5v3a1 1 0 01-1 1h-1a1 1 0 01-1-1v-.5H12v.5a1 1 0 01-1 1H10a1 1 0 01-1-1zm3-2a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2zm-11-4h12l-1.5-3.5h-9L10 12.5z" fill="#fff"/></svg>`;
}

function svgBuilding(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="15" fill="${fill}" stroke="#fff" stroke-width="2"/><path d="M10 8h12v16H10V8zm2 2v2h3v-2h-2zm5 0v2h3v-2h-2zm-5 4v2h3v-2h-2zm5 0v2h3v-2h-2zm-5 4v2h3v-2h-2zm5 0v2h3v-2h-2zm-3 4v2h4v-2h-4z" fill="#fff"/></svg>`;
}

function svgProject(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="15" fill="${fill}" stroke="#fff" stroke-width="2"/><path d="M16 7l-8 5v1h16v-1l-8-5zm-6 8v6h3v-4h6v4h3v-6H10z" fill="#fff"/></svg>`;
}

function createIcon(marker: MapMarker): leaflet.DivIcon {
  const type = marker.type ?? 'pin';
  const color = marker.color ?? MARKER_COLORS[type] ?? MARKER_COLORS['pin'];

  let svg: string;
  let size: [number, number];
  let anchor: [number, number];

  switch (type) {
    case 'car':
      svg = svgCar(color);
      size = [32, 32];
      anchor = [16, 16];
      break;
    case 'building':
      svg = svgBuilding(color);
      size = [32, 32];
      anchor = [16, 16];
      break;
    case 'project':
      svg = svgProject(color);
      size = [32, 32];
      anchor = [16, 16];
      break;
    default:
      svg = svgPin(color);
      size = [28, 36];
      anchor = [14, 36];
      break;
  }

  return leaflet.divIcon({
    html: svg,
    className: '',
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, type === 'pin' ? -36 : -16],
  });
}

// ── Tile config ─────────────────────────────────────────────────────────────

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" title="© OpenStreetMap contributors">OSM</a>';

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    @import 'leaflet/dist/leaflet.css';

    :host {
      display: block;
      width: 100%;
    }

    .leaflet-container {
      width: 100%;
      height: 100%;
    }

    .dark-popup .leaflet-popup-content-wrapper {
      background-color: #1c1c20;
      color: #ecebea;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .dark-popup .leaflet-popup-tip {
      background-color: #1c1c20;
    }
    .dark-popup .leaflet-popup-close-button {
      color: #bac6c9;
    }
    .dark-popup .leaflet-popup-close-button:hover {
      color: #ecebea;
    }

    .leaflet-control-attribution {
      font-size: 10px;
      padding: 1px 5px;
      background: rgba(255, 255, 255, 0.6) !important;
    }
  `,
  template: `
    @if (!bridge.connected() && !bridge.error()) {
      <div class="relative w-full rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card p-4">
        <div class="h-6 w-48 bg-wb-gray-200 dark:bg-dark-border rounded animate-pulse mb-3"></div>
        <div class="h-80 bg-wb-gray-50 dark:bg-dark-surface rounded-[var(--radius-m)] animate-pulse"></div>
      </div>
    }

    @if (bridge.error()) {
      <div class="rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card p-6 text-center">
        <p class="text-sm text-wb-gray-500 dark:text-grey-blue">{{ bridge.error() }}</p>
      </div>
    }

    @if (bridge.connected() && !bridge.error() && input()) {
      <div class="w-full">
        @if (title()) {
          <div class="bg-primary px-3 py-1.5">
            <h3 class="text-sm font-medium text-white">{{ title() }}</h3>
          </div>
        }
        <div
          class="relative w-full bg-white dark:bg-dark-surface-raised rounded-[var(--radius-card)] shadow-card overflow-hidden"
          [style.height.px]="mapHeight()"
        >
          <div #mapContainer class="w-full h-full"></div>
        </div>
      </div>
    }
  `,
})
export class MapComponent implements OnInit, OnDestroy {
  readonly bridge = inject(McpBridgeService);
  readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private map: leaflet.Map | null = null;
  private readonly viewReady = signal(false);

  readonly input = computed<(Omit<MapInput, 'markers'> & { markers: MapMarker[] }) | null>(() => {
    const result = this.bridge.toolResult();
    if (!result || !result['markers']) return null;
    const raw = result as unknown as MapInput;
    return { ...raw, markers: normalizeMarkers(raw.markers) };
  });

  readonly title = computed(() => this.input()?.title ?? null);
  readonly mapHeight = computed(() => this.input()?.height ?? 500);

  constructor() {
    afterNextRender(() => {
      this.viewReady.set(true);
    });

    effect(() => {
      if (!this.viewReady()) return;
      const inp = this.input();
      const container = this.mapContainer();
      if (!inp || !container) return;

      const theme = this.bridge.hostTheme();
      this.buildMap(container.nativeElement, inp, theme === 'dark' ? 'dark' : 'light');
    });
  }

  ngOnInit(): void {
    this.bridge.connect().catch((err) => {
      console.error('[MapComponent] Bridge connection failed:', err);
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private buildMap(
    container: HTMLElement,
    input: Omit<MapInput, 'markers'> & { markers: MapMarker[] },
    theme: 'light' | 'dark'
  ): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const map = leaflet.map(container, { zoomControl: false, attributionControl: false });
    leaflet.control
      .attribution({
        position: 'bottomleft',
        prefix: '<a href="https://leafletjs.com" title="Leaflet — a JS library for interactive maps">L</a>',
      })
      .addTo(map);
    leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
    this.map = map;

    // Collect markers
    const markers: leaflet.Marker[] = [];
    for (const markerInput of input.markers) {
      const icon = createIcon(markerInput);
      const pin = leaflet.marker([markerInput.lat, markerInput.lng], { icon });

      let popupHtml = `<div style="font-family: var(--font-sans, 'Roboto', sans-serif); min-width: 150px;">`;
      popupHtml += `<strong style="font-size: 14px; color: ${theme === 'dark' ? '#ecebea' : '#002b49'};">${this.escapeHtml(markerInput.label)}</strong>`;
      if (markerInput.description) {
        popupHtml += `<div style="margin-top: 6px; font-size: 12px; color: ${theme === 'dark' ? '#bac6c9' : '#4B5563'}; line-height: 1.5;">${this.escapeDescriptionHtml(markerInput.description)}</div>`;
      }
      popupHtml += `</div>`;

      pin.bindPopup(popupHtml, {
        className: theme === 'dark' ? 'dark-popup' : '',
        maxWidth: 300,
      });
      markers.push(pin);
    }

    // Set view
    if (input.center && input.zoom) {
      map.setView([input.center.lat, input.center.lng], input.zoom);
    } else if (input.center) {
      map.setView([input.center.lat, input.center.lng], 13);
    } else if (markers.length > 0) {
      const group = leaflet.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else {
      map.setView([52.09, 5.11], 10);
    }

    // Tiles load directly from OSM — host CSP allow-list comes from the UI
    // resource's _meta.ui.csp.resourceDomains.
    leaflet.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 17 }).addTo(map);

    // Add markers on top
    for (const pin of markers) {
      pin.addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 100);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    // Convert \n to <br> after escaping to support line breaks in descriptions
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  private escapeDescriptionHtml(text: string): string {
    // Allow only a tiny subset of inline tags in descriptions.
    const placeholders = new Map<string, string>([
      ['__WB_BR__', '<br>'],
      ['__WB_B_OPEN__', '<b>'],
      ['__WB_B_CLOSE__', '</b>'],
      ['__WB_I_OPEN__', '<i>'],
      ['__WB_I_CLOSE__', '</i>'],
    ]);

    const withPlaceholders = text
      .replace(/<br\s*\/?>/gi, '__WB_BR__')
      .replace(/<b>/gi, '__WB_B_OPEN__')
      .replace(/<\/b>/gi, '__WB_B_CLOSE__')
      .replace(/<i>/gi, '__WB_I_OPEN__')
      .replace(/<\/i>/gi, '__WB_I_CLOSE__');

    let escaped = this.escapeHtml(withPlaceholders);
    for (const [token, html] of placeholders) {
      escaped = escaped.replaceAll(token, html);
    }

    return escaped;
  }
}
