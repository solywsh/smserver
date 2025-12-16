'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, CallLog, SyncResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  Clock,
  PhoneOff,
  Ban,
  Voicemail,
  Headphones,
  ShieldAlert,
} from 'lucide-react';

export default function CallsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('0');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const fetchCalls = async (withSync = false) => {
    setLoading(true);

    // If withSync, first sync data from phone
    if (withSync) {
      const type = typeFilter === '0' ? undefined : parseInt(typeFilter);
      const syncRes = await api.syncDeviceCalls(resolvedParams.id, type);
      if (syncRes.data) {
        setSyncResult(syncRes.data);
        if (syncRes.data.new_count > 0) {
          toast.success(`Synced ${syncRes.data.new_count} new calls`);
        }
      } else if (syncRes.error) {
        toast.error(syncRes.error || 'Sync failed');
      }
    }

    // Then fetch from database
    const type = typeFilter === '0' ? undefined : parseInt(typeFilter);
    const res = await api.getDeviceCalls(resolvedParams.id, type, page, pageSize);
    if (res.data) {
      setCalls(res.data.items || []);
      setTotal(res.data.total || 0);
    } else {
      toast.error(res.error || 'Failed to fetch call logs');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();
  }, [resolvedParams.id, typeFilter, page, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  // Android CallLog.Calls TYPE constants + vendor-specific types
  const getCallTypeBadge = (type: number) => {
    switch (type) {
      case 1: // INCOMING_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
            <PhoneIncoming className="h-3 w-3" />
            Incoming
          </Badge>
        );
      case 2: // OUTGOING_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
            <PhoneOutgoing className="h-3 w-3" />
            Outgoing
          </Badge>
        );
      case 3: // MISSED_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700">
            <PhoneMissed className="h-3 w-3" />
            Missed
          </Badge>
        );
      case 4: // VOICEMAIL_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700">
            <Voicemail className="h-3 w-3" />
            Voicemail
          </Badge>
        );
      case 5: // REJECTED_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700">
            <PhoneOff className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case 6: // BLOCKED_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-700">
            <Ban className="h-3 w-3" />
            Blocked
          </Badge>
        );
      case 7: // ANSWERED_EXTERNALLY_TYPE
        return (
          <Badge variant="secondary" className="gap-1 bg-cyan-100 text-cyan-700">
            <Headphones className="h-3 w-3" />
            External
          </Badge>
        );
      default:
        // Vendor-specific types (e.g., MIUI uses 52 for spam interception)
        if (type >= 50) {
          return (
            <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-700">
              <ShieldAlert className="h-3 w-3" />
              Intercepted
            </Badge>
          );
        }
        return <Badge variant="outline">Type {type}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
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
          <h1 className="text-2xl font-bold">Call Logs</h1>
          <p className="text-muted-foreground">View call history from this phone</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5" />
                Call History
              </CardTitle>
              <CardDescription>
                {total} calls total
                {syncResult && syncResult.new_count > 0 && (
                  <span className="ml-2 text-green-600">({syncResult.new_count} new synced)</span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => fetchCalls(true)} disabled={loading} title="Sync & Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Calls</SelectItem>
                  <SelectItem value="1">Incoming</SelectItem>
                  <SelectItem value="2">Outgoing</SelectItem>
                  <SelectItem value="3">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : calls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {typeFilter !== '0' ? 'No calls found with this filter' : 'No call logs yet. Click the sync button to fetch from phone.'}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[150px]">Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Duration</TableHead>
                    <TableHead className="w-[80px]">SIM</TableHead>
                    <TableHead className="w-[180px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>{getCallTypeBadge(call.type)}</TableCell>
                      <TableCell className="font-mono">{call.number}</TableCell>
                      <TableCell>{call.name || '-'}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDuration(call.duration)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{getSimLabel(call.sim_id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(call.call_time)}
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
        </CardContent>
      </Card>
    </div>
  );
}
