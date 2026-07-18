import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ChevronDown, Camera, Link2, Download, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import PrivacyBanner from "@/components/PrivacyBanner";
import SampleStrip from "@/components/SampleStrip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { createSession, fetchSessionStatus } from "@/lib/api";
import { btnPrimary, btnSecondary, chip, chipTight } from "@/lib/ui";
import sunsetJump from "@/assets/samples/sunset-jump.jpg";
import cameraToss from "@/assets/samples/camera-toss.jpg";
import balloonsWalk from "@/assets/samples/balloons-walk.jpg";

const LAYOUTS = [
  { id: "1x4", label: "1×4", frames: 4, cols: 1 },
  { id: "1x3", label: "1×3", frames: 3, cols: 1 },
  { id: "2x2", label: "2×2", frames: 4, cols: 2 },
];
const HOW_IT_WORKS = [
  {
    icon: Link2,
    title: "Start & share",
    body: "Start a session and send the link to the person you miss.",
  },
  {
    icon: Camera,
    title: "Count down together",
    body: "Both cameras on - the countdown snaps you both at the same moment.",
  },
  {
    icon: Download,
    title: "Keep your strip",
    body: "Your two halves are stitched into one photo strip, ready to download.",
  },
];
const MARQUEE_ITEMS = ["Two phones", "One moment", "No storage", "$0 forever", "Anywhere on Earth"];

// Accepts a bare code or a pasted room link and returns the code.
function normalizeCode(input) {
  const linkMatch = input.match(/\/room\/([A-Za-z0-9]+)/);
  const raw = linkMatch ? linkMatch[1] : input;
  return raw.trim().toUpperCase().slice(0, 8);
}

