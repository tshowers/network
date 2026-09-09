import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastComponent } from './shared/toast/toast.component';
import { SiteFooterComponent } from './shared/site-footer/site-footer.component';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, SiteFooterComponent, CommandPaletteComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'network';
}
