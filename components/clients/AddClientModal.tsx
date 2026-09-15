"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";

export function AddClientModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameArabic, setNameArabic] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        nameArabic,
        contactPerson,
        contactEmail,
        contactPhone,
      }),
    });
    setSaving(false);
    setName("");
    setNameArabic("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </DialogTrigger>
      <DialogContent title="New client">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Client / company name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Arabic name (اسم العميل)"
            dir="rtl"
            value={nameArabic}
            onChange={(e) => setNameArabic(e.target.value)}
          />
          <Input
            placeholder="Contact person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Input
            placeholder="Contact phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Button type="submit" loading={saving} disabled={!name}>
            Add client
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
