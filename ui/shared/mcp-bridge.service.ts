/**
 * Angular service wrapping the MCP Apps `App` class (`@modelcontextprotocol/ext-apps`).
 *
 * This is the **shared bridge** for all Warmtebouw MCP App UIs. Every app component
 * injects this service to communicate with the MCP host (Claude.ai, VS Code, ChatGPT, etc.).
 *
 * ## Quick reference — which method to use
 *
 * | Goal                                                              | Method                   |
 * |-------------------------------------------------------------------|--------------------------|
 * | Fetch data from **same** MCP server                               | `callTool()`             |
 * | Trigger AI agent (cross-MCP orchestration, visible in main chat)  | `sendMessage()`          |
 * | **Ask Claude a scoped question in-app (no main-chat turn)**       | `createSamplingMessage()`|
 * | Push context for next agent turn                                  | `updateModelContext()`   |
 * | Export/download a text file                                       | `downloadFile()`         |
 * | Export/download a binary file                                     | `downloadBinaryFile()`   |
 * | Open a URL in the browser                                         | `openLink()`             |
 * | Go fullscreen / picture-in-picture                                | `requestDisplayMode()`   |
 * | Close this app from inside                                        | `requestTeardown()`      |
 * | Load a server resource (HTML, binary)                             | `readResource()`         |
 * | Discover available server resources                               | `listResources()`        |
 * | Debug logging (not visible to user)                               | `log()`                  |
 *
 * ## Three-way mental model: callTool vs sendMessage vs createSamplingMessage
 *
 * When a new application-style app (duurzaam adviseur, correction workflows, dashboards
 * with narrative) needs to get something out of the AI layer, pick one of these three:
 *
 * - **`callTool('<tool>', args)`** — invokes an MCP tool server-side. Deterministic,
 *   structured JSON result. Use for fetching data (`get_project`, `get_usages`, …).
 *   No LLM involved.
 * - **`sendMessage('<text>')`** — injects a user turn into the MAIN chat and lets
 *   Claude respond normally in the conversation. Use when the user should continue
 *   the conversation with the result visible in chat. Costly: triggers full reasoning
 *   loop; result pollutes main conversation.
 * - **`createSamplingMessage({ messages, maxTokens, … })`** — scoped LLM completion
 *   routed through the host, result returns to the app (NOT main chat). Use for
 *   in-app AI features that shouldn't pollute the conversation: "explain this row",
 *   auto-narrative summaries of a dashboard, smart form autofill, scoped Q&A.
 *   Runs on the host user's subscription (Claude.ai Pro/Max/Team or Claude Code
 *   plan) — not our Anthropic API key. Host may require user approval per call.
 *
 * ## Signals (reactive state)
 *
 * | Signal           | Description                                      |
 * |------------------|--------------------------------------------------|
 * | `connected()`    | `true` after host handshake completes             |
 * | `error()`        | Last error message, or `null`                     |
 * | `toolResult()`   | Latest `structuredContent` pushed by the host     |
 * | `toolInput()`    | Latest tool arguments pushed by the host          |
 * | `hostTheme()`    | `'light'` or `'dark'`                             |
 * | `hostContext()`   | Full host context (theme, locale, styles, etc.)   |
 * | `loading()`      | `true` while a `callTool()` request is in-flight  |
 *
 * ## Usage
 *
 * ```ts
 * bridge = inject(McpBridgeService);
 * ngOnInit() { this.bridge.connect(); }
 *
 * // Read reactive state
 * firstName = computed(() => this.bridge.toolResult()?.['userName'] ?? '');
 *
 * // Call a tool on the same server
 * await this.bridge.callTool('get_project', { projectId: 'G25011600' });
 *
 * // Trigger cross-MCP analysis via the AI agent
 * await this.bridge.sendMessage('Vergelijk energiekosten met BIM materialen');
 *
 * // Export data
 * await this.bridge.downloadFile('rapport.csv', csvData, 'text/csv');
 * ```
 */

import { Injectable, signal } from '@angular/core';
import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
  type McpUiTheme,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type {
  CreateMessageRequest,
  CreateMessageResult,
  CreateMessageResultWithTools,
} from '@modelcontextprotocol/sdk/types.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';

@Injectable({ providedIn: 'root' })
export class McpBridgeService {
  /** Whether the handshake with the host is complete */
  readonly connected = signal(false);

  /** Error message if connection or tool call fails */
  readonly error = signal<string | null>(null);

