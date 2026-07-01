import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Loader2, WifiOff, AlertTriangle, Home } from "lucide-react";
import { toast } from "sonner";
import PrivacyBanner from "@/components/PrivacyBanner";
import SessionCodeBadge from "@/components/SessionCodeBadge";
import CameraStage from "@/components/CameraStage";
import ResultPanel from "@/components/ResultPanel";
import { fetchSessionStatus } from "@/lib/api";
import { buildWsUrl } from "@/lib/wsUrl";

const btnPrimary =
  "bg-[#E07A5F] text-[#FDFBF7] font-bold border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-8 py-4 uppercase tracking-widest disabled:opacity-60 disabled:pointer-events-none";
const btnSecondary =
  "bg-[#FDFBF7] text-[#1A1A19] font-bold border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-8 py-4 uppercase tracking-widest";

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("checking");
  const [role, setRole] = useState(null);
  const [countdownDuration, setCountdownDuration] = useState(3);
  const [countdownValue, setCountdownValue] = useState(null);
  const [round, setRound] = useState(1);
  const totalRounds = 3;
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerCameraReady, setPartnerCameraReady] = useState(false);
  const [waitingForPartnerShot, setWaitingForPartnerShot] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [flash, setFlash] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchSessionStatus(code);
        if (cancelled) return;
        setCountdownDuration(status.countdown_duration);
        const storedRole = localStorage.getItem(`pb_role_${code}`);
        if (storedRole) {
          setRole(storedRole);
          setPhase("permission");
        } else {
          setPhase("join_prompt");
        }
      } catch (err) {
        if (!cancelled) setPhase("not_found");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const runLocalCountdown = useCallback((duration) => {
    clearInterval(countdownIntervalRef.current);
    let remaining = duration;
    setCountdownValue(remaining);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdownValue(remaining > 0 ? remaining : 0);
      if (remaining <= 0) clearInterval(countdownIntervalRef.current);
    }, 1000);
  }, []);

  const capturePhoto = useCallback((roundNum) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    setCountdownValue(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "photo_captured", round: roundNum, image: dataUrl }));
    }
  }, []);

  const handleServerMessage = useCallback(
    (data, ws) => {
      switch (data.type) {
        case "joined":
          setPartnerConnected(data.partner_connected);
          setPartnerCameraReady(data.partner_camera_ready);
          setCountdownDuration(data.countdown_duration);
          ws.send(JSON.stringify({ type: "camera_ready" }));
          break;
        case "partner_joined":
          setPartnerConnected(true);
          break;
        case "partner_reconnected":
          setPartnerConnected(true);
          setPhase((p) => (p === "abandoned" ? "waiting_partner" : p));
          break;
        case "partner_camera_ready":
          setPartnerCameraReady(true);
          break;
        case "both_ready":
          setWaitingForPartnerShot(false);
          setPhase("both_ready");
          break;
        case "countdown_start":
          setRound(data.round);
          setWaitingForPartnerShot(false);
          setPhase("countdown");
          runLocalCountdown(data.duration);
          break;
        case "capture_now":
          capturePhoto(data.round);
          break;
        case "round_captured":
          setWaitingForPartnerShot(!!data.waiting_for_partner);
          setPhase("captured_wait");
          break;
        case "processing":
          setPhase("processing");
          break;
        case "strip_ready":
          setResultImage(data.image);
          setPhase("result");
          break;
        case "retake_started":
          setResultImage(null);
          setRound(1);
          setWaitingForPartnerShot(false);
          setPhase("both_ready");
          break;
        case "partner_disconnected":
          setPartnerConnected(false);
          setPartnerCameraReady(false);
          setPhase("abandoned");
          break;
        case "session_full":
        case "error":
          setErrorMessage(data.message || "Something went wrong.");
          setPhase("error");
          break;
        default:
          break;
      }
    },
    [runLocalCountdown, capturePhoto]
  );

  const connectWebSocket = useCallback(
    (chosenRole) => {
      const ws = new WebSocket(buildWsUrl(code, chosenRole));
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        handleServerMessage(data, ws);
      };
      ws.onclose = () => {};
    },
    [code, handleServerMessage]
  );

  const enableCameraAndJoin = async (chosenRole) => {
    setEnabling(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      localStorage.setItem(`pb_role_${code}`, chosenRole);
      setRole(chosenRole);
      connectWebSocket(chosenRole);
      setPhase("waiting_partner");
    } catch (err) {
      toast.error("Camera access is required to continue. Please allow camera permissions and try again.");
    } finally {
      setEnabling(false);
    }
  };

  const handleStartCountdown = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_countdown" }));
    }
  };

  const handleRetake = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "retake" }));
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = "together-apart-photostrip.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const cameraLive = ["waiting_partner", "both_ready", "countdown", "captured_wait", "processing", "result", "abandoned"].includes(
    phase
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] px-4 sm:px-10 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            data-testid="back-home-btn"
            className="flex items-center gap-1.5 text-sm font-bold text-[#1A1A19] hover:text-[#E07A5F] transition-colors"
          >
            <Home size={16} /> together, apart
          </button>
          {(role || phase === "join_prompt") && phase !== "not_found" && <SessionCodeBadge code={code} />}
        </div>

        {phase === "checking" && (
          <div className="flex flex-col items-center gap-3 py-24" data-testid="checking-state">
            <Loader2 className="animate-spin text-[#E07A5F]" size={32} />
            <p className="font-body text-[#4A4A48]">Looking for your session…</p>
          </div>
        )}

        {phase === "not_found" && (
          <div className="flex flex-col items-center gap-4 py-24 text-center" data-testid="not-found-state">
            <AlertTriangle className="text-[#E07A5F]" size={36} />
            <h2 className="font-heading text-2xl font-bold text-[#1A1A19]">Session not found</h2>
            <p className="font-body text-[#4A4A48] max-w-sm">
              This link may have expired or the code was typed incorrectly. Sessions only exist while both of you are active.
            </p>
            <button type="button" onClick={() => navigate("/")} className={btnPrimary} data-testid="not-found-home-btn">
              Start a new session
            </button>
          </div>
        )}

        {phase === "join_prompt" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center" data-testid="join-prompt-state">
            <Camera className="text-[#E07A5F]" size={40} />
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#1A1A19]">
              You've been invited to a photobooth <span className="font-accent italic text-[#E07A5F]">moment</span>
            </h2>
            <p className="font-body text-[#4A4A48] max-w-sm">
              Session code <strong>{code}</strong>. Tap below to turn on your camera and join.
            </p>
            <PrivacyBanner compact />
            <button
              type="button"
              onClick={() => enableCameraAndJoin("guest")}
              disabled={enabling}
              data-testid="join-session-confirm-btn"
              className={btnPrimary}
            >
              {enabling ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              {enabling ? "Enabling…" : "Join & enable camera"}
            </button>
          </div>
        )}

        {phase === "permission" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center" data-testid="permission-state">
            <Camera className="text-[#E07A5F]" size={40} />
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#1A1A19]">Enable your camera</h2>
            <p className="font-body text-[#4A4A48] max-w-sm">
              We need camera access to capture your side of the photo strip. Nothing is recorded until the countdown ends.
            </p>
            <PrivacyBanner compact />
            <button
              type="button"
              onClick={() => enableCameraAndJoin(role)}
              disabled={enabling}
              data-testid="enable-camera-btn"
              className={btnPrimary}
            >
              {enabling ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              {enabling ? "Enabling…" : "Enable camera"}
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-24 text-center" data-testid="error-state">
            <AlertTriangle className="text-[#E07A5F]" size={36} />
            <h2 className="font-heading text-2xl font-bold text-[#1A1A19]">Something went wrong</h2>
            <p className="font-body text-[#4A4A48] max-w-sm" data-testid="error-message">
              {errorMessage}
            </p>
            <button type="button" onClick={() => navigate("/")} className={btnPrimary} data-testid="error-home-btn">
              Back home
            </button>
          </div>
        )}

        {cameraLive && phase !== "result" && (
          <div className="flex flex-col gap-5">
            <CameraStage
              videoRef={videoRef}
              phase={phase}
              countdownValue={countdownValue}
              flash={flash}
              round={round}
              totalRounds={totalRounds}
              partnerConnected={partnerConnected}
              partnerCameraReady={partnerCameraReady}
              waitingForPartnerShot={waitingForPartnerShot}
            />

            {phase === "both_ready" && (
              <button type="button" onClick={handleStartCountdown} data-testid="start-countdown-btn" className={btnPrimary}>
                Start countdown ({countdownDuration}s)
              </button>
            )}

            {phase === "processing" && (
              <div className="flex items-center justify-center gap-2 text-[#4A4A48]" data-testid="processing-state">
                <Loader2 className="animate-spin" size={18} /> Merging your photo strip…
              </div>
            )}

            {phase === "abandoned" && (
              <div
                className="flex flex-col items-center gap-3 text-center border-2 border-[#1A1A19] bg-white p-6"
                data-testid="abandoned-state"
              >
                <WifiOff className="text-[#E07A5F]" size={28} />
                <p className="font-body font-semibold text-[#1A1A19]">
                  Your partner got disconnected. Ask them to reopen the link — this session will stay open for a little while.
                </p>
              </div>
            )}

            <PrivacyBanner compact />
          </div>
        )}

        {phase === "result" && resultImage && (
          <ResultPanel image={resultImage} onDownload={handleDownload} onRetake={handleRetake} />
        )}
      </div>
    </div>
  );
}
