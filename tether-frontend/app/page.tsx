import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Link2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

const creatorFeatures = [
  "Public @handle profile",
  "Verified YouTube/Instagram metrics",
  "Bio, website, category, creator stage",
  "Link-in-bio tools coming soon",
];

const businessFeatures = [
  "Discover creators",
  "Save creators",
  "Message creators",
  "Verify audience quality before outreach",
];

const productPanels = [
  {
    title: "Public creator profile",
    description: "A shareable profile built around identity, platforms, category, stage, and verified proof.",
    icon: UserRoundCheck,
  },
  {
    title: "Verified metrics block",
    description: "Connected YouTube and Instagram accounts show platform-backed signals without screenshots.",
    icon: ShieldCheck,
  },
  {
    title: "Business discovery",
    description: "Teams can search, evaluate, save, and shortlist creators before starting outreach.",
    icon: Search,
  },
  {
    title: "Messaging and saves",
    description: "Creators and businesses can keep outreach in one workflow instead of scattered DMs.",
    icon: MessageSquare,
  },
];

const features = [
  {
    title: "Verified metrics from platform APIs",
    description: "Creators connect supported platforms so businesses can review real signals without relying on screenshots or inflated claims.",
    icon: ShieldCheck,
  },
  {
    title: "Public profile for brand-safe sharing",
    description: "One profile can show an @handle, full name, bio, website, category, creator stage, connected platforms, videos, and analytics where available.",
    icon: UserRoundCheck,
  },
  {
    title: "Discovery and saved creator workflows",
    description: "Businesses can move from search to shortlist without losing context on who fits the campaign.",
    icon: Bookmark,
  },
  {
    title: "Messaging between both sides",
    description: "Statvora supports creator-business conversations after discovery, so outreach starts with verified context.",
    icon: MessageSquare,
  },
  {
    title: "Pricing path as teams grow",
    description: "Start with the available free path, then move into paid creator or business plans as usage expands.",
    icon: CircleDollarSign,
  },
];

const faqs = [
  {
    question: "Is this a Linktree replacement?",
    answer: "Statvora provides verified creator profiles today. Link-in-bio tools are coming next, with the goal of one public profile for links, proof, and brand discovery.",
  },
  {
    question: "How are metrics verified?",
    answer: "Creators connect supported platforms, and Statvora uses platform API data for verified YouTube and Instagram metrics where available.",
  },
  {
    question: "Who is Statvora for?",
    answer: "Creators use it to share credible public proof. Businesses and agencies use it to discover, save, verify, and contact creators.",
  },
  {
    question: "Do businesses need an account?",
    answer: "Yes. Business discovery, saved creators, and messaging are account-based workflows.",
  },
  {
    question: "Does it support YouTube and Instagram?",
    answer: "Yes. The current product references connected YouTube and Instagram platforms, with verified metrics where the integration has data.",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {children}
    </div>
  );
}

function CtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      : "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-card">
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              @
            </div>
            <div>
              <div className="h-3 w-28 rounded bg-gray-900" />
              <div className="mt-2 h-2 w-20 rounded bg-gray-300" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-gray-200" />
            <div className="h-2.5 w-5/6 rounded bg-gray-200" />
            <div className="h-2.5 w-2/3 rounded bg-gray-200" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {["YouTube", "Instagram"].map((platform) => (
              <div key={platform} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {platform}
                </div>
                <div className="mt-3 h-2 w-20 rounded bg-brand-100" />
                <div className="mt-2 h-2 w-14 rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-brand-200 bg-white p-3 text-xs font-semibold text-brand-700">
            Link-in-bio tools coming next
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-950 p-4 text-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Business discovery</div>
              <div className="mt-1 text-xs text-gray-400">Evaluate creators with verified context</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200">Saved</div>
          </div>
          <div className="space-y-3">
            {["Creator profile", "Platform proof", "Outreach status"].map((label) => (
              <div key={label} className="grid grid-cols-[1fr_0.75fr_0.6fr] items-center gap-3 rounded-lg bg-white/[0.06] p-3">
                <div>
                  <div className="h-2.5 w-24 rounded bg-white/80" />
                  <div className="mt-2 h-2 w-16 rounded bg-white/25" />
                </div>
                <div className="h-2.5 rounded bg-emerald-300/80" />
                <div className="h-7 rounded-lg border border-white/10 bg-white/10" />
                <span className="sr-only">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RootPage() {
  return (
    <main className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Statvora home">
            <img src="/brand/logo-icon.svg" alt="" className="h-8 w-8 rounded-lg bg-brand-600" />
            <span className="text-lg font-bold text-gray-950">Statvora</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#creators" className="text-sm font-semibold text-gray-600 hover:text-gray-950">Creators and Businesses</a>
            <Link href="/pricing" className="text-sm font-semibold text-gray-600 hover:text-gray-950">Pricing</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-950 sm:inline-flex">
              Login
            </Link>
            <Link href="/signup" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              Create profile
            </Link>
          </div>
        </nav>
      </header>

      <section className="overflow-hidden border-b border-gray-100 bg-gradient-to-b from-white via-brand-50/40 to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-24">
          <div>
            <SectionLabel>Verified creator profiles today</SectionLabel>
            <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-normal text-gray-950 sm:text-5xl lg:text-6xl">
              Creator intelligence profiles for the next generation of brand deals
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Creators share verified metrics and businesses discover creators without screenshots,
              inflated numbers, or cold outreach without context.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/signup">
                Create profile
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CtaLink>
              <CtaLink href="#creators" variant="secondary">
                Explore for businesses
              </CtaLink>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 text-sm font-medium text-gray-600 sm:grid-cols-3">
              {["YouTube and Instagram proof", "Creator and business accounts", "Link-in-bio tools coming next"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="creators">
        <div className="max-w-3xl">
          <SectionLabel>Creators and businesses</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-gray-950 sm:text-4xl">
            One public profile for links, proof, and brand discovery
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            Statvora is built for both sides of the deal: creators who need credible proof, and
            businesses that need a cleaner way to evaluate and contact creators.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-gray-950">For creators</h3>
            <p className="mt-3 text-gray-600">
              Build a public @handle profile that brands can trust before the first conversation.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {creatorFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm font-medium text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  {feature}
                </div>
              ))}
            </div>
            <div className="mt-7">
              <CtaLink href="#creators" variant="secondary">View how it works</CtaLink>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-950 p-6 text-white shadow-sm" id="businesses">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white">
              <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-bold">For businesses</h3>
            <p className="mt-3 text-gray-300">
              Find creators, save shortlists, message prospects, and verify quality before outreach.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {businessFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm font-medium text-gray-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {feature}
                </div>
              ))}
            </div>
            <div className="mt-7">
              <CtaLink href="/signup" variant="secondary">Find creators</CtaLink>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionLabel>Product preview</SectionLabel>
              <h2 className="mt-4 text-3xl font-bold text-gray-950 sm:text-4xl">
                Generic workflows, real product direction
              </h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                The homepage preview avoids fake creators or fictional follower counts. It shows the actual
                workflows Statvora is organized around.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {productPanels.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <SectionLabel>Core features</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-gray-950 sm:text-4xl">
            Creator intelligence, not just another bio link
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-700">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-950">Link-in-bio tools coming next</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              The direction is one public profile for links, proof, and discovery. Full multi-link functionality is not positioned as shipped in this version.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-gray-950 py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold text-gray-200">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Pricing path
            </div>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Start free, upgrade when the workflow needs it</h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">
              Statvora supports free entry points and paid plans for creators and businesses. Use the pricing page for current plan details.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <CtaLink href="/pricing" variant="secondary">View pricing</CtaLink>
            <CtaLink href="/signup">Create profile</CtaLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold text-gray-950 sm:text-4xl">Common questions</h2>
        </div>
        <div className="mt-10 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {faqs.map(({ question, answer }) => (
            <div key={question} className="p-5 sm:p-6">
              <h3 className="text-base font-bold text-gray-950">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-brand-600 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-3xl font-bold">Create your verified profile</h2>
          <p className="mx-auto mt-3 max-w-2xl text-brand-50">
            Build a public creator profile with verified proof today, then add stronger link-in-bio tools as Statvora expands.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaLink href="/signup" variant="secondary">Create your verified profile</CtaLink>
            <Link href="/pricing" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              Explore pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
