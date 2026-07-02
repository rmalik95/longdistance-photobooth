import { UserPlus, Camera, CheckCircle2, Clock } from "lucide-react";
import CountdownOverlay from "./CountdownOverlay";

export default function CameraStage({
  videoRef,
  remoteVideoRef,
  partnerVideoLive,
  phase,
  countdownValue,
  flash,
  round,
  totalRounds,
  partnerConnected,
  partnerCameraReady,
  waitingForPartnerShot,
}) {
  let partnerState = "waiting";
  if (partnerConnected && partnerCameraReady) partnerState = "ready";
  else if (partnerConnected) partnerState = "connecting";

  const showPartnerVideo = partnerVideoLive && (partnerState === "ready" || phase === "captured_wait");

  return (
    <div
      className="relative flex flex-col sm:flex-row w-full h-[52vh] sm:h-[70vh] border-2 border-[#1A1A19] bg-[#1A1A19] overflow-hidden"
      data-testid="camera-stage"
    >
      <div
        className="relative flex-1 border-b-2 sm:border-b-0 sm:border-r-2 border-[#1A1A19] overflow-hidden"
        data-testid="camera-video-container"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          data-testid="camera-video"
        />
        <span className="absolute top-3 left-3 bg-[#FDFBF7] border-2 border-[#1A1A19] px-3 py-1 text-xs font-heading font-bold uppercase tracking-wider">
          You
        </span>
        {flash && <div className="absolute inset-0 bg-white camera-flash-effect z-40" data-testid="camera-flash" />}
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-3 bg-[#FDFBF7]" data-testid="partner-status-panel">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${showPartnerVideo ? "block" : "hidden"}`}
          data-testid="partner-video"
        />
        {showPartnerVideo && (
          <span className="absolute top-3 left-3 bg-[#FDFBF7] border-2 border-[#1A1A19] px-3 py-1 text-xs font-heading font-bold uppercase tracking-wider">
            Partner
          </span>
        )}

        {!showPartnerVideo && partnerState === "waiting" && (
          <>
            <UserPlus className="text-[#F2CC8F] animate-pulse-soft" size={40} strokeWidth={2.5} />
            <p className="font-body font-semibold text-[#1A1A19] text-sm sm:text-base text-center px-4">
              Waiting for your partner to join…
            </p>
          </>
        )}
        {!showPartnerVideo && partnerState === "connecting" && (
          <>
            <Camera className="text-[#F2CC8F] animate-pulse-soft" size={40} strokeWidth={2.5} />
            <p className="font-body font-semibold text-[#1A1A19] text-sm sm:text-base text-center px-4">
              Partner connected, turning on their camera…
            </p>
          </>
        )}
        {!showPartnerVideo && partnerState === "ready" && phase !== "captured_wait" && (
          <>
            <CheckCircle2 className="text-[#81B29A]" size={40} strokeWidth={2.5} />
            <p className="font-body font-semibold text-[#1A1A19] text-sm sm:text-base text-center px-4">
              Your partner is ready
            </p>
          </>
        )}
        {phase === "captured_wait" && (
          <div
            className={
              showPartnerVideo
                ? "absolute inset-x-0 bottom-0 bg-[#1A1A19]/80 py-2 flex items-center justify-center gap-2"
                : "flex flex-col items-center gap-3"
            }
          >
            <Clock className={`${showPartnerVideo ? "text-[#F2CC8F]" : "text-[#E07A5F]"} animate-pulse-soft`} size={showPartnerVideo ? 18 : 40} strokeWidth={2.5} />
            <p
              className={`font-body font-semibold text-sm sm:text-base text-center px-4 ${
                showPartnerVideo ? "text-[#FDFBF7]" : "text-[#1A1A19]"
              }`}
            >
              {waitingForPartnerShot
                ? `Waiting for your partner's photo… (${round}/${totalRounds})`
                : `Got it! Next shot coming up… (${round}/${totalRounds})`}
            </p>
          </div>
        )}
      </div>

      {phase === "countdown" && <CountdownOverlay value={countdownValue} />}
    </div>
  );
}
