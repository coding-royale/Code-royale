import Image from "next/image";

import { HeroCta } from "@/components/hero-cta";

// Hero background. Flickr serves only the 6k original for this photo;
// next/image re-serves it at the viewport's actual width and quality.
const HERO_IMAGE =
  "https://live.staticflickr.com/8497/8308573411_7d12b44e12_6k.jpg";
const HERO_IMAGE_BLUR =
  "data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAQABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQAEBv/EAB8QAAIBBAMBAQAAAAAAAAAAAAEDAgAEESESIkFRE//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDjKTQmbxGKh0jjJPu90cqPJkY/TTdlaPu4cZSCl9SB8wc0GS4StS5hMxPgczHoqpK4tU2ynNA/SbNziToDPlVB/9k=";

export default function Home() {
  return (
    <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-black">
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={HERO_IMAGE_BLUR}
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