  /** Latest tool result (structuredContent from the host) */
  readonly toolResult = signal<Record<string, unknown> | null>(null);

  /** Latest tool input arguments (sent before result) */
  readonly toolInput = signal<Record<string, unknown> | null>(null);

  /** Host theme: 'light' or 'dark' */
  readonly hostTheme = signal<McpUiTheme>('light');

  /** Full host context (theme, locale, styles, toolInfo) — may be partial */
  readonly hostContext = signal<Partial<McpUiHostContext> | null>(null);

  /** Loading state for callTool() */
  readonly loading = signal(false);

  private app: App;

  constructor() {
    this.app = new App({ name: 'Warmtebouw MCP App', version: '1.0.0' }, {}, { autoResize: true });

    // Register notification handlers before connect() to avoid missing events.
    //
    // ext-apps 1.7 deprecated the `on<event>` setter pattern for notifications
    // (fire-and-forget callbacks) in favor of `addEventListener("<event>", handler)`:
    // composable (multiple listeners), supports cleanup via `removeEventListener`.
    // Request-style handlers that return a Promise<Result> are still setter-registered
    // (see AppBridge `onmessage`/`onopenlink`/etc. on the host side).
    this.app.addEventListener('toolresult', (params) => {
      this.toolResult.set((params.structuredContent as Record<string, unknown>) ?? null);
    });

    this.app.addEventListener('toolinput', (params) => {
      this.toolInput.set((params.arguments as Record<string, unknown>) ?? null);
    });

    this.app.addEventListener('hostcontextchanged', (ctx) => {
      this.applyContext(ctx);
    });
  }

