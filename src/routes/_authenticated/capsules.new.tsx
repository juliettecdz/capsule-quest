import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/capsules/new")({
  head: () => ({ meta: [{ title: "New capsule — Vault" }] }),
  component: NewCapsulePage,
});

function NewCapsulePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"standard" | "transformation" | "individual">("standard");
  const [unlockDate, setUnlockDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 16);
  });
  const [maxUploads, setMaxUploads] = useState(50);
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["user-search", memberSearch],
    queryFn: async () => {
      if (memberSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${memberSearch}%`)
        .neq("id", user.id)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  function addMember(m: { id: string; username: string }) {
    if (members.find((x) => x.id === m.id)) return;
    setMembers([...members, m]);
    setMemberSearch("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const unlockISO = new Date(unlockDate).toISOString();
      if (new Date(unlockISO) <= new Date()) throw new Error("Unlock date must be in the future");

      const { data: capsule, error } = await supabase
        .from("capsules")
        .insert({
          title: title.trim(), type, admin_id: user.id,
          unlock_at: unlockISO, max_uploads: maxUploads,
        })
        .select()
        .single();
      if (error) throw error;

      // Add admin + members
      const memberRows = [
        { capsule_id: capsule.id, user_id: user.id },
        ...members.map((m) => ({ capsule_id: capsule.id, user_id: m.id })),
      ];
      const { error: mErr } = await supabase.from("capsule_members").insert(memberRows);
      if (mErr) throw mErr;

      toast.success("Capsule created");
      navigate({ to: "/capsules/$id", params: { id: capsule.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-[100svh] bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur">
        <Link to="/capsules"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-lg">New capsule</h1>
      </header>

      <form onSubmit={submit} className="space-y-6 p-5">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mariana's wedding" required />
        </div>

        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard — single event</SelectItem>
              <SelectItem value="transformation">Transformation — before / after</SelectItem>
              <SelectItem value="individual">Individual — 1-on-1 vault</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Unlock date & time</Label>
          <Input type="datetime-local" value={unlockDate} onChange={(e) => setUnlockDate(e.target.value)} required />
          <p className="mt-1 text-xs text-muted-foreground">⚠ Once saved, this cannot be changed by anyone — not even you.</p>
        </div>

        <div>
          <Label>Max uploads per person</Label>
          <Input type="number" min={1} max={500} value={maxUploads} onChange={(e) => setMaxUploads(Number(e.target.value))} />
        </div>

        <div>
          <Label>Invite friends</Label>
          <div className="relative">
            <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search by username…" />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {results.map((r) => (
                  <button type="button" key={r.id} onClick={() => addMember(r)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                    <UserPlus className="h-4 w-4 text-muted-foreground" /> @{r.username}
                  </button>
                ))}
              </div>
            )}
          </div>
          {members.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs">
                  @{m.username}
                  <button type="button" onClick={() => setMembers(members.filter((x) => x.id !== m.id))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="w-full bg-amber text-amber-foreground hover:bg-amber/90">
          {submitting ? "Creating…" : "Create capsule"}
        </Button>
      </form>
    </div>
  );
}
