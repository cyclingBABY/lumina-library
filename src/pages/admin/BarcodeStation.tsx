import AdminLayout from "@/components/AdminLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanLine, BookOpen, User, CheckCircle2, XCircle, ArrowRight, RotateCcw, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ScanStep = "scan-book" | "scan-patron" | "confirm";

const BarcodeStation = () => {
  const [mode, setMode] = useState<"issue" | "return">("issue");
  const [step, setStep] = useState<ScanStep>("scan-book");
  const [bookBarcode, setBookBarcode] = useState("");
  const [patronBarcode, setPatronBarcode] = useState("");
  const [foundBook, setFoundBook] = useState<any>(null);
  const [foundPatron, setFoundPatron] = useState<any>(null);
  const [foundCopy, setFoundCopy] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [lastActivity, setLastActivity] = useState<any[]>([]);

  const bookInputRef = useRef<HTMLInputElement>(null);
  const patronInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Recent activity
  const { data: recentRecords } = useQuery({
    queryKey: ["barcode-station-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("borrow_records")
        .select("*, books(title, author)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Auto-focus the active input
  useEffect(() => {
    if (step === "scan-book") bookInputRef.current?.focus();
    else if (step === "scan-patron") patronInputRef.current?.focus();
  }, [step, mode]);

  // Refocus on click anywhere (barcode scanners need focus)
  useEffect(() => {
    const handleClick = () => {
      if (step === "scan-book") bookInputRef.current?.focus();
      else if (step === "scan-patron") patronInputRef.current?.focus();
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [step]);

  const playBeep = useCallback((success: boolean) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = success ? 800 : 300;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.15 : 0.4));
    } catch {}
  }, []);

  const lookupBook = async (barcode: string) => {
    if (!barcode.trim()) return;

    // Try matching by barcode field, ISBN, or copy_id
    const trimmed = barcode.trim();

    // First try book barcode/ISBN
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .or(`barcode.eq.${trimmed},isbn.eq.${trimmed}`)
      .maybeSingle();

    if (book) {
      setFoundBook(book);
      // Find an available copy for issuing
      const { data: copy } = await supabase
        .from("book_copies")
        .select("*")
        .eq("book_id", book.id)
        .eq("status", mode === "issue" ? "available" : "borrowed")
        .limit(1)
        .maybeSingle();
      setFoundCopy(copy);
      playBeep(true);

      if (mode === "return") {
        // For returns, go straight to confirm (no patron needed)
        setStep("confirm");
      } else {
        setStep("scan-patron");
      }
      return;
    }

    // Try copy_id
    const { data: copy } = await supabase
      .from("book_copies")
      .select("*")
      .eq("copy_id", trimmed)
      .maybeSingle();

    if (copy) {
      setFoundCopy(copy);
      const { data: bookData } = await supabase
        .from("books")
        .select("*")
        .eq("id", copy.book_id)
        .single();
      setFoundBook(bookData);
      playBeep(true);

      if (mode === "return") {
        setStep("confirm");
      } else {
        setStep("scan-patron");
      }
      return;
    }

    playBeep(false);
    toast({ title: "Book not found", description: `No book matches barcode: ${trimmed}`, variant: "destructive" });
  };

  const lookupPatron = async (barcode: string) => {
    if (!barcode.trim()) return;
    const trimmed = barcode.trim();

    // Match by library_card_number, registration_number, or email
    const { data: patron } = await supabase
      .from("profiles")
      .select("*")
      .or(`library_card_number.eq.${trimmed},registration_number.eq.${trimmed},email.eq.${trimmed}`)
      .maybeSingle();

    if (patron) {
      setFoundPatron(patron);
      playBeep(true);
      setStep("confirm");
      return;
    }

    playBeep(false);
    toast({ title: "Patron not found", description: `No patron matches: ${trimmed}`, variant: "destructive" });
  };

  const issueBook = async () => {
    if (!foundBook || !foundPatron) return;
    setProcessing(true);
    try {
      const copyToUse = foundCopy;

      if (copyToUse) {
        // Use copy-level borrow
        await supabase.from("borrow_records").insert({
          copy_id: copyToUse.id,
          book_id: foundBook.id,
          user_id: foundPatron.user_id,
          status: "borrowed",
        });
        await supabase.from("book_copies").update({ status: "borrowed" }).eq("id", copyToUse.id);
      }

      // Update book available count
      const newAvailable = Math.max(0, foundBook.available_copies - 1);
      await supabase.from("books").update({
        available_copies: newAvailable,
        status: newAvailable <= 0 ? "checked-out" : "available",
      }).eq("id", foundBook.id);

      playBeep(true);
      toast({ title: "✅ Book issued successfully", description: `"${foundBook.title}" → ${foundPatron.full_name || foundPatron.email}` });
      qc.invalidateQueries({ queryKey: ["barcode-station-recent"] });
      resetStation();
    } catch (err: any) {
      playBeep(false);
      toast({ title: "Error issuing book", description: err.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  const returnBook = async () => {
    if (!foundBook) return;
    setProcessing(true);
    try {
      // Find active borrow record
      const copyId = foundCopy?.id;
      let query = supabase
        .from("borrow_records")
        .select("*")
        .eq("book_id", foundBook.id)
        .eq("status", "borrowed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (copyId) {
        query = query.eq("copy_id", copyId);
      }

      const { data: record } = await query.maybeSingle();

      if (!record) throw new Error("No active borrow record found for this book");

      await supabase.from("borrow_records")
        .update({ status: "returned", return_date: new Date().toISOString() })
        .eq("id", record.id);

      if (foundCopy) {
        await supabase.from("book_copies").update({ status: "available" }).eq("id", foundCopy.id);
      }

      await supabase.from("books").update({
        available_copies: foundBook.available_copies + 1,
        status: "available",
      }).eq("id", foundBook.id);

      playBeep(true);
      toast({ title: "✅ Book returned successfully", description: `"${foundBook.title}" checked in` });
      qc.invalidateQueries({ queryKey: ["barcode-station-recent"] });
      resetStation();
    } catch (err: any) {
      playBeep(false);
      toast({ title: "Error returning book", description: err.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  const resetStation = () => {
    setStep("scan-book");
    setBookBarcode("");
    setPatronBarcode("");
    setFoundBook(null);
    setFoundPatron(null);
    setFoundCopy(null);
    setTimeout(() => bookInputRef.current?.focus(), 100);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode as "issue" | "return");
    resetStation();
  };

  return (
    <AdminLayout title="Barcode Scanner Station" description="Scan book barcodes and patron IDs to issue and return books">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Scanner Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="issue" className="text-base py-3">
                <ArrowRight className="w-4 h-4 mr-2" /> Issue Book
              </TabsTrigger>
              <TabsTrigger value="return" className="text-base py-3">
                <RotateCcw className="w-4 h-4 mr-2" /> Return Book
              </TabsTrigger>
            </TabsList>

            <TabsContent value={mode}>
              {/* Step indicators */}
              <div className="flex items-center gap-3 mb-6 mt-4">
                <StepIndicator
                  num={1}
                  label="Scan Book"
                  active={step === "scan-book"}
                  done={step !== "scan-book"}
                />
                {mode === "issue" && (
                  <>
                    <div className="h-px flex-1 bg-border" />
                    <StepIndicator
                      num={2}
                      label="Scan Patron"
                      active={step === "scan-patron"}
                      done={step === "confirm"}
                    />
                  </>
                )}
                <div className="h-px flex-1 bg-border" />
                <StepIndicator
                  num={mode === "issue" ? 3 : 2}
                  label="Confirm"
                  active={step === "confirm"}
                  done={false}
                />
              </div>

              {/* Step 1: Scan Book */}
              {step === "scan-book" && (
                <Card className="border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ScanLine className="w-5 h-5 text-primary" />
                      Scan Book Barcode
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Place cursor in the field below and scan the book's barcode, or type the barcode/ISBN manually.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        ref={bookInputRef}
                        value={bookBarcode}
                        onChange={e => setBookBarcode(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            lookupBook(bookBarcode);
                          }
                        }}
                        placeholder="Scan or type barcode / ISBN…"
                        className="text-lg h-14 font-mono"
                        autoFocus
                        autoComplete="off"
                      />
                      <Button
                        size="lg"
                        className="h-14 px-6"
                        onClick={() => lookupBook(bookBarcode)}
                        disabled={!bookBarcode.trim()}
                      >
                        Look Up
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Scan Patron (Issue mode only) */}
              {step === "scan-patron" && mode === "issue" && (
                <Card className="border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="w-5 h-5 text-primary" />
                      Scan Patron ID
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Scan the patron's library card barcode, registration number, or type their email.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        ref={patronInputRef}
                        value={patronBarcode}
                        onChange={e => setPatronBarcode(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            lookupPatron(patronBarcode);
                          }
                        }}
                        placeholder="Scan patron card / registration # / email…"
                        className="text-lg h-14 font-mono"
                        autoFocus
                        autoComplete="off"
                      />
                      <Button
                        size="lg"
                        className="h-14 px-6"
                        onClick={() => lookupPatron(patronBarcode)}
                        disabled={!patronBarcode.trim()}
                      >
                        Look Up
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Confirm */}
              {step === "confirm" && (
                <Card className="border-2 border-accent/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                      Confirm {mode === "issue" ? "Issue" : "Return"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Book info */}
                    {foundBook && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                        <BookOpen className="w-8 h-8 text-primary mt-1" />
                        <div>
                          <p className="font-semibold text-lg">{foundBook.title}</p>
                          <p className="text-sm text-muted-foreground">{foundBook.author}</p>
                          <div className="flex gap-2 mt-1">
                            {foundBook.isbn && <Badge variant="outline" className="font-mono text-xs">ISBN: {foundBook.isbn}</Badge>}
                            {foundBook.barcode && <Badge variant="outline" className="font-mono text-xs">Barcode: {foundBook.barcode}</Badge>}
                            <Badge variant="secondary">{foundBook.category}</Badge>
                          </div>
                          {foundCopy && (
                            <p className="text-xs text-muted-foreground mt-1">Copy: {foundCopy.copy_id} — Status: {foundCopy.status}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Patron info (issue only) */}
                    {mode === "issue" && foundPatron && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                        <User className="w-8 h-8 text-primary mt-1" />
                        <div>
                          <p className="font-semibold text-lg">{foundPatron.full_name || "Unnamed"}</p>
                          <p className="text-sm text-muted-foreground">{foundPatron.email}</p>
                          <div className="flex gap-2 mt-1">
                            {foundPatron.library_card_number && (
                              <Badge variant="outline" className="font-mono text-xs">{foundPatron.library_card_number}</Badge>
                            )}
                            {foundPatron.registration_number && (
                              <Badge variant="outline" className="font-mono text-xs">Reg: {foundPatron.registration_number}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        size="lg"
                        className="flex-1 h-14 text-base"
                        onClick={mode === "issue" ? issueBook : returnBook}
                        disabled={processing}
                      >
                        {processing ? "Processing…" : mode === "issue" ? "✅ Confirm Issue" : "✅ Confirm Return"}
                      </Button>
                      <Button variant="outline" size="lg" className="h-14" onClick={resetStation}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Found book preview (shown during patron scan step) */}
              {step === "scan-patron" && foundBook && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="font-medium">{foundBook.title}</span>
                  <span className="text-muted-foreground">by {foundBook.author}</span>
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={resetStation}>Change</Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar: Recent Activity */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRecords?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                recentRecords?.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${r.status === "borrowed" ? "bg-primary" : "bg-accent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(r.books as any)?.title || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.status === "borrowed" ? "Issued" : "Returned"} • {format(new Date(r.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <Badge variant={r.status === "borrowed" ? "default" : "secondary"} className="text-xs shrink-0">
                      {r.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Volume2 className="w-4 h-4" />
                Scanner Tips
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Barcode scanner auto-submits on scan</li>
                <li>• Input field stays focused automatically</li>
                <li>• High beep = success, low beep = not found</li>
                <li>• Accepts: barcode, ISBN, copy ID, card #, reg #, email</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

const StepIndicator = ({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) => (
  <div className={`flex items-center gap-2 ${active ? "text-primary" : done ? "text-accent" : "text-muted-foreground"}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
      active ? "border-primary bg-primary text-primary-foreground" :
      done ? "border-accent bg-accent text-accent-foreground" :
      "border-muted-foreground/30"
    }`}>
      {done ? "✓" : num}
    </div>
    <span className="text-sm font-medium hidden sm:inline">{label}</span>
  </div>
);

export default BarcodeStation;
