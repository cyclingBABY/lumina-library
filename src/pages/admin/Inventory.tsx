import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, AlertTriangle, CheckCircle, Package } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Inventory = () => {
  const [stockTaking, setStockTaking] = useState(false);
  const [verified, setVerified] = useState<Set<string>>(new Set());
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

  const totalBooks = books?.length || 0;
  const totalCopies = books?.reduce((a, b) => a + b.total_copies, 0) || 0;
  const availableCopies = books?.reduce((a, b) => a + b.available_copies, 0) || 0;
  const lowStock = books?.filter(b => b.available_copies === 0) || [];

  const toggleVerified = (id: string) => {
    const next = new Set(verified);
    next.has(id) ? next.delete(id) : next.add(id);
    setVerified(next);
  };

  return (
    <AdminLayout title="Inventory / Stock-taking" description="Track physical inventory, identify discrepancies, and manage stock">
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
              <TableHead>Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={stockTaking ? 9 : 8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : books?.map(b => (
              <TableRow key={b.id} className={stockTaking && verified.has(b.id) ? "bg-success/5" : ""}>
                {stockTaking && (
                  <TableCell>
                    <input type="checkbox" checked={verified.has(b.id)} onChange={() => toggleVerified(b.id)} className="rounded border-input" />
                  </TableCell>
                )}
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.author}</TableCell>
                <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
                <TableCell>{b.total_copies}</TableCell>
                <TableCell>{b.available_copies}</TableCell>
                <TableCell>{b.total_copies - b.available_copies}</TableCell>
                <TableCell><Badge variant={b.available_copies > 0 ? "default" : "destructive"}>{b.available_copies > 0 ? "In Stock" : "Out"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => updateCopies.mutate({ id: b.id, total_copies: b.total_copies + 1, available_copies: b.available_copies + 1 })}>+1</Button>
                    <Button variant="ghost" size="sm" disabled={b.total_copies <= 1} onClick={() => updateCopies.mutate({ id: b.id, total_copies: b.total_copies - 1, available_copies: Math.min(b.available_copies, b.total_copies - 1) })}>-1</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Inventory;
