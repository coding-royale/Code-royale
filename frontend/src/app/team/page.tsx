"use client";

import { Users } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { Badge } from "../../components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function TeamPage() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight">Team Play</h1>
          <Badge variant="secondary">Coming soon</Badge>
        </div>

        <Card className="bg-gradient-to-br from-accent/10 to-transparent">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Duos and squads are on the way</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p className="max-w-2xl leading-relaxed">
              Team battles combine your solves with a partner, share the score, and reward
              synchronized solving. We&apos;re building the 2v2 and club-team queues now.
            </p>
            <p className="max-w-2xl leading-relaxed">
              Until then, sharpen your skills solo and invite friends to a head-to-head.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <LinkButton href="/practice">Practice Solo</LinkButton>
          <LinkButton href="/game-modes" variant="outline">Play a Match</LinkButton>
          <LinkButton href="/clubs" variant="outline">Browse Clubs</LinkButton>
        </div>
      </div>
    </AppShell>
  );
}