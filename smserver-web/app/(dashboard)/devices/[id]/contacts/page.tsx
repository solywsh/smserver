'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, Contact } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Users,
  UserPlus,
  RefreshCw,
  Search,
  Phone,
  User,
  Loader2,
} from 'lucide-react';

export default function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    phoneNumber: '',
  });
  const [adding, setAdding] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    const res = await api.getDeviceContacts(
      resolvedParams.id,
      searchPhone || undefined,
      searchName || undefined
    );
    if (res.data) {
      setContacts(res.data.items || []);
    } else {
      toast.error(res.error || 'Failed to fetch contacts');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, [resolvedParams.id]);

  const handleSearch = () => {
    fetchContacts();
  };

  const handleAddContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phoneNumber.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    setAdding(true);
    const res = await api.addContact(
      resolvedParams.id,
      contactForm.name.trim(),
      contactForm.phoneNumber.trim()
    );
    if (res.data) {
      toast.success('Contact added successfully');
      setAddDialogOpen(false);
      setContactForm({ name: '', phoneNumber: '' });
      fetchContacts();
    } else {
      toast.error(res.error || 'Failed to add contact');
    }
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/devices/${resolvedParams.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">View and add contacts on this phone</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact List
              </CardTitle>
              <CardDescription>{contacts.length} contacts</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchContacts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>
                      Add a new contact to the phone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        placeholder="15888888888;19999999999"
                        value={contactForm.phoneNumber}
                        onChange={(e) => setContactForm({ ...contactForm, phoneNumber: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Multiple numbers separated by semicolons</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddContact} disabled={adding}>
                      {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Add Contact
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
                placeholder="Search by name..."
                className="pl-10"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Input
              placeholder="Phone number..."
              className="w-[200px]"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {(searchName || searchPhone) ? 'No contacts found matching your search' : 'No contacts yet'}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {contact.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {contact.phone_number}
                        </div>
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
