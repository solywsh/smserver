'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, SmsMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ArrowLeft,
  Search,
  Send,
  MessageSquare,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';

export default function SmsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('0');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [smsForm, setSmsForm] = useState({ simSlot: '1', phoneNumbers: '', content: '' });
  const [sending, setSending] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    const type = typeFilter === '0' ? undefined : parseInt(typeFilter);
    const res = await api.getDeviceSms(resolvedParams.id, type, 1, 50, searchQuery || undefined);
    if (res.data) {
      setMessages(res.data.items || []);
    } else {
      toast.error(res.error || 'Failed to fetch messages');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [resolvedParams.id, typeFilter]);

  const handleSearch = () => {
    fetchMessages();
  };

  const handleSendSms = async () => {
    if (!smsForm.phoneNumbers.trim() || !smsForm.content.trim()) {
      toast.error('Phone numbers and content are required');
      return;
    }
    setSending(true);
    const res = await api.sendSms(
      resolvedParams.id,
      parseInt(smsForm.simSlot),
      smsForm.phoneNumbers.trim(),
      smsForm.content.trim()
    );
    if (res.data) {
      toast.success('SMS sent successfully');
      setSendDialogOpen(false);
      setSmsForm({ simSlot: '1', phoneNumbers: '', content: '' });
      fetchMessages();
    } else {
      toast.error(res.error || 'Failed to send SMS');
    }
    setSending(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/devices/${resolvedParams.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">SMS Messages</h1>
          <p className="text-muted-foreground">View and send SMS through this phone</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
              <CardDescription>{messages.length} messages</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchMessages}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Send className="mr-2 h-4 w-4" />
                    Send SMS
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send SMS</DialogTitle>
                    <DialogDescription>
                      Send an SMS message through this phone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>SIM Card</Label>
                      <Select value={smsForm.simSlot} onValueChange={(v) => setSmsForm({ ...smsForm, simSlot: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">SIM 1</SelectItem>
                          <SelectItem value="2">SIM 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumbers">Phone Numbers</Label>
                      <Input
                        id="phoneNumbers"
                        placeholder="15888888888;19999999999"
                        value={smsForm.phoneNumbers}
                        onChange={(e) => setSmsForm({ ...smsForm, phoneNumbers: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Multiple numbers separated by semicolons</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content">Message</Label>
                      <Textarea
                        id="content"
                        placeholder="Enter message content"
                        value={smsForm.content}
                        onChange={(e) => setSmsForm({ ...smsForm, content: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSendSms} disabled={sending}>
                      {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by keyword..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
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
              {searchQuery ? 'No messages found matching your search' : 'No messages yet'}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[150px]">Number</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-[80px]">SIM</TableHead>
                    <TableHead className="w-[180px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg, index) => (
                    <TableRow key={index}>
                      <TableCell>{getDirectionBadge(msg.type)}</TableCell>
                      <TableCell className="font-mono">
                        <div>
                          <div>{msg.number}</div>
                          {msg.name && <div className="text-xs text-muted-foreground">{msg.name}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate">{msg.content}</TableCell>
                      <TableCell className="text-muted-foreground">{getSimLabel(msg.sim_id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(msg.date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
