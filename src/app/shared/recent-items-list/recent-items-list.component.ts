import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PreloaderComponent } from '../preloader/preloader.component';

export interface RecentListItem {
  id: string;
  primaryText: string;
  secondaryText?: string;
  routerLink: string | any[];
}

@Component( {
  selector: 'app-recent-items-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PreloaderComponent],
  templateUrl: './recent-items-list.component.html',
  styleUrl: './recent-items-list.component.css'
} )
export class RecentItemsListComponent {
  @Input() heading = 'Recent';
  @Input() items: RecentListItem[] = [];
  @Input() isLoading = false;
  @Input() emptyMessage = 'Nothing here yet.';
  @Input() viewAllRoute: string | any[] | null = null;
  @Input() viewAllLabel = 'View all';
}
