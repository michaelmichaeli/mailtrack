"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Loader2, Package, Check, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ScanResult {
  trackingNumber: string;
  carrier: string;
  alreadyTracked: boolean;
  packageId: string | null;
  adding?: boolean;
  added?: boolean;
}

interface ScanSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanSmsDialog({ open, onOpenChange }: ScanSmsDialogProps) {
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const queryClient = useQueryClient();

  const handleScan = async () => {
    if (!text.trim()) return;
    setScanning(true);
    setResults(null);
    try {
      const res = await api.scanText(text);
      setResults(res.found);
      if (res.total === 0) {
        toast.info("No tracking numbers found in the text");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to scan text");
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async (index: number) => {
    const item = results![index];
    setResults((prev) =>
      prev!.map((r, i) => (i === index ? { ...r, adding: true } : r))
    );
    try {
      await api.addPackage({
        trackingNumber: item.trackingNumber,
        carrier: item.carrier,
        description: `Scanned from messages`,
      });
      setResults((prev) =>
        prev!.map((r, i) =>
          i === index ? { ...r, adding: false, added: true, alreadyTracked: true } : r
        )
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success(`Now tracking ${item.trackingNumber}`);
    } catch (err: any) {
      setResults((prev) =>
        prev!.map((r, i) => (i === index ? { ...r, adding: false } : r))
      );
      toast.error(err?.message ?? "Failed to add package");
    }
  };

  const handleAddAll = async () => {
    if (!results) return;
    const newOnes = results
      .map((r, i) => ({ ...r, index: i }))
      .filter((r) => !r.alreadyTracked && !r.added);
    for (const item of newOnes) {
      await handleAdd(item.index);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setText("");
      setResults(null);
    }
    onOpenChange(open);
  };

  const newCount = results?.filter((r) => !r.alreadyTracked && !r.added).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Scan Messages for Tracking
          </DialogTitle>
          <DialogDescription>
            Paste SMS messages, WhatsApp texts, or any text containing tracking numbers.
            We&apos;ll find and extract them automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder={"Paste your messages here…\n\nExample:\nYour package has shipped! Track it: LP00123456789012\nIsrael Post: RR123456789IL"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (results) setResults(null);
            }}
            className="min-h-[140px] font-mono text-xs"
            autoFocus
          />

          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Found {results.length} tracking number{results.length !== 1 ? "s" : ""}:
              </p>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {results.map((r, i) => (
                  <div
                    key={r.trackingNumber}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{r.trackingNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.carrier === "UNKNOWN" ? "Unknown carrier" : r.carrier.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    {r.alreadyTracked || r.added ? (
                      <Badge variant="outline" className="shrink-0 gap-1 text-green-600 border-green-200 dark:border-green-800">
                        <Check className="h-3 w-3" />
                        {r.added ? "Added" : "Tracked"}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1 h-7 text-xs"
                        onClick={() => handleAdd(i)}
                        disabled={r.adding}
                      >
                        {r.adding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Track
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No tracking numbers found. Try pasting more text or a different message.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {results && newCount > 0 && (
            <Button variant="default" onClick={handleAddAll} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Track All ({newCount})
            </Button>
          )}
          <Button
            onClick={handleScan}
            disabled={!text.trim() || scanning}
            className="gap-1.5"
            variant={results ? "outline" : "default"}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            {results ? "Re-scan" : "Scan Text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
