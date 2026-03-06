import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Printer, QrCode, Search } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Barcoding = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin-books-barcode"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("id, title, isbn, category, barcode").order("title");
      if (error) throw error;
      return data;
    },
  });

  const updateBarcode = useMutation({
    mutationFn: async ({ id, barcode }: { id: string; barcode: string }) => {
      const { error } = await supabase.from("books").update({ barcode }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-books-barcode"] });
      toast({ title: "Barcode updated" });
      setEditId(null);
    },
  });

  const autoGenerate = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const barcode = `ATH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        await supabase.from("books").update({ barcode }).eq("id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-books-barcode"] });
      toast({ title: `Barcodes generated for ${selected.size} books` });
      setSelected(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === (filtered?.length || 0)) setSelected(new Set());
    else setSelected(new Set(filtered?.map(b => b.id)));
  };

  const filtered = books?.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || (b.isbn || "").includes(search));

  return (
    <AdminLayout title="Physical Barcoding & Labeling" description="Generate and assign barcodes to physical items">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search books…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={selected.size === 0} onClick={() => autoGenerate.mutate([...selected])}>
            <QrCode className="w-4 h-4 mr-2" />Generate Barcodes ({selected.size})
          </Button>
          <Button variant="outline" disabled={selected.size === 0} onClick={() => { toast({ title: "Print dialog", description: `Printing labels for ${selected.size} books` }); }}>
            <Printer className="w-4 h-4 mr-2" />Print Labels
          </Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><input type="checkbox" className="rounded border-input" checked={selected.size === (filtered?.length || 0) && (filtered?.length || 0) > 0} onChange={toggleAll} /></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered?.map(book => (
              <TableRow key={book.id}>
                <TableCell><input type="checkbox" className="rounded border-input" checked={selected.has(book.id)} onChange={() => toggleSelect(book.id)} /></TableCell>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell className="font-mono text-xs">{book.isbn || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{(book as any).barcode || <span className="text-muted-foreground">None</span>}</TableCell>
                <TableCell><Badge variant="secondary">{book.category}</Badge></TableCell>
                <TableCell><Badge variant={(book as any).barcode ? "default" : "destructive"}>{(book as any).barcode ? "Labeled" : "Pending"}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => { setEditId(book.id); setBarcodeValue((book as any).barcode || ""); }}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Barcode</DialogTitle></DialogHeader>
          <div><Label>Barcode Value</Label><Input value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} placeholder="Enter barcode or scan…" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={() => editId && updateBarcode.mutate({ id: editId, barcode: barcodeValue })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Barcoding;