// One run of marquee items. The track renders it twice so the -50%
// translate loops seamlessly; the duplicate is hidden from assistive tech.
function MarqueeRun({ duplicate = false }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={duplicate || undefined}>
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="mx-6 font-mono text-xs uppercase tracking-[0.2em] text-inksoft">{item}</span>
          <span className="text-signal" aria-hidden="true">✳</span>
        </span>
      ))}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(3);
  const [layout, setLayout] = useState("1x4");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const handleStartSession = async () => {
    setCreating(true);
    try {
      // Frame is chosen on the result page now; sessions start with the default.
      const { code } = await createSession({ countdownDuration: duration, layout, frame: "classic" });
      localStorage.setItem(`pb_role_${code}`, "host");
      navigate(`/room/${code}`);
    } catch (err) {
      toast.error("Couldn't start a session just now. Give it another try.");
      setCreating(false);
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    const code = normalizeCode(joinCode);
    if (!code) return;
    setJoining(true);
    try {
      await fetchSessionStatus(code);
      localStorage.setItem(`pb_role_${code}`, "guest");
      navigate(`/room/${code}`);
    } catch (err) {
      toast.error("That code didn't match a session. Check for typos - or ask them to resend the link.");
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-4 flex items-center justify-between gap-4">
          <p className="font-display text-xl text-ink">
            together<span className="text-signal">, apart</span>
          </p>
          <div className="flex items-center gap-5 sm:gap-8">
            <a
              href="#how-it-works"
              className="hidden sm:block font-mono text-xs uppercase tracking-[0.15em] text-inksoft hover:text-ink transition-colors"
            >
              How it works
            </a>
            <span className="hidden md:block font-mono text-xs uppercase tracking-[0.15em] text-signal">
              $0 forever
            </span>
            <button
              type="button"
              onClick={handleStartSession}
              disabled={creating}
              data-testid="nav-start-session-btn"
              className={`${btnPrimary} !px-5 !py-2`}
            >
              Start a booth
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 sm:px-12 pt-14 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 flex flex-col gap-7">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-inksoft">
            <span className="text-signal" aria-hidden="true">✳</span> A photobooth for two people, wherever they are
          </p>

          <h1 className="font-display text-ink text-5xl sm:text-6xl lg:text-7xl leading-[0.95]">
            Take a photo,{" "}
            <span className="relative inline-block">
              together
              <svg
                className="pointer-events-none absolute -inset-x-3 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)]"
                viewBox="0 0 220 90"
                preserveAspectRatio="none"
                fill="none"
                aria-hidden="true"
              >
                <ellipse
                  cx="110"
                  cy="45"
                  rx="103"
                  ry="37"
                  className="stroke-signal"
                  strokeWidth="3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  transform="rotate(-2 110 45)"
                />
              </svg>
            </span>
            .
            <br />
            From anywhere.
          </h1>

          <p className="font-body text-inksoft text-base sm:text-lg max-w-xl">
            Start a session, send the link to whoever you want in the shot, and count down together
            to the same moment, captured live and merged into one photo strip.
          </p>

          <p className="font-body text-sm text-inksoft/80 max-w-xl">
            Built for long-distance couples, friends, and family in different time zones or on the
            other side of the world. Really, all you need is two people with two phones.
          </p>

          <PrivacyBanner />
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative h-[420px] sm:h-[500px] w-[300px] sm:w-[360px] select-none">
            <div
              className="absolute -top-8 -right-2 sm:-right-6 z-10 h-24 w-24 sm:h-28 sm:w-28 rotate-[8deg]"
              data-testid="free-sticker"
            >
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-stamp">
                <svg className="absolute inset-0 h-full w-full animate-spin-slow" viewBox="0 0 100 100" aria-hidden="true">
                  <defs>
                    <path
                      id="free-stamp-circle"
                      d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                      fill="none"
                    />
                  </defs>
                  <text className="fill-ink font-mono" style={{ fontSize: "7.5px", letterSpacing: "0.8px" }}>
                    <textPath href="#free-stamp-circle">FREE FOREVER • NO SIGNUP • NO WATERMARK •&#160;</textPath>
                  </text>
                </svg>
                <span className="font-display text-2xl sm:text-3xl text-ink">$0</span>
              </div>
            </div>
            <div className="pointer-events-none">
              <SampleStrip src={cameraToss} rotate={4} caption="" className="absolute right-0 top-10" />
              <SampleStrip src={sunsetJump} rotate={-6} caption="date night!" className="absolute left-0 top-0" />
              <SampleStrip src={balloonsWalk} rotate={3} caption="miss you!" className="absolute left-8 sm:left-16 top-[168px] sm:top-[200px]" />
            </div>
          </div>
        </div>
      </section>

      <div className="border-y border-ink/10 bg-paperdeep overflow-hidden py-3">
        <div className="flex w-max animate-marquee whitespace-nowrap">
          <MarqueeRun />
          <MarqueeRun duplicate />
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-inksoft">01 — Start or join</p>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink mt-4">Start one. Join one.</h2>

        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-ink/10 mt-10 sm:mt-14">
          <div className="flex flex-col gap-6 lg:pr-12" data-testid="start-session-card">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-inksoft">New booth</p>
            <h3 className="font-display text-2xl sm:text-3xl text-ink">Start a booth</h3>
            <button
              type="button"
              onClick={handleStartSession}
              disabled={creating}
              data-testid="start-session-btn"
              className={`${btnPrimary} self-start`}
            >
              {creating ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              {creating ? "Creating…" : "Start a session"}
            </button>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-inksoft">
              Free forever · No signup · No watermark
            </p>

            <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
              <CollapsibleTrigger className="inline-flex items-center gap-2 self-start rounded-full border border-ink/30 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink hover:border-ink hover:bg-ink hover:text-paper transition-colors cursor-pointer">
                <SlidersHorizontal size={14} />
                Customize your strip
                <ChevronDown size={14} className={`transition-transform ${customizeOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-inksoft">Countdown</span>
                  <div className="flex gap-2 sm:max-w-xs">
                    <button type="button" onClick={() => setDuration(3)} data-testid="countdown-3-option" className={`flex-1 ${chip(duration === 3)}`}>
                      3 sec
                    </button>
                    <button type="button" onClick={() => setDuration(5)} data-testid="countdown-5-option" className={`flex-1 ${chip(duration === 5)}`}>
                      5 sec
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-inksoft">Strip</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:max-w-md">
                    {LAYOUTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLayout(opt.id)}
                        data-testid={`layout-option-${opt.id}`}
                        className={`flex-col gap-1.5 ${chipTight(layout === opt.id)}`}
                      >
                        <span className={`grid gap-[2px] ${opt.cols === 2 ? "grid-cols-2" : "grid-cols-1"}`} aria-hidden>
                          {Array.from({ length: opt.frames }).map((_, i) => (
                            <span key={i} className={`block w-4 h-[5px] rounded-[1px] ${layout === opt.id ? "bg-paper" : "bg-ink/40"}`} />
                          ))}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div
            className="flex flex-col gap-6 border-t border-ink/10 mt-10 pt-10 lg:border-t-0 lg:mt-0 lg:pt-0 lg:pl-12"
            data-testid="join-session-card"
          >
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-inksoft">Have a code?</p>
            <h3 className="font-display text-2xl sm:text-3xl text-ink">Join their booth</h3>
            <form onSubmit={handleJoinSession} className="flex flex-col gap-4">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. K7X2M"
                data-testid="join-code-input"
                className="w-full bg-transparent border-b border-ink/30 focus:border-signal focus:outline-none font-mono uppercase tracking-[0.3em] text-xl py-3 placeholder:text-inksoft/50 placeholder:tracking-normal transition-colors"
              />
              <p className="font-body text-xs text-inksoft">You can paste the whole link too.</p>
              <button type="submit" disabled={joining} data-testid="join-session-btn" className={`${btnSecondary} self-start`}>
                {joining ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {joining ? "Joining…" : "Join session"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-ink/10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-inksoft">02 — How it works</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink mt-4">Three steps, one moment.</h2>

          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-12 mt-12 sm:mt-16">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="border-t border-ink/15 pt-6 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-3xl leading-none text-signal">0{i + 1}</span>
                  <step.icon size={24} className="text-ink" strokeWidth={2} />
                </div>
                <h3 className="font-display text-xl text-ink">{step.title}</h3>
                <p className="font-body text-sm text-inksoft">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-20 sm:py-28 flex flex-col items-center gap-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl text-ink">Ready when you are.</h2>
          <button
            type="button"
            onClick={handleStartSession}
            disabled={creating}
            data-testid="footer-start-session-btn"
            className={`${btnPrimary} text-base`}
          >
            {creating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
            {creating ? "Creating…" : "Start a booth — it's $0"}
          </button>
        </div>
      </section>

      <footer className="border-t border-ink/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.15em] text-inksoft">
          <p className="max-w-md normal-case tracking-[0.05em]">
            Works on Chrome &amp; Safari, laptop or phone. Agree on a time with the other person, then jump in.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-signal">$0 — free forever</span>
            <span>No storage, ever</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
