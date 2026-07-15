import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight, Loader2, ChevronDown, Camera, Link2, Download } from "lucide-react";
import { toast } from "sonner";
import PrivacyBanner from "@/components/PrivacyBanner";
import SampleStrip from "@/components/SampleStrip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { createSession, fetchSessionStatus } from "@/lib/api";
import { btnPrimary, btnSecondary, card, chip, chipTight } from "@/lib/ui";
import sunsetJump from "@/assets/samples/sunset-jump.jpg";
import cameraToss from "@/assets/samples/camera-toss.jpg";
import balloonsWalk from "@/assets/samples/balloons-walk.jpg";

const LAYOUTS = [
  { id: "1x4", label: "1×4", frames: 4, cols: 1 },
  { id: "1x3", label: "1×3", frames: 3, cols: 1 },
  { id: "2x2", label: "2×2", frames: 4, cols: 2 },
  { id: "1x2", label: "1×2", frames: 2, cols: 1 },
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

// Accepts a bare code or a pasted room link and returns the code.
function normalizeCode(input) {
  const linkMatch = input.match(/\/room\/([A-Za-z0-9]+)/);
  const raw = linkMatch ? linkMatch[1] : input;
  return raw.trim().toUpperCase().slice(0, 8);
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
    <div className="min-h-screen bg-blush px-6 sm:px-12 pb-10 sm:pb-14">
      <header className="sticky top-0 z-50 -mx-6 sm:-mx-12 px-6 sm:px-12 py-3 bg-blush/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <p className="font-heading font-black text-xl text-plum">
            together<span className="font-accent italic font-medium text-rose">, apart</span>
          </p>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden sm:inline-flex items-center rounded-full bg-rose/10 text-rose text-xs font-bold px-3 py-1 uppercase tracking-wide">
              100% free
            </span>
            <a
              href="#how-it-works"
              className="hidden md:block text-sm font-medium text-plumgray hover:text-plum transition-colors"
            >
              How it works
            </a>
            <button
              type="button"
              onClick={handleStartSession}
              disabled={creating}
              data-testid="nav-start-session-btn"
              className="rounded-full bg-rose text-blush font-heading font-bold text-sm px-5 py-2 shadow-soft hover:bg-rose-dark transition-all disabled:opacity-60"
            >
              Start a booth
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-center mt-10 sm:mt-16">
        <div className="lg:col-span-3 flex flex-col gap-8">
          <span className="inline-flex items-center gap-2 self-start text-xs font-medium text-plum rounded-full bg-rose/10 px-4 py-1.5">
            <Heart size={14} strokeWidth={2.5} className="text-rose" /> for couples, friends &amp; family, apart
          </span>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none font-black text-plum">
            Take a photo, <span className="font-accent italic font-medium text-rose">together</span>.
            <br />
            From wherever you are.
          </h1>

          <p className="font-body text-base sm:text-lg text-plumgray max-w-xl">
            Start a session, send the link to whoever you want in the shot, and count down together
            to the same moment, captured live and merged into one photo strip.
          </p>

          <p className="font-body text-sm text-plumgray/80 max-w-xl">
            Built for long-distance couples, friends, and family in different time zones or on the
            other side of the world. Really, all you need is two people with two phones.
          </p>

          <PrivacyBanner />

          <div className="grid sm:grid-cols-2 gap-6 mt-2">
            <div className={`${card} p-6 sm:p-8 flex flex-col gap-4`} data-testid="start-session-card">
              <button
                type="button"
                onClick={handleStartSession}
                disabled={creating}
                data-testid="start-session-btn"
                className={`${btnPrimary} text-lg w-full`}
              >
                {creating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                {creating ? "Creating…" : "Start a session"}
              </button>
              <p className="text-xs text-plumgray/80 text-center font-body">
                ✓ Free forever&nbsp;&nbsp;✓ No signup&nbsp;&nbsp;✓ No watermark
              </p>

              <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
                <CollapsibleTrigger className="flex items-center justify-center gap-1.5 w-full text-sm font-medium text-plumgray hover:text-plum transition-colors">
                  Customize your strip
                  <ChevronDown size={16} className={`transition-transform ${customizeOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-4 pt-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-plumgray">Countdown</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDuration(3)} data-testid="countdown-3-option" className={`flex-1 ${chip(duration === 3)}`}>
                        3 sec
                      </button>
                      <button type="button" onClick={() => setDuration(5)} data-testid="countdown-5-option" className={`flex-1 ${chip(duration === 5)}`}>
                        5 sec
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-plumgray">Strip</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                              <span key={i} className={`block w-4 h-[5px] rounded-[1px] ${layout === opt.id ? "bg-blush" : "bg-plum/60"}`} />
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

            <div className={`${card} p-6 sm:p-8 flex flex-col gap-4`} data-testid="join-session-card">
              <h3 className="font-heading text-xl font-semibold text-plum">Have a code?</h3>
              <form onSubmit={handleJoinSession} className="flex flex-col gap-3 flex-1">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. K7X2M"
                  data-testid="join-code-input"
                  className="bg-blush/60 border border-plum/10 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent placeholder:font-normal placeholder:text-plumgray/50 tracking-widest uppercase"
                />
                <p className="text-xs text-plumgray/80 font-body">You can paste the whole link too.</p>
                <button type="submit" disabled={joining} data-testid="join-session-btn" className={`${btnSecondary} mt-auto`}>
                  {joining ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                  {joining ? "Joining…" : "Join session"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-center">
          <div className="relative h-[420px] sm:h-[500px] w-[300px] sm:w-[360px] select-none">
            <div
              className="absolute -top-8 -right-2 sm:-right-6 z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-sun shadow-soft-lg rotate-[8deg] flex flex-col items-center justify-center text-plum"
              data-testid="free-sticker"
            >
              <span className="font-heading font-black text-4xl sm:text-5xl leading-none">$0</span>
              <span className="font-heading font-bold text-[10px] sm:text-xs tracking-widest uppercase mt-1">Free forever</span>
            </div>
            <div className="pointer-events-none">
              <SampleStrip src={cameraToss} rotate={4} caption="" className="absolute right-0 top-14" />
              <SampleStrip src={sunsetJump} rotate={-6} caption="date night!" className="absolute left-0 top-0" />
              <SampleStrip src={balloonsWalk} rotate={3} caption="miss you!" className="absolute left-8 sm:left-16 bottom-0" />
            </div>
          </div>
        </div>
      </div>

      <div id="how-it-works" className="max-w-6xl mx-auto mt-20 sm:mt-28 scroll-mt-20">
        <h2 className="font-heading text-2xl sm:text-3xl font-black text-plum text-center">
          How it <span className="font-accent italic font-medium text-rose">works</span>
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mt-8">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className={`${card} p-6 flex flex-col gap-3 items-center text-center`}>
              <span className="font-accent italic text-rose text-3xl leading-none">{i + 1}</span>
              <step.icon size={22} className="text-plumgray" strokeWidth={2} />
              <h3 className="font-heading font-bold text-plum">{step.title}</h3>
              <p className="font-body text-sm text-plumgray">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-16 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleStartSession}
          disabled={creating}
          data-testid="footer-start-session-btn"
          className={`${btnPrimary} text-lg`}
        >
          {creating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          {creating ? "Creating…" : "Start a booth, it's $0"}
        </button>
      </div>

      <p className="text-center text-xs text-plumgray mt-10 font-body">
        Works on Chrome &amp; Safari, laptop or phone. Agree on a time with the other person, then jump in.
      </p>
    </div>
  );
}
