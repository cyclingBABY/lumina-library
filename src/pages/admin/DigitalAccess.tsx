import AdminLayout from "@/components/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Key, Users, MonitorSmartphone } from "lucide-react";

const DigitalAccess = () => {
  const { data: digitalBooks } = useQuery({
    queryKey: ["admin-digital-access"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("*").not("digital_file_url", "is", null);
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-count"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id");
      return data || [];
    },
  });

  const stats = [
    { icon: Key, label: "Digital Titles", value: String(digitalBooks?.length || 0), color: "text-primary" },
    { icon: Users, label: "Registered Users", value: String(profiles?.length || 0), color: "text-accent" },
    { icon: MonitorSmartphone, label: "File Types", value: String(new Set(digitalBooks?.map((b: any) => b.digital_file_type).filter(Boolean)).size), color: "text-info" },
    { icon: Shield, label: "Unrestricted", value: String(digitalBooks?.length || 0), color: "text-success" },
  ];

  return (
    <AdminLayout title="Digital Access / License Control" description="Manage digital content licenses and access">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><s.icon className={`w-4 h-4 ${s.color}`} />{s.label}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-display font-semibold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!digitalBooks?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No digital content available. Upload files in Digital Upload.</TableCell></TableRow>
            ) : digitalBooks.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell><Badge variant="secondary">{b.digital_file_type || "unknown"}</Badge></TableCell>
                <TableCell>{b.author}</TableCell>
                <TableCell><Badge variant="default">Open Access</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default DigitalAccess;
