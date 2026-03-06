import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, AlertCircle, CheckCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const FineProcessing = () => {
  const [addOpen, setAddOpen] = useState(false);
  const [patronEmail, setPatronEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Late return");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: fines, isLoading } = useQuery({
    queryKey: ["admin-fines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fines").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalUnpaid = fines?.filter(f => !f.paid).reduce((a, f) => a + Number(f.amount), 0) || 0;
  const totalPaid = fines?.filter(f => f.paid).reduce((a, f) => a + Number(f.amount), 0) || 0;

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fines").update({ paid: true, paid_date: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-fines"] });
      toast({ title: "Fine marked as paid" });
    },
  });

  const addFine = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", patronEmail).maybeSingle();
      if (!profile) throw new Error("Patron not found");
      const { error } = await supabase.from("fines").insert({ user_id: profile.user_id, amount: Number(amount), reason });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-fines"] });
      toast({ title: "Fine added" });
      setAddOpen(false);
      setPatronEmail("");
      setAmount("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout title="Fine & Fee Processing" description="View, issue, and process fine payments">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-destructive" />Outstanding</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">${totalUnpaid.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" />Collected</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">${totalPaid.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Total Records</CardTitle></CardHeader><CardContent><p className="text-2xl font-display font-semibold">{fines?.length || 0}</p></CardContent></Card>
      </div>
      <div className="flex mb-4">
        <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" />Issue Fine</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : fines?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No fines recorded</TableCell></TableRow>
            ) : fines?.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.reason || "Late return"}</TableCell>
                <TableCell className="font-mono">${Number(f.amount).toFixed(2)}</TableCell>
                <TableCell className="text-sm">{format(new Date(f.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell><Badge variant={f.paid ? "secondary" : "destructive"}>{f.paid ? "Paid" : "Unpaid"}</Badge></TableCell>
                <TableCell>{!f.paid && <Button variant="ghost" size="sm" onClick={() => markPaid.mutate(f.id)}>Mark Paid</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Fine</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Patron Email</Label><Input value={patronEmail} onChange={e => setPatronEmail(e.target.value)} placeholder="patron@example.com" /></div>
            <div><Label>Amount ($)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5.00" /></div>
            <div><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addFine.mutate()} disabled={!patronEmail || !amount || addFine.isPending}>
              {addFine.isPending ? "Adding…" : "Issue Fine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default FineProcessing;
