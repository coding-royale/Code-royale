import Image from "next/image";

import { HeroCta } from "@/components/hero-cta";
import heroImage from "@/assets/hero.jpg";

export default function Home() {
  return (
    <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-black">
      <Image
        src={heroImage}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        className="object-cover object-left"
      />
      {/* Scrim: keeps the left text zone readable over any part of the image */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <div className="relative px-4 py-10 sm:px-6">
        <div className="max-w-md text-left">
          <h1 className="font-heading text-5xl font-semibold tracking-tight text-white md:text-6xl">
            Think fast.
            <span className="block text-white/70">Code faster.</span>
          </h1>
          <p className="mt-4 text-lg text-white/70 md:text-xl">
            Multiplayer game where you program to kill.
          </p>
          <div className="mt-10">
            <HeroCta />
          </div>
        </div>
      </div>
    </section>
  );
}