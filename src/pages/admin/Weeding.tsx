import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Weeding = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin-weeding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("updated_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from("books").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-weeding"] });
      toast({ title: "Records removed from catalog" });
      setSelected(new Set());
      setConfirmOpen(false);
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === (books?.length || 0)) setSelected(new Set());
    else setSelected(new Set(books?.map(b => b.id)));
  };

  return (
    <AdminLayout title="Weeding (Record Deletion)" description="Review and remove outdated, damaged, or irrelevant catalog items">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Items sorted by last updated — oldest first. Review candidates for removal.</p>
        <Button variant="destructive" disabled={selected.size === 0} onClick={() => setConfirmOpen(true)}>
          <Trash2 className="w-4 h-4 mr-2" />Remove Selected ({selected.size})
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><input type="checkbox" className="rounded border-input" checked={selected.size === (books?.length || 0) && (books?.length || 0) > 0} onChange={toggleAll} /></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Copies</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : books?.map(b => (
              <TableRow key={b.id} className={selected.has(b.id) ? "bg-destructive/5" : ""}>
                <TableCell><input type="checkbox" className="rounded border-input" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} /></TableCell>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.author}</TableCell>
                <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
                <TableCell>{b.publish_year || "—"}</TableCell>
                <TableCell>{b.total_copies}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setDeleteId(b.id); setConfirmOpen(true); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              This will permanently remove {deleteId ? "this book" : `${selected.size} book(s)`} from the catalog. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setDeleteId(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId ? [deleteId] : [...selected])} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Weeding;
