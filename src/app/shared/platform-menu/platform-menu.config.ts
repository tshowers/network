import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Network's part of the universal menu: what you can do in Network. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'network',
  name: 'Network',
  logo: 'assets/find/entities/network/logo.png',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Relationships', icon: 'users', route: '/app' },
    { label: 'Contacts', icon: 'list', route: '/contact-list', keywords: 'people' },
    { label: 'Add a contact', icon: 'plus', route: '/contact-edit', keywords: 'new create' },
    { label: 'Import', icon: 'upload', route: '/contact-import', keywords: 'csv' },
    { label: 'Pipeline', icon: 'chart', route: '/contact-deal-flow', keywords: 'deals' },
    { label: 'Networking Progress', icon: 'growth', route: '/contact-deal-flow-dashboard', keywords: 'dashboard' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
