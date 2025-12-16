'use client';

import { useEffect, Fragment, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { api } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { User2, Settings, LogOut, Github, Smartphone, Menu } from 'lucide-react';

// Route name mapping
const routeNames: Record<string, string> = {
  '/devices': 'Devices',
  '/sms': 'SMS',
  '/calls': 'Calls',
  '/settings': 'Settings',
  'sms': 'SMS',
  'calls': 'Calls',
  'contacts': 'Contacts',
  'clone': 'Clone',
};

function DashboardHeader() {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const [deviceName, setDeviceName] = useState<string | null>(null);

  // Fetch device name if on device detail page
  useEffect(() => {
    const match = pathname.match(/^\/devices\/(\d+)/);
    if (match) {
      const deviceId = match[1];
      api.getDevice(deviceId).then((res) => {
        if (res.data) {
          setDeviceName(res.data.name);
        }
      });
    } else {
      setDeviceName(null);
    }
  }, [pathname]);

  // Generate breadcrumb items from pathname
  const getBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: Array<{ name: string; href: string }> = [];

    // If on home page (/devices), just show "Home"
    if (pathname === '/devices') {
      return [{ name: 'Home', href: '/devices' }];
    }

    // Otherwise show "Home > ..."
    breadcrumbs.push({ name: 'Home', href: '/devices' });

    let currentPath = '';
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      currentPath += `/${path}`;

      // Check if this is a device ID (numeric)
      if (i === 1 && paths[0] === 'devices' && /^\d+$/.test(path)) {
        // Use device name if available, otherwise show ID
        const name = deviceName || path;
        breadcrumbs.push({ name, href: currentPath });
      } else {
        // Try to get name from routeNames using full path or just the segment
        const name = routeNames[currentPath] || routeNames[path] || path.charAt(0).toUpperCase() + path.slice(1);
        breadcrumbs.push({ name, href: currentPath });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background">
      {/* Left side: Menu button and Logo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-primary rounded-md">
          <Smartphone className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold">SMServer</span>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb className="ml-4">
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <Fragment key={`breadcrumb-${index}-${crumb.href}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side: GitHub and User */}
      <a
        href="https://github.com/solywsh/smserver"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent hover:text-accent-foreground"
      >
        <Github className="h-5 w-5" />
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent hover:text-accent-foreground">
            <User2 className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-sm font-medium">
            {user?.username || 'User'}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full">
        {/* Header fixed at the top */}
        <DashboardHeader />

        {/* Sidebar and content area below header, takes remaining height */}
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar />
          <SidebarInset className="w-full overflow-auto">
            <main className="p-4">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
