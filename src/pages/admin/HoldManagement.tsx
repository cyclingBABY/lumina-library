import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const HoldManagement = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["admin-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, books(title, author)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").update({ status: "fulfilled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reservations"] });
      toast({ title: "Reservation fulfilled" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reservations"] });
      toast({ title: "Reservation cancelled" });
    },
  });

  return (
    <AdminLayout title="Hold & Reservation Management" description="Manage patron holds, queue positions, and reservation fulfillment">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Reserved On</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : reservations?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No reservations</TableCell></TableRow>
            ) : reservations?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{(r.books as any)?.title || "Unknown"}</TableCell>
                <TableCell>{(r.books as any)?.author || "—"}</TableCell>
                <TableCell className="text-sm">{format(new Date(r.reservation_date), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "active" ? "default" : r.status === "fulfilled" ? "secondary" : "destructive"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status === "active" && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => fulfillMutation.mutate(r.id)}>Fulfill</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelMutation.mutate(r.id)}>Cancel</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default HoldManagement;
