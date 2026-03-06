import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Headphones, BookOpen, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formats = [
  { icon: FileText, label: "PDF Documents", accept: ".pdf", type: "pdf", color: "text-destructive" },
  { icon: BookOpen, label: "EPUB eBooks", accept: ".epub", type: "epub", color: "text-primary" },
  { icon: Headphones, label: "Audiobooks", accept: ".mp3,.m4b,.m4a", type: "audio", color: "text-accent" },
];

const DigitalUpload = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { data: digitalBooks, isLoading } = useQuery({
    queryKey: ["admin-digital-books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").not("digital_file_url", "is", null).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, fileType }: { file: File; fileType: string }) => {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("digital-library").upload(fileName, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("digital-library").getPublicUrl(fileName);
      
      // Create a book record for this digital file
      const { error } = await supabase.from("books").insert({
        title: file.name.replace(/\.[^.]+$/, ""),
        author: "Unknown",
        category: "Digital",
        digital_file_url: publicUrl,
        digital_file_type: fileType,
        status: "available",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-books"] });
      toast({ title: "File uploaded successfully" });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-books"] });
      toast({ title: "Digital file removed" });
    },
  });

  const handleUpload = (index: number, fileType: string) => {
    const input = fileRefs.current[index];
    if (!input) return;
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) uploadMutation.mutate({ file, fileType });
    };
    input.click();
  };

  return (
    <AdminLayout title="Digital File Uploading" description="Upload PDF, EPUB, and audio files for digital catalog items">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {formats.map((f, i) => (
          <Card key={f.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <f.icon className={`w-4 h-4 ${f.color}`} />
                {f.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Accepted: {f.accept}</p>
              <input ref={el => fileRefs.current[i] = el} type="file" accept={f.accept} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => handleUpload(i, f.type)} disabled={uploadMutation.isPending}>
                <Upload className="w-4 h-4 mr-2" />{uploadMutation.isPending ? "Uploading…" : "Upload Files"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Uploaded Digital Files ({digitalBooks?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : !digitalBooks?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No digital files uploaded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {digitalBooks.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell><Badge variant="secondary">{(b as any).digital_file_type || "unknown"}</Badge></TableCell>
                    <TableCell>{b.author}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(b as any).digital_file_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={(b as any).digital_file_url} target="_blank" rel="noopener">View</a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default DigitalUpload;
