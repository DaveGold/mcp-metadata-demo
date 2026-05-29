/**
 * Shared card layout — MCP App shell.
 *
 * Provides: header band (gradient, logo, greeting, optional badge) + content slot + footer.
 * Used by MCP Apps that want the standard card look.
 *
 * Responsive: container is w-full (fills chat), content centers on wide screens via max-w-2xl.
 *
 * @example
 * ```html
 * <app-card-layout
 *   [greeting]="'Hello ' + firstName()"
 *   [subtitle]="'Demo'"
 *   [statusText]="'Connected'"
 *   [badge]="'demo'"
 * >
 *   <!-- your app content here -->
 * </app-card-layout>
 * ```
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { COMPANY_NAME } from '../wb-brand';

@Component({
  selector: 'app-card-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full">
      <div
        class="max-w-4xl mx-auto rounded-[var(--radius-card)] bg-white shadow-card overflow-hidden
               dark:bg-dark-surface-raised dark:shadow-[0_4px_6px_rgb(0_0_0/0.3)]"
      >
        <!-- Header band (compact) -->
        <div class="relative bg-gradient-to-br from-primary to-primary-darker px-5 py-2.5 overflow-hidden">
          <!-- Decorative circle -->
          <div class="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/8"></div>

          <div class="relative z-10 flex items-center gap-3">
            <img
              src="data:image/webp;base64,UklGRrwJAABXRUJQVlA4TK8JAAAvW8KWEIcgFkzmL92ZwvzPv0AghRtcogaDOQzaNpLk8Ie9/x2BiJgA5910467xpLKZxVs46kptoWLH5kYNVS73XxeQc1myrdatBBKW9ebMf7pJrh0bSR1Xf0T0fwIoSLIVR5L+ZxNCwP/3P3F3z4Ch6EUR/Y8Qf/dBRDzZXvHzbzXHTZ4qH1uJwo+Vty1t/Fx5bdE/WABo3h4sADT5BwuAvvODBUD2TxagZrLgs5DlPgtZ7jOT5d4jWe5NyXK7yHLvkSz3ipaPQJZbIcu9KVk+IlluhSz3ipY3JcuHkuUjkuUWyXKLZLlFstwiWW6RLGgkCxbI8qFk+UDLG1p+oeUZLQtk+UDLb7Q8o2VKlj9o+YWWKVn+oOUZralkeUXLAlne0PKIVkfLE1odLU9odbQ8oNXQckWrojXR8oxWQ8sVrYLWQMsDWhdaD1quaGW0GloTLQ9oFbQaWgMtV7QSWhWthlZHy9kKaCW0LrQqWg2t/seWoeV/JzJa8vn/+f/5//n/+f/5//n/+f/5/3uv1wGPcyF761lC5tazIo2aRWSPsdb+RPmzkxBLe6p89Fus+lh560Jqz5VX3trk6jVeAywRCdcAS0TCPcESkdzJEgmNLJFwG1gi2sgSCQ9ZImmSJVLRkjjIErnRkmxkSRxkiXayRBpa0tCShpY0tKShpYMsUSNLIlpyoSUPWmpkSUZLOloBLbnRUiNLKlpqZMmNVkBLHrQyWjLRutGKaMlEq6GV0VK0pKN1o5XRCmiJodXRutG60EpoRbTkz63+V2JDq37+/z9GvmvW/Zrx9V7zLuZ0DN5qlgcLgCpPFiAaYkAg2+FEYLciMKFsRGIC0YgChRpRoYC3oVOx2zCpiCaoU1FMSFhUEypaHYtigmMRLUhcBAtuLpwFE4tGBkbHIlhwY1HJwkmFsgXJoWieLGxQRCYLgxPRI5ONlYZeU3BkpRoBWT56MrY6AZGMViOrOljByHocrORg6STrdrCSg6WTrMfBqg5WdrCigaXmXOlwrng4V9ycK27gihueK9zwXPEdzxWveK4ETOB7TXiucMVzxSueK4JZfKck5clC5PKThcjlJwuRq08WImlPFqJdySJ+yCLJRpboQ5bIhZbESZZoJ0ukoSUFLSloSTKyJBpZktCSgpYUtORGSzpaOsmSiJZcaElHKxhZcqElA62EljS0AlrS0ApoSUMroCUPWhktmWhVtAJaMtC60ApoyUDrRiujJWyN953lqLfsft+nt5qjmFMweF82W+L58DDKHoAmlsj5kL35rLQLIFjSzztOD4Ih7Rzuc4C3o55D/cG+ZNWOfDrVoO0s2Qm8Gekc0g8mg+Qk20s0Q88h/OBuEJ/U91LNkHMgPccbRP2cNBeww86hnNLJ4nzOtij9HMIpyaTtFKVfF+sZziTSM/JsyOrF/yHFEzLZHM9ws8FmPLtO/0fWQ+qMonYs0myQmfUgyB8SstrrkUq/MBL9kwrZ7fvfMk9H/TdFLv8hM1nOUT+1jcy+UfpHRcRbTDXGjcl8ibGkGBwZfiO/fOV/u5T3qbR89WT9kyXQgyWQpW3X/VSrJ1M7CZqFjN32OCB/rVbT7snebfsByUlZjnsy3N52pKH6ttP5bBOgLzZOQNp3fUP5xZYJqPvu51Mn4Nn3PB+dgLFvPx9MgG88nY5MQNx5OZ0wAWXn9+mkCWg776dTJ2Ds3E8H41PfejwbmYC89+ts6gby3LWz6RvoczfPxtf3mDsPJ5M3EGevnMy9gTZ7z8nM9R1mzw4m+vpp+jyfy7WBPn/3uYz1BfM3jyX4+nkBPJ5KXd9hBdqpzPXjEtihJF+edQk8n0lbf8caPEcSfP2+CB5OpK4fsAr1QNSWZ10GO5Diy0csg5fzmMuzLsTchXfTUHz5jIXwsolWZ0FtecFSzD0kYJ+E6su3tfCyAwGgbgrUlo9YjLkB7gDQpuD21T1Ww+v6BW/jBARfvq2H6eoBH2V8bfmE9fBnca+flEeXfHXBinhamhv+WAenc3XWNZm6csGf09huX71hTfxeOOJgGFny1TNWxfOyG46qH5fO1Xesi+miXg+h87AeXzxgYVDHxIoTGw9qx+C8Lg3SiLjh1DwmweC8Ym0QxsMNJ+cROR2cV6wO/HAyTk/j4YaxecX6qB9MxhfDaLhibF6xQFA3lIyvhrFww9i8YonQeCAZXw4j4YaxBcUiofEoOOPraRzcMLaAQS8J9WPghgvmUbiGsWWsFNSPwDVcsvAQvGJormGtoME+r7ho4wEExdA2xWoB0bqA66o3L+L6pnDByNdFZcs449K7bVwxtKBYM6jY5RsuXtgw6RiZrxj8ykBio3bF5XUzK+KeVriM4a+NLha5ilsWNsk3DIyjYvGA4qzhiLtqsIcTbmuBS4oZXB6IbErouHETY4JiXD5jEjcAjWxG6Lh5FUNCx51vxqFhGncAaHImhA4DqxgROu59K58VE7kHAGW7m4sKI1u4n4uKu9/Hp4653AbQk78PhwJLNfs7cSgw8CY+dUznRgD05O/AocDenvw9XCiw8Q5b6pjRvQDQsvsr8ZYarNYS/LVcyB1mXs3vBbO6nVetcfPfY9lzg/Va4+YvwBJiVZh6IdliVUzslt63GuMm/pgT2WOuioG2muIuInxARCTGVCssPo3lc4gx1qqY3o39udX3il/rHn+3n/+f/5//n/+f/5//n/+f/x9mDa36p5aiJX9uJbAMrQ6XgJUfLZFkcBVIOldCUrlyJBdXRJKwqkSiWGUikUnV/vJQJS+VKnpNULU3ClV+I4Op8O5myr3LSHV6r0ilD9KJ2j5dRNHnAFT5g0yewl9unvgvEadCf540hb9dNPHfAkyZDj4syZGMUqfDk6T9WAVJ+ZgaR5lObBy5MwJGmU5tFPlzAkSVTm4MyVkBoUKnN4LceWr8ZPpixUf5GzrpifTVDE+nL3d25FvByMn09Qsc5e9J52ajCwajptAlL2g6X0MeZoQuqkZMpMsmYCpd+MJF+UrSaPF0aR2sBLp4MFIyXT4aJ4VuWDBpfAcpkDSmexZE1NFdGyDq6b4ND/V05waHerr3jYZ6unsBo3m6f8GiMVmYjYnKZGM0IjKZqYOHnSxtMKiQrQWF5sjaODlIZLA2CHQjm7MRUJms1uf1606WZ3v3xZHt2l5838j+1N96ZBpimW+8OBqlVnvbVWikWu1NV6HRarW3XIVGrNd8w0Vo2KW/XE2Ohh6S/q5qoAnc8k+qR0eTyKHob6knT3O5pf4rKrujGXUht19PjUIzyxJL/83UFDzNsWwx1foj6bXEXRzNuPw6PRkPAA=="
              alt="logo"
              class="w-7 h-7 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-1.5">
                <span class="text-[16px] font-bold text-white tracking-tight">{{ title() }}</span>
                @if (subtitle()) {
                  <span class="text-[12px] text-white/60">{{ subtitle() }}</span>
                }
              </div>
            </div>
            <p class="shrink-0 text-[13px] text-white/80">{{ greeting() }}</p>
          </div>
        </div>

        <!-- Content slot -->
        <div class="px-5 py-4">
          <ng-content />
        </div>

        <!-- Footer (compact) -->
        <div
          class="px-5 py-2 border-t border-wb-gray-100 flex items-center justify-between
                 dark:border-dark-border"
        >
          <span class="text-[10px] text-wb-gray-400">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse"></span>
            {{ statusText() }}
          </span>
          <span class="text-[10px] text-wb-gray-400">MCP App</span>
        </div>
      </div>
    </div>
  `,
})
export class CardLayoutComponent {
  /** Header title */
  readonly title = input(COMPANY_NAME);

  /** Main greeting text */
  readonly greeting = input('Welcome');

  /** Subtitle next to title */
  readonly subtitle = input<string | undefined>();

  /** Optional badge text */
  readonly badge = input<string | undefined>();

  /** Footer status text */
  readonly statusText = input('Connected');
}