  /**
   * Connect to the host. Call once from your root component's ngOnInit().
   */
  async connect(): Promise<void> {
    try {
      await this.app.connect();
      this.connected.set(true);

      // Apply initial host context
      const ctx = this.app.getHostContext();
      if (ctx) {
        this.applyContext(ctx);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Call a server-side MCP tool from the UI.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const result = await this.app.callServerTool({ name, arguments: args });
      return result;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Open a link in the host's default browser.
   */
  async openLink(url: string): Promise<void> {
    try {
      await this.app.openLink({ url });
    } catch (err) {
      console.error('McpBridgeService.openLink failed', { url, err });
      throw err;
    }
  }

  /**
   * Send a message to the host's chat interface, triggering the AI agent.
   *
   * This is the key method for **cross-MCP server orchestration**: the app
   * injects a user message, the agent resolves it using whichever MCP servers
   * are connected — AFAS, BIM, Fleet, Warmtebouw Duurzaam, Priva, etc.
   *
   * **When to use:**
   * - Button clicks that should trigger AI analysis across multiple data sources
   * - "Drill down" actions where the app asks the agent to fetch more detail
   * - Follow-up questions generated from the current app's data
   *
   * **When NOT to use:**
   * - Fetching data from the same server → use `callTool()` instead
   * - Pushing context without triggering a response → use `updateModelContext()`
   *
   * @example
   * ```ts
   * // Button in a Priva dashboard app
   * await bridge.sendMessage('Vergelijk energiekosten van dit gebouw via Warmtebouw Duurzaam');
   *
   * // Drill-down from a project overview card
   * await bridge.sendMessage(`Toon nacalculatie details voor project ${projectId}`);
   * ```
   */
  async sendMessage(text: string): Promise<{ isError?: boolean }> {
    try {
      return await this.app.sendMessage({
        role: 'user',
        content: [{ type: 'text', text }],
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return { isError: true };
    }
  }

  /**
   * Push data into the model's context for the next conversation turn.
   * Does NOT trigger an immediate model response (unlike `sendMessage()`).
   * Each call overwrites the previous context — only the last update is sent.
   *
   * **When to use:**
   * - Offloading large data (tables, transcripts) before a `sendMessage()` follow-up
   * - Syncing app state (selected items, filters) so the agent is aware on the next turn
   * - Reporting app errors/degraded state to the model
   *
   * **When NOT to use:**
   * - You want an immediate agent response → use `sendMessage()`
   * - You need to persist data across sessions → use server-side storage
   *
   * @example
   * ```ts
   * // Sync current dashboard selection so agent knows the context
   * await bridge.updateModelContext(`Geselecteerd gebouw: ${buildingName}, periode: ${period}`);
   *
   * // Offload data, then trigger analysis
   * await bridge.updateModelContext(largeDataTable);
   * await bridge.sendMessage('Analyseer bovenstaande data');
   * ```
   */
  async updateModelContext(text: string): Promise<void> {
    try {
      await this.app.updateModelContext({
        content: [{ type: 'text', text }],
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Read a resource from the originating MCP server by URI.
   *
   * **When to use:**
   * - Loading additional UI templates or data files served by the same MCP server
   * - Fetching binary content (videos, images) via `ui://` or custom resource URIs
   *
   * **When NOT to use:**
   * - Calling a tool → use `callTool()`
   * - Reading from a different MCP server → use `sendMessage()` to ask the agent
   *
   * @example
   * ```ts
   * const result = await bridge.readResource('ui://warmtebouw/report-template.html');
   * ```
   */
  async readResource(uri: string): Promise<unknown> {
    try {
      return await this.app.readServerResource({ uri });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * List available resources on the originating MCP server.
   *
   * **When to use:**
   * - Building a resource picker/browser in the UI
   * - Discovering available templates, data files, or media
   *
   * @example
   * ```ts
   * const result = await bridge.listResources();
   * // result.resources → [{ uri, name, description, mimeType }]
   * ```
   */
  async listResources(): Promise<unknown> {
    try {
      return await this.app.listServerResources();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * Request the host to download a file. MCP Apps run in sandboxed iframes
   * where direct downloads are blocked — this is the host-mediated alternative.
   *
   * **When to use:**
   * - Exporting data as JSON, CSV, or PDF from a dashboard
   * - Generating reports that the user wants to save locally
   *
   * **When NOT to use:**
   * - Opening a URL → use `openLink()`
   * - Sending data to the agent → use `updateModelContext()`
   *
   * @example
   * ```ts
   * // Export project data as JSON
   * await bridge.downloadFile('project-rapport.json', JSON.stringify(data, null, 2));
   *
   * // Export as CSV
   * await bridge.downloadFile('energiekosten.csv', csvString, 'text/csv');
   * ```
   */
  async downloadFile(filename: string, content: string, mimeType = 'application/json'): Promise<{ isError?: boolean }> {
    try {
      return await this.app.downloadFile({
        contents: [
          {
            type: 'resource',
            resource: {
              uri: `file:///${filename}`,
              mimeType,
              text: content,
            },
          },
        ],
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return { isError: true };
    }
  }

  /**
   * Request the host to download a binary file (images, PDFs, etc.).
   * Uses the MCP `blob` resource field for base64-encoded binary content.
   *
   * @example
   * ```ts
   * const base64Png = canvas.toDataURL('image/png').split(',')[1];
   * await bridge.downloadBinaryFile('grafiek.png', base64Png, 'image/png');
   * ```
   */
  async downloadBinaryFile(filename: string, base64Content: string, mimeType: string): Promise<{ isError?: boolean }> {
    this.error.set(null);
    try {
      return await this.app.downloadFile({
        contents: [
          {
            type: 'resource',
            resource: {
              uri: `file:///${filename}`,
              mimeType,
              blob: base64Content,
            },
          },
        ],
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return { isError: true };
    }
  }

  /**
   * Send a log message to the host for debugging / telemetry.
   * Not added to the conversation — only visible in host debug tools.
   *
   * **When to use:**
   * - Debugging app lifecycle events during development
   * - Logging errors or performance metrics for telemetry
   *
   * **When NOT to use:**
   * - Showing errors to the user → use the `error` signal
   * - Informing the model about app state → use `updateModelContext()`
   *
   * @example
   * ```ts
   * await bridge.log('info', 'Dashboard loaded successfully');
   * await bridge.log('error', `API call failed: ${err.message}`);
   * ```
   */
  async log(level: 'debug' | 'info' | 'warning' | 'error', data: string): Promise<void> {
    try {
      await this.app.sendLog({ level, data, logger: 'Warmtebouw MCP App' });
    } catch {
      // Best-effort — don't surface log failures to the UI
    }
  }

  /**
   * Request a display mode change for the app container.
   * Modes: `inline` (default, in chat), `fullscreen`, `pip` (picture-in-picture).
   * The host may deny the request — always check the returned `mode`.
   *
   * **When to use:**
   * - Dashboards / charts that benefit from more screen real estate → `fullscreen`
   * - Persistent monitoring widgets (e.g., live Priva climate) → `pip`
   * - Returning to normal after fullscreen → `inline`
   *
   * **When NOT to use:**
   * - Small cards like the welcome card — `inline` is fine
   *
   * @example
   * ```ts
   * // Toggle fullscreen on a dashboard
   * const current = bridge.hostContext()?.displayMode;
   * const result = await bridge.requestDisplayMode(current === 'fullscreen' ? 'inline' : 'fullscreen');
   * // result.mode is what the host actually set (may differ from request)
   * ```
   */
  async requestDisplayMode(mode: 'inline' | 'fullscreen' | 'pip'): Promise<{ mode: 'inline' | 'fullscreen' | 'pip' }> {
    try {
      return await this.app.requestDisplayMode({ mode });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return { mode: 'inline' };
    }
  }

  /**
   * Ask the host to tear down this MCP app.
   *
   * Fire-and-forget notification (`ui/notifications/request-teardown`, ext-apps 1.7+).
   * The host MAY honor it — if so, it responds with `ui/resource-teardown` so we
   * get a chance to save state in `app.onteardown` before the iframe is removed.
   * The host MAY also refuse silently (e.g. warn the user first). There's no
   * acknowledgement either way, so the app should continue as if still attached
   * unless `onteardown` fires.
   *
   * **When to use:**
   * - A user clicks a "Sluiten" / "Done" / "Terug" button inside the app.
   * - The app completes a workflow and wants to close itself.
   *
   * **Compatibility:**
   * - Our local viewer responds (see `app-host.component.ts#requestteardown` listener).
   * - Claude.ai / Claude Desktop / Claude Code honor this based on their host
   *   version; older hosts will ignore the notification without error.
   *
   * @example
   * ```ts
   * // Close button in an application-style MCP app
   * <button (click)="close()">Sluiten</button>
   *
   * async close() {
   *   await this.bridge.requestTeardown();
   *   // Don't call teardown logic here — wait for app.onteardown to fire when
   *   // the host acknowledges, so we save state once regardless of whether the
   *   // close was app-initiated or host-initiated.
   * }
   * ```
   */
  async requestTeardown(): Promise<void> {
    try {
      await this.app.requestTeardown();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Whether the host supports LLM sampling via `createSamplingMessage()`.
   *
   * Always check this before calling `createSamplingMessage()`. Hosts that don't
   * advertise sampling reject the call — the check lets you hide the "Explain"
   * / "Vat samen" / "Suggereer" button entirely on older hosts instead of
   * showing a button that errors when clicked.
   *
   * Claude.ai, Claude Desktop, and Claude Code advertise sampling when their
   * host version supports ext-apps 1.7+. Our local dev viewer advertises it too
   * but returns an explanatory error on the actual call — useful so dev-time
   * code paths are exercisable.
   *
   * @returns `true` if sampling calls will be accepted by the host.
   */
  supportsSampling(): boolean {
    return !!this.app.getHostCapabilities()?.sampling;
  }

  /**
   * Whether the host supports sampling with `tools` (agentic tool-use loops).
   *
   * Strict subset of `supportsSampling()` — hosts may support sampling without
   * the tools extension. Check this before calling `createSamplingMessage({ tools: […] })`
   * with tool definitions; fall back to a plain completion if it returns false.
   */
  supportsSamplingWithTools(): boolean {
    return !!this.app.getHostCapabilities()?.sampling?.tools;
  }

  /**
   * Request a scoped LLM completion from the host (MCP `sampling/createMessage`).
   *
   * **When to reach for this (over `callTool` / `sendMessage`):**
   * The app needs generated text — reasoning, explanation, narrative, suggestion,
   * autofill — and the result should land BACK IN THIS APP rather than the
   * main conversation. This is the correct primitive for any application-style
   * MCP app (duurzaam adviseur, dashboard with inline "explain this" buttons,
   * form with smart defaults, report generator, in-app drill-down chat).
   *
   * **Not for:**
   * - Fetching structured data from a backend → use `callTool()`.
   * - Continuing the user's conversation with visible chat back-and-forth →
   *   use `sendMessage()` (result appears in main chat, triggers full reasoning).
   *
   * **Compatibility & cost:**
   * - Check `supportsSampling()` first; older hosts reject the request. Hide
   *   the triggering UI entirely on unsupported hosts rather than showing a
   *   button that errors.
   * - Runs on the **host user's LLM subscription** — Claude.ai Pro/Max/Team,
   *   Claude Code plan, etc. — not on our API keys. We don't pay.
   * - Spec is human-in-the-loop: the host MAY prompt the user for approval per
   *   call (behavior varies by host). The user can refuse; the call will
   *   resolve with a rejection error.
   *
   * **Error handling:**
   * Errors are re-thrown — callers should `try/catch` per call site, because
   * each sampling invocation is context-specific (which button the user clicked,
   * which data they're exploring) and a global error signal would lose that
   * context. A generic "could not generate explanation" toast is usually the
   * right fallback.
   *
   * @param params Standard MCP `CreateMessageRequest` params: `messages`,
   *   `maxTokens`, optionally `systemPrompt`, `temperature`, `modelPreferences`,
   *   `tools` (for agentic loops — requires `supportsSamplingWithTools()`).
   * @param options Transport options — `timeout`, `AbortSignal`, etc.
   * @returns `CreateMessageResult` (plain completion) or
   *   `CreateMessageResultWithTools` (when `params.tools` is set; may contain
   *   `tool_use` content blocks and `stopReason: "toolUse"`).
   *
   * @throws {Error} Host rejects the request (unsupported, user declined, policy).
   * @throws {Error} Request timeout or connection loss.
   *
   * @example Inline explanation of a dashboard row
   * ```ts
   * async explainProjectMargin(project: { id: string; margin: number; kosten: number }) {
   *   if (!this.bridge.supportsSampling()) return; // older host — hide the button
   *   const result = await this.bridge.createSamplingMessage({
   *     messages: [{
   *       role: 'user',
   *       content: {
   *         type: 'text',
   *         text: `Project ${project.id} draait ${(project.margin * 100).toFixed(1)}% marge op €${project.kosten} kosten. Leg in 2 zinnen uit wat dit betekent voor de projectleider en of actie nodig is.`,
   *       },
   *     }],
   *     maxTokens: 200,
   *   });
   *   this.explanation.set(
   *     result.content.type === 'text' ? result.content.text : '(geen tekstresultaat)',
   *   );
   * }
   * ```
   *
   * @example Auto-narrative opening summary (called in ngOnInit)
   * ```ts
   * async generateNarrative(buildingName: string, usages: unknown[]) {
   *   const result = await this.bridge.createSamplingMessage({
   *     messages: [{
   *       role: 'user',
   *       content: {
   *         type: 'text',
   *         text: `Schrijf een Nederlandstalige executive summary (max 3 zinnen) over het energieverbruik van ${buildingName}. Data: ${JSON.stringify(usages)}`,
   *       },
   *     }],
   *     maxTokens: 400,
   *     systemPrompt: 'Je bent een duurzaamheidsadviseur bij Warmtebouw. Gebruik helder Nederlands, vermijd jargon.',
   *   });
   *   this.narrative.set(result.content.type === 'text' ? result.content.text : '');
   * }
   * ```
   *
   * @example Smart form-field suggestion
   * ```ts
   * async suggestDossierTitle(partialText: string, context: string) {
   *   const result = await this.bridge.createSamplingMessage({
   *     messages: [{
   *       role: 'user',
   *       content: {
   *         type: 'text',
   *         text: `Stel een beknopte dossier-titel voor (max 8 woorden) op basis van:\nContext: ${context}\nGebruiker begint met: "${partialText}"`,
   *       },
   *     }],
   *     maxTokens: 40,
   *     temperature: 0.3,
   *   });
   *   return result.content.type === 'text' ? result.content.text.trim() : '';
   * }
   * ```
   */
  createSamplingMessage(
    params: CreateMessageRequest['params'] & { tools?: undefined },
    options?: RequestOptions
  ): Promise<CreateMessageResult>;
  createSamplingMessage(
    params: CreateMessageRequest['params'],
    options?: RequestOptions
  ): Promise<CreateMessageResultWithTools>;
  createSamplingMessage(
    params: CreateMessageRequest['params'],
    options?: RequestOptions
  ): Promise<CreateMessageResult | CreateMessageResultWithTools> {
    return this.app.createSamplingMessage(params, options);
  }

  private applyContext(ctx: Partial<McpUiHostContext>): void {
    this.hostContext.set(ctx);

    if (ctx.theme) {
      this.hostTheme.set(ctx.theme);
      applyDocumentTheme(ctx.theme);
    }
    if (ctx.styles?.variables) {
      applyHostStyleVariables(ctx.styles.variables);
    }
    if (ctx.styles?.css?.fonts) {
      applyHostFonts(ctx.styles.css.fonts);
    }
  }
}
