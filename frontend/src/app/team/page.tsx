"use client";

import { Users } from "lucide-react";

import { PracticeScaffold } from "../practice/practice-scaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function TeamPage() {
  return (
    <PracticeScaffold defaultSidebarOpen>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 sm:px-10 lg:px-16">
        <Card className="p-8">
          <CardHeader className="gap-3 p-0">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em]">
              Clubs &amp; Teams
            </CardDescription>
            <CardTitle className="text-4xl tracking-tight sm:text-5xl">
              Join a club or team
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Team features are not wired yet. This page is the placeholder entry point for
              joining or creating a team.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-8 text-sm text-muted-foreground">
            <Users className="size-5 text-muted-foreground" />
            <p>
              Add team browsing and invitations here once the Supabase tables are ready.
            </p>
          </CardContent>
        </Card>
      </div>
    </PracticeScaffold>
  );
}
