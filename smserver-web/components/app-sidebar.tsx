'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  Smartphone,
  Settings,
  MessageSquare,
  PhoneCall,
  ChevronDown,
  User,
} from 'lucide-react';

const generalNavItems = [
  {
    title: 'Devices',
    url: '/devices',
    icon: Smartphone,
  },
  {
    title: 'SMS',
    url: '/sms',
    icon: MessageSquare,
  },
  {
    title: 'Calls',
    url: '/calls',
    icon: PhoneCall,
  },
];

const settingsSubItems = [
  {
    title: 'Profile',
    url: '/settings/profile',
    icon: User,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings'));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        {/* General Group */}
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || (item.url !== '/' && pathname.startsWith(item.url))}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Other Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  isActive={pathname === '/settings'}
                >
                  <Settings />
                  <span>Settings</span>
                  <ChevronDown className={`ml-auto transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </SidebarMenuButton>
                {settingsOpen && (
                  <SidebarMenuSub>
                    {settingsSubItems.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton asChild isActive={pathname === item.url}>
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
