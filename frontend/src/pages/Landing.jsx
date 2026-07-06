import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PrivacyBanner from "@/components/PrivacyBanner";
import { createSession, fetchSessionStatus } from "@/lib/api";

const LAYOUTS = [
  { id: "1x4", label: "1×4", frames: 4, cols: 1 },
  { id: "1x3", label: "1×3", frames: 3, cols: 1 },
  { id: "2x2", label: "2×2", frames: 4, cols: 2 },
  { id: "1x2", label: "1×2", frames: 2, cols: 1 },
];
const FRAMES = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "film", label: "Film" },
  { id: "polaroid", label: "Polaroid" },
];
const FILTERS = [
  { id: "warm", label: "Warm" },
  { id: "none", label: "Natural" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cool", label: "Cool" },
];

const btnPrimary =
  "bg-[#E07A5F] text-[#FDFBF7] font-bold border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-8 py-4 uppercase tracking-widest disabled:opacity-60 disabled:pointer-events-none";
const btnSecondary =
  "bg-[#FDFBF7] text-[#1A1A19] font-bold border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-6 py-3 uppercase tracking-widest disabled:opacity-60 disabled:pointer-events-none";

export default function Landing() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(3);
  const [layout, setLayout] = useState("1x3");
  const [frame, setFrame] = useState("classic");
  const [filter, setFilter] = useState("warm");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleStartSession = async () => {
    setCreating(true);
    try {
      const { code } = await createSession({ countdownDuration: duration, layout, frame, filter });
      localStorage.setItem(`pb_role_${code}`, "host");
      navigate(`/room/${code}`);
    } catch (err) {
      toast.error("Could not start a session. Please try again.");
      setCreating(false);
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      await fetchSessionStatus(code);
      localStorage.setItem(`pb_role_${code}`, "guest");
      navigate(`/room/${code}`);
    } catch (err) {
      toast.error("We couldn't find that session code. Double check it and try again.");
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] px-6 sm:px-12 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-3 flex flex-col gap-8">
          <span className="inline-flex items-center gap-2 self-start text-xs tracking-[0.2em] uppercase font-bold text-[#1A1A19] border-2 border-[#1A1A19] px-3 py-1.5 bg-[#F2CC8F]/40">
            <Heart size={14} strokeWidth={3} /> for couples, friends & family, apart
          </span>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none font-black text-[#1A1A19]">
            Take a photo, <span className="font-accent italic font-medium text-[#E07A5F]">together</span>.
            <br />
            From wherever you are.
          </h1>

          <p className="font-body text-base sm:text-lg text-[#4A4A48] max-w-xl">
            Start a session, send the link to whoever you want in the shot, and count down together
            to the same moment, captured live and merged into one photo strip.
          </p>

          <p className="font-body text-sm text-[#4A4A48]/80 max-w-xl">
            Built for long-distance couples, friends, and family in different time zones or on the
            other side of the world. Really, all you need is two people with two phones.
          </p>

          <PrivacyBanner />

          <div className="grid sm:grid-cols-2 gap-6 mt-2">
            <div
              className="bg-white border-2 border-[#1A1A19] shadow-[6px_6px_0px_0px_rgba(26,26,25,1)] p-6 sm:p-8 flex flex-col gap-5"
              data-testid="start-session-card"
            >
              <h3 className="font-heading text-xl font-semibold text-[#1A1A19]">Start a session</h3>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Countdown</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration(3)}
                    data-testid="countdown-3-option"
                    className={`flex-1 border-2 border-[#1A1A19] py-2 font-bold text-sm transition-colors ${
                      duration === 3 ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
                    }`}
                  >
                    3 sec
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(5)}
                    data-testid="countdown-5-option"
                    className={`flex-1 border-2 border-[#1A1A19] py-2 font-bold text-sm transition-colors ${
                      duration === 5 ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
                    }`}
                  >
                    5 sec
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Strip</span>
                <div className="grid grid-cols-4 gap-2">
                  {LAYOUTS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayout(opt.id)}
                      data-testid={`layout-option-${opt.id}`}
                      className={`flex flex-col items-center gap-1.5 border-2 border-[#1A1A19] py-2 font-bold text-xs transition-colors ${
                        layout === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
                      }`}
                    >
                      <span className={`grid gap-[2px] ${opt.cols === 2 ? "grid-cols-2" : "grid-cols-1"}`} aria-hidden>
                        {Array.from({ length: opt.frames }).map((_, i) => (
                          <span key={i} className={`block w-4 h-[5px] ${layout === opt.id ? "bg-[#FDFBF7]" : "bg-[#1A1A19]"}`} />
                        ))}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Frame</span>
                <div className="grid grid-cols-4 gap-2">
                  {FRAMES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFrame(opt.id)}
                      data-testid={`frame-option-${opt.id}`}
                      className={`border-2 border-[#1A1A19] py-2 font-bold text-xs transition-colors ${
                        frame === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Filter</span>
                <div className="grid grid-cols-5 gap-2">
                  {FILTERS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilter(opt.id)}
                      data-testid={`filter-option-${opt.id}`}
                      className={`border-2 border-[#1A1A19] py-2 font-bold text-[11px] transition-colors ${
                        filter === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={handleStartSession} disabled={creating} data-testid="start-session-btn" className={btnPrimary}>
                {creating ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {creating ? "Creating…" : "Start a session"}
              </button>
            </div>

            <div
              className="bg-white border-2 border-[#1A1A19] shadow-[6px_6px_0px_0px_rgba(26,26,25,1)] p-6 sm:p-8 flex flex-col gap-5"
              data-testid="join-session-card"
            >
              <h3 className="font-heading text-xl font-semibold text-[#1A1A19]">Have a code?</h3>
              <form onSubmit={handleJoinSession} className="flex flex-col gap-4 flex-1">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter session code"
                  maxLength={8}
                  data-testid="join-code-input"
                  className="bg-white border-2 border-[#1A1A19] rounded-none px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#E07A5F] placeholder:font-normal placeholder:text-[#4A4A48]/50 tracking-widest uppercase"
                />
                <button type="submit" disabled={joining} data-testid="join-session-btn" className={btnSecondary}>
                  {joining ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                  {joining ? "Joining…" : "Join session"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-center">
          <div className="relative -rotate-3 bg-white border-2 border-[#1A1A19] shadow-[8px_8px_0px_0px_rgba(26,26,25,1)] p-4 max-w-[220px] sm:max-w-xs">
            <img
              src="https://images.unsplash.com/photo-1617643081052-214d322dc22d?crop=entropy&cs=srgb&fm=jpg&q=85"
              alt="Photo strip moment shared from two places"
              className="w-full h-52 sm:h-72 object-cover"
            />
            <p className="font-accent italic text-center text-lg mt-3 text-[#1A1A19]">together, apart</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#4A4A48] mt-16 font-body">
        Works on Chrome &amp; Safari, laptop or phone. Agree on a time with the other person, then jump in.
      </p>
    </div>
  );
}
