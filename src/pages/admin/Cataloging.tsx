import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, ImagePlus } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const emptyBook = { title: "", author: "", isbn: "", category: "General", publish_year: "", total_copies: 1, available_copies: 1, description: "", cover_color: "hsl(210 60% 50%)", status: "available" };

const categories = ["General", "Fiction", "Science", "History", "Philosophy", "Psychology", "Sci-Fi", "Fantasy", "Biography", "Technology", "Art", "Reference"];

const Cataloging = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyBook);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadCover = async (bookId: string, file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${bookId}.${ext}`;
    const { error } = await supabase.storage.from("book-covers").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async (book: any) => {
      const payload: any = {
        title: book.title,
        author: book.author,
        isbn: book.isbn || null,
        category: book.category,
        publish_year: book.publish_year ? Number(book.publish_year) : null,
        total_copies: Number(book.total_copies),
        available_copies: Number(book.available_copies),
        description: book.description || null,
        cover_color: book.cover_color,
        status: book.status,
      };

      let bookId: string;
      if (editingBook) {
        bookId = editingBook.id;
        const { error } = await supabase.from("books").update(payload).eq("id", bookId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("books").insert(payload).select("id").single();
        if (error) throw error;
        bookId = data.id;
      }

      if (coverFile) {
        const url = await uploadCover(bookId, coverFile);
        await supabase.from("books").update({ cover_image_url: url } as any).eq("id", bookId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      toast({ title: editingBook ? "Book updated" : "Book added" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      toast({ title: "Book deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditingBook(null); setForm(emptyBook); setCoverFile(null); setCoverPreview(null); setDialogOpen(true); };
  const openEdit = (book: any) => {
    setEditingBook(book);
    setForm({ ...book, publish_year: book.publish_year || "" });
    setCoverFile(null);
    setCoverPreview((book as any).cover_image_url || null);
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingBook(null); setCoverFile(null); setCoverPreview(null); };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const filtered = books?.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    (b.isbn && b.isbn.includes(search))
  );

  return (
    <AdminLayout title="Cataloging / Metadata Entry" description="Manage book records, ISBN, authors, and categories">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by title, author, ISBN…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Book</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cover</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Copies</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No books found</TableCell></TableRow>
            ) : filtered?.map(book => (
              <TableRow key={book.id}>
                <TableCell>
                  {(book as any).cover_image_url ? (
                    <img src={(book as any).cover_image_url} alt={book.title} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 rounded flex items-center justify-center text-xs text-muted-foreground" style={{ background: book.cover_color || "hsl(210 60% 50%)" }}>
                      📖
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell>{book.author}</TableCell>
                <TableCell className="font-mono text-xs">{book.isbn || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{book.category}</Badge></TableCell>
                <TableCell>{book.publish_year || "—"}</TableCell>
                <TableCell>{book.available_copies}/{book.total_copies}</TableCell>
                <TableCell><Badge variant={book.status === "available" ? "default" : "destructive"}>{book.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(book)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(book.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBook ? "Edit Book" : "Add New Book"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Cover image upload */}
            <div>
              <Label>Book Cover Photo</Label>
              <div className="flex items-center gap-4 mt-2">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="w-20 h-28 object-cover rounded border" />
                ) : (
                  <div className="w-20 h-28 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted">
                    <ImagePlus className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="w-4 h-4 mr-2" />{coverPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                  <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Author *</Label><Input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>ISBN</Label><Input value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} placeholder="978-..." /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Publish Year</Label><Input type="number" value={form.publish_year} onChange={e => setForm({ ...form, publish_year: e.target.value })} /></div>
              <div><Label>Total Copies</Label><Input type="number" min={1} value={form.total_copies} onChange={e => setForm({ ...form, total_copies: e.target.value })} /></div>
              <div><Label>Available</Label><Input type="number" min={0} value={form.available_copies} onChange={e => setForm({ ...form, available_copies: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="checked-out">Checked Out</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cover Color</Label><Input type="color" value={form.cover_color?.replace(/hsl\(([^)]+)\)/, '#666') || '#666666'} onChange={e => setForm({ ...form, cover_color: e.target.value })} className="h-10" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || !form.author || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editingBook ? "Update" : "Add Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Cataloging;
