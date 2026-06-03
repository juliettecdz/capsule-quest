import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Vault" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ username: string; full_name: string | null } | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("username, full_name").eq("id", user.id).single()
      .then(({ data }) => setProfile(data as any));
  }, [user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur">
        <Link to="/capture"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-lg">Settings</h1>
      </header>
      <div className="space-y-6 p-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Signed in as</div>
          <div className="mt-1 font-display text-lg">@{profile?.username ?? "…"}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>

        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
