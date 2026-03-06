import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, AlertTriangle, CheckCircle, Package, QrCode, Printer } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

const Inventory = () => {
  const [stockTaking, setStockTaking] = useState(false);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: allCopies } = useQuery({
    queryKey: ["admin-book-copies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("book_copies" as any).select("*").order("copy_number");
      if (error) throw error;
      return data as any[];
    },
  });

  const updateCopies = useMutation({
    mutationFn: async ({ id, total_copies, available_copies }: { id: string; total_copies: number; available_copies: number }) => {
      const { error } = await supabase.from("books").update({ total_copies, available_copies }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      toast({ title: "Stock updated" });
    },
  });

  const updateCopyStatus = useMutation({
    mutationFn: async ({ copyId, status }: { copyId: string; status: string }) => {
      const { error } = await supabase.from("book_copies" as any).update({ status }).eq("id", copyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-book-copies"] });
      toast({ title: "Copy status updated" });
    },
  });

  const generateCopies = useMutation({
    mutationFn: async (bookId: string) => {
      const book = books?.find(b => b.id === bookId);
      if (!book) return;
      const existing = (allCopies || []).filter((c: any) => c.book_id === bookId);
      const startNum = existing.length + 1;
      for (let i = startNum; i <= book.total_copies; i++) {
        const copyId = `${bookId.slice(0, 8)}-C${String(i).padStart(3, "0")}`;
        const qrDataUrl = await QRCode.toDataURL(copyId, { width: 200, margin: 1 });
        await supabase.from("book_copies" as any).insert({
          book_id: bookId,
          copy_number: i,
          copy_id: copyId,
          qr_code_url: qrDataUrl,
          status: "available",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-book-copies"] });
      toast({ title: "Copies & QR codes generated" });
    },
  });

  const printLabels = (copies: any[]) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `<html><head><title>QR Labels</title><style>body{font-family:sans-serif;display:flex;flex-wrap:wrap;gap:16px;padding:16px}.label{text-align:center;border:1px solid #ccc;padding:8px;border-radius:4px;width:180px}img{width:150px;height:150px}.id{font-size:10px;font-family:monospace;margin-top:4px}</style></head><body>${copies.map((c: any) => `<div class="label"><img src="${c.qr_code_url}" /><div class="id">${c.copy_id}</div></div>`).join("")}</body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const totalBooks = books?.length || 0;
  const totalCopies = books?.reduce((a, b) => a + b.total_copies, 0) || 0;
  const availableCopies = books?.reduce((a, b) => a + b.available_copies, 0) || 0;
  const lowStock = books?.filter(b => b.available_copies === 0) || [];

  const toggleVerified = (id: string) => {
    const next = new Set(verified);
    next.has(id) ? next.delete(id) : next.add(id);
    setVerified(next);
  };

  const getCopiesForBook = (bookId: string) => (allCopies || []).filter((c: any) => c.book_id === bookId);

  return (
    <AdminLayout title="Inventory / Stock-taking" description="Track physical inventory with individual copy tracking and QR codes">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Total Titles</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">{totalBooks}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4" />Total Copies</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">{totalCopies}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" />Available</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">{availableCopies}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" />Out of Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">{lowStock.length}</p></CardContent></Card>
      </div>
      <div className="flex gap-3 mb-4">
        <Button onClick={() => { setStockTaking(!stockTaking); setVerified(new Set()); }}>
          <ClipboardList className="w-4 h-4 mr-2" />{stockTaking ? "End Stock-take" : "Start Stock-take"}
        </Button>
        {stockTaking && (
          <p className="text-sm text-muted-foreground self-center">
            Verified: {verified.size}/{totalBooks} — Click ✓ to mark items as physically verified
          </p>
        )}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {stockTaking && <TableHead className="w-10">✓</TableHead>}
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Copies</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={stockTaking ? 9 : 8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : books?.map(b => {
              const copies = getCopiesForBook(b.id);
              const isExpanded = expandedBook === b.id;
              return (
                <>
                  <TableRow key={b.id} className={`cursor-pointer ${stockTaking && verified.has(b.id) ? "bg-accent/10" : ""}`} onClick={() => setExpandedBook(isExpanded ? null : b.id)}>
                    {stockTaking && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={verified.has(b.id)} onChange={() => toggleVerified(b.id)} className="rounded border-input" />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>{b.author}</TableCell>
                    <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
                    <TableCell>{b.total_copies}</TableCell>
                    <TableCell>{b.available_copies}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{copies.length} tracked</Badge>
                    </TableCell>
                    <TableCell><Badge variant={b.available_copies > 0 ? "default" : "destructive"}>{b.available_copies > 0 ? "In Stock" : "Out"}</Badge></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => updateCopies.mutate({ id: b.id, total_copies: b.total_copies + 1, available_copies: b.available_copies + 1 })}>+1</Button>
                        <Button variant="ghost" size="sm" disabled={b.total_copies <= 1} onClick={() => updateCopies.mutate({ id: b.id, total_copies: b.total_copies - 1, available_copies: Math.min(b.available_copies, b.total_copies - 1) })}>-1</Button>
                        {copies.length < b.total_copies && (
                          <Button variant="ghost" size="sm" onClick={() => generateCopies.mutate(b.id)}>
                            <QrCode className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && copies.length > 0 && (
                    <TableRow key={`${b.id}-copies`}>
                      <TableCell colSpan={stockTaking ? 9 : 8} className="bg-muted/30 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold">Individual Copies — {b.title}</p>
                          <Button variant="outline" size="sm" onClick={() => printLabels(copies)}>
                            <Printer className="w-3.5 h-3.5 mr-1" />Print QR Labels
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {copies.map((c: any) => (
                            <div key={c.id} className="border rounded-lg p-3 bg-card text-center space-y-2">
                              {c.qr_code_url && <img src={c.qr_code_url} alt={c.copy_id} className="w-20 h-20 mx-auto" />}
                              <p className="font-mono text-xs">{c.copy_id}</p>
                              <Select value={c.status} onValueChange={v => updateCopyStatus.mutate({ copyId: c.id, status: v })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="available">Available</SelectItem>
                                  <SelectItem value="borrowed">Borrowed</SelectItem>
                                  <SelectItem value="reserved">Reserved</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Inventory;
