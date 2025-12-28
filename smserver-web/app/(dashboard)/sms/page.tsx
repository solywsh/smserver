'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, SmsMessageWithDevice, Device } from '@/lib/api';
import { SmsViewMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Search,
  MessageSquare,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Smartphone,
  Circle,
  Trash2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ViewToggle } from '@/components/sms/ViewToggle';
import { ConversationView } from '@/components/sms/ConversationView';

export default function AllSmsPage() {
  const searchParams = useSearchParams();
  const viewMode = (searchParams.get('view') as SmsViewMode) || 'list';

  const [messages, setMessages] = useState<SmsMessageWithDevice[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('0');
  const [deviceFilter, setDeviceFilter] = useState<string>('0');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedMessage, setSelectedMessage] = useState<SmsMessageWithDevice | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDevices = async () => {
    const res = await api.getDevices();
    if (res.data) {
      setDevices(res.data.items || []);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    const type = typeFilter === '0' ? undefined : parseInt(typeFilter);
    const deviceId = deviceFilter === '0' ? undefined : parseInt(deviceFilter);
    const res = await api.getAllSms(type, page, pageSize, searchQuery || undefined, deviceId);
    if (res.data) {
      setMessages(res.data.items || []);
      setTotal(res.data.total || 0);
    } else {
      toast.error(res.error || 'Failed to fetch messages');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [typeFilter, deviceFilter, page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    fetchMessages();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const getDirectionBadge = (type: number) => {
    if (type === 1) {
      return (
        <Badge variant="secondary" className="gap-1">
          <ArrowDownLeft className="h-3 w-3" />
          Received
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <ArrowUpRight className="h-3 w-3" />
        Sent
      </Badge>
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSimLabel = (simId: number) => {
    if (simId === 0) return 'SIM 1';
    if (simId === 1) return 'SIM 2';
    return '-';
  };

  const handleMessageClick = async (msg: SmsMessageWithDevice, e?: React.MouseEvent) => {
    // Don't open detail if clicking checkbox
    if (e && (e.target as HTMLElement).closest('[data-checkbox]')) {
      return;
    }

    setSelectedMessage(msg);

    // If message is unread, mark it as read
    if (!msg.is_read) {
      const res = await api.markSmsAsRead(msg.id);
      if (res.data) {
        // Update local state
        setMessages(messages.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(messages.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;

    setDeleting(true);
    const res = await api.deleteMultipleSms(selectedIds);
    setDeleting(false);
    setShowDeleteDialog(false);

    if (res.data) {
      toast.success(`Deleted ${selectedIds.length} message(s)`);
      setSelectedIds([]);
      fetchMessages();
    } else {
      toast.error(res.error || 'Failed to delete messages');
    }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;
  const allSelected = messages.length > 0 && selectedIds.length === messages.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < messages.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">All SMS Messages</h1>
          <p className="text-muted-foreground">View SMS messages from all devices</p>
        </div>
        <ViewToggle currentView={viewMode} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
              <CardDescription>
                {total} messages total
                {unreadCount > 0 && (
                  <span className="ml-2 text-orange-600">({unreadCount} unread)</span>
                )}
                {selectedIds.length > 0 && (
                  <span className="ml-2 text-blue-600">({selectedIds.length} selected)</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedIds.length})
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={fetchMessages} disabled={loading} title="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'conversation' ? (
            <ConversationView
              messages={messages}
              devices={devices}
              onRefresh={fetchMessages}
            />
          ) : (
            <>
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by keyword..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={deviceFilter} onValueChange={(v) => { setDeviceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Devices</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id.toString()}>{device.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All</SelectItem>
                <SelectItem value="1">Received</SelectItem>
                <SelectItem value="2">Sent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No messages found matching your search' : 'No messages yet.'}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                    </TableHead>
                    <TableHead className="w-[120px]">Device</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[150px]">Number</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-[80px]">SIM</TableHead>
                    <TableHead className="w-[180px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow
                      key={msg.id}
                      className={`cursor-pointer hover:bg-muted/50 ${!msg.is_read ? 'font-semibold' : ''}`}
                      onClick={(e) => handleMessageClick(msg, e)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()} data-checkbox>
                        <Checkbox
                          checked={selectedIds.includes(msg.id)}
                          onCheckedChange={(checked) => handleSelectOne(msg.id, checked as boolean)}
                          aria-label={`Select message ${msg.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/devices/${msg.device_id}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Smartphone className="h-3 w-3" />
                          {msg.device_name}
                        </Link>
                      </TableCell>
                      <TableCell>{getDirectionBadge(msg.type)}</TableCell>
                      <TableCell className="font-mono">
                        <div>
                          <div>{msg.address}</div>
                          {msg.name && <div className="text-xs text-muted-foreground">{msg.name}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        <div className="flex items-center gap-2">
                          {!msg.is_read && (
                            <Circle className="h-2 w-2 fill-blue-500 text-blue-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{msg.body}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{getSimLabel(msg.sim_id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(msg.sms_time)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message Details
            </DialogTitle>
            <DialogDescription>
              Full message information
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                {getDirectionBadge(selectedMessage.type)}
                <span className="text-muted-foreground">{getSimLabel(selectedMessage.sim_id)}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Device:</span>
                <Link href={`/devices/${selectedMessage.device_id}`} className="text-primary hover:underline">
                  {selectedMessage.device_name}
                </Link>
                <span className="text-muted-foreground">Number:</span>
                <span className="font-mono">{selectedMessage.address}</span>
                {selectedMessage.name && (
                  <>
                    <span className="text-muted-foreground">Name:</span>
                    <span>{selectedMessage.name}</span>
                  </>
                )}
                <span className="text-muted-foreground">Time:</span>
                <span>{formatDate(selectedMessage.sms_time)}</span>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Content:</span>
                <div className="p-3 bg-muted rounded-md whitespace-pre-wrap break-words text-sm">
                  {selectedMessage.body}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Messages</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.length} message(s)? This action cannot be undone.
              This will only delete messages from the server database, not from your device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
