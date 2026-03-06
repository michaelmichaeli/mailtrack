"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Package, Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CARRIERS = [
  { value: "", label: "Auto-detect" },
  { value: "UPS", label: "UPS" },
  { value: "FEDEX", label: "FedEx" },
  { value: "USPS", label: "USPS" },
  { value: "DHL", label: "DHL" },
  { value: "CAINIAO", label: "Cainiao" },
  { value: "ALIEXPRESS_STANDARD", label: "AliExpress Standard" },
  { value: "ISRAEL_POST", label: "Israel Post" },
  { value: "FOUR_PX", label: "4PX" },
  { value: "YANWEN", label: "Yanwen" },
  { value: "YUNEXPRESS", label: "YunExpress" },
  { value: "ARAMEX", label: "Aramex" },
  { value: "DPD", label: "DPD" },
  { value: "ROYAL_MAIL", label: "Royal Mail" },
  { value: "POSTNL", label: "PostNL" },
  { value: "LA_POSTE", label: "La Poste" },
  { value: "CANADA_POST", label: "Canada Post" },
  { value: "TNT", label: "TNT" },
  { value: "GLS", label: "GLS" },
  { value: "JT_EXPRESS", label: "J&T Express" },
  { value: "SUNYOU", label: "SunYou" },
];

export function AddPackageDialog() {
  const [open, setOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () =>
      api.addPackage({
        trackingNumber,
        carrier: carrier || undefined,
        description: description || undefined,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setOpen(false);
      setTrackingNumber("");
      setCarrier("");
      setDescription("");
      if (data.alreadyExists) {
        toast.info("Package is already being tracked");
      } else {
        toast.success("Package added successfully");
      }
      router.push(`/orders/${data.orderId}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 whitespace-nowrap">
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">Track Package</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-500" />
            Track a Package
          </DialogTitle>
          <DialogDescription>
            Enter a tracking number to start tracking a package from any carrier worldwide.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="tracking-number">
              Tracking Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tracking-number"
              placeholder="e.g. 1Z999AA10123456784"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Select value={carrier || "_auto"} onValueChange={(v) => setCarrier(v === "_auto" ? "" : v)}>
              <SelectTrigger id="carrier">
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c.value || "_auto"} value={c.value || "_auto"}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g. Blue winter jacket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">
              {(mutation.error as Error)?.message ?? "Failed to add package"}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!trackingNumber.trim() || mutation.isPending}
              className="gap-1.5"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              Start Tracking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
