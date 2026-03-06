import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

interface ParsedBook {
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  publisher?: string;
  publish_year?: number;
  shelf_location?: string;
  copies: number;
}

const BulkImport = () => {
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet);

      const books: ParsedBook[] = json.map(row => ({
        title: String(row.title || row.Title || "").trim(),
        author: String(row.author || row.Author || "").trim(),
        isbn: String(row.isbn || row.ISBN || "").trim() || undefined,
        category: String(row.category || row.Category || "General").trim(),
        publisher: String(row.publisher || row.Publisher || "").trim() || undefined,
        publish_year: Number(row.publish_year || row["Publish Year"] || row.year || row.Year) || undefined,
        shelf_location: String(row.shelf_location || row["Shelf Location"] || row.location || "").trim() || undefined,
        copies: Number(row.copies || row.Copies || row.total_copies || 1),
      })).filter(b => b.title && b.author);

      setParsedBooks(books);
      setResults(null);
      toast({ title: `Parsed ${books.length} books from Excel` });
    };
    reader.readAsBinaryString(file);
  };

  const generateQR = async (copyId: string): Promise<string> => {
    return QRCode.toDataURL(copyId, { width: 200, margin: 1 });
  };

  const importBooks = async () => {
    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsedBooks.length; i++) {
      const book = parsedBooks[i];
      try {
        // Insert book
        const { data: bookData, error: bookErr } = await supabase.from("books").insert({
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          category: book.category || "General",
          publish_year: book.publish_year || null,
          shelf_location: book.shelf_location || null,
          total_copies: book.copies,
          available_copies: book.copies,
          status: "available",
          description: book.publisher ? `Publisher: ${book.publisher}` : null,
        } as any).select("id").single();

        if (bookErr) throw bookErr;

        // Create individual copies
        for (let c = 1; c <= book.copies; c++) {
          const copyId = `${bookData.id.slice(0, 8)}-C${String(c).padStart(3, "0")}`;
          const qrDataUrl = await generateQR(copyId);

          await supabase.from("book_copies" as any).insert({
            book_id: bookData.id,
            copy_number: c,
            copy_id: copyId,
            qr_code_url: qrDataUrl,
            status: "available",
          });
        }

        success++;
      } catch (err) {
        console.error("Failed to import:", book.title, err);
        failed++;
      }

      setProgress(Math.round(((i + 1) / parsedBooks.length) * 100));
    }

    setResults({ success, failed });
    setImporting(false);
    toast({ title: `Import complete: ${success} succeeded, ${failed} failed` });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0-7432-7356-5", category: "Fiction", publisher: "Scribner", publish_year: 1925, shelf_location: "A-01-03", copies: 3 },
      { title: "1984", author: "George Orwell", isbn: "978-0-451-52493-5", category: "Sci-Fi", publisher: "Secker & Warburg", publish_year: 1949, shelf_location: "B-02-01", copies: 2 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Books");
    XLSX.writeFile(wb, "book_import_template.xlsx");
  };

  return (
    <AdminLayout title="Bulk Import (Excel)" description="Upload an Excel file to bulk-import books and auto-generate QR codes for each copy">
      <div className="grid gap-6">
        {/* Upload area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Upload Excel File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <Upload className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Upload an Excel file (.xlsx, .xls) with columns: title, author, isbn, category, publisher, publish_year, shelf_location, copies</p>
              <div className="flex gap-3">
                <label>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                  <Button asChild variant="default"><span><Upload className="w-4 h-4 mr-2" />Choose File</span></Button>
                </label>
                <Button variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="w-4 h-4 mr-2" />Download Template</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview parsed data */}
        {parsedBooks.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview ({parsedBooks.length} books)</CardTitle>
              <Button onClick={importBooks} disabled={importing}>
                {importing ? "Importing…" : `Import ${parsedBooks.length} Books`}
              </Button>
            </CardHeader>
            <CardContent>
              {importing && (
                <div className="mb-4">
                  <Progress value={progress} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-1">{progress}% — Creating books and QR codes…</p>
                </div>
              )}
              {results && (
                <div className="flex gap-4 mb-4">
                  <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />{results.success} imported</Badge>
                  {results.failed > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{results.failed} failed</Badge>}
                </div>
              )}
              <div className="rounded-lg border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>ISBN</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Copies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedBooks.map((b, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{b.title}</TableCell>
                        <TableCell>{b.author}</TableCell>
                        <TableCell className="font-mono text-xs">{b.isbn || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
                        <TableCell>{b.publish_year || "—"}</TableCell>
                        <TableCell>{b.shelf_location || "—"}</TableCell>
                        <TableCell>{b.copies}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default BulkImport;
