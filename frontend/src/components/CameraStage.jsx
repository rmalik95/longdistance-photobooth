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
      className="relative flex flex-row w-full h-[40vh] sm:h-[70vh] rounded-2xl bg-plum shadow-soft-lg overflow-hidden"
      data-testid="camera-stage"
    >
      <div
        className="relative flex-1 border-r border-plum/20 overflow-hidden"
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
        <span className="absolute top-3 left-3 rounded-full bg-blush/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-plum">
          You
        </span>
        {flash && <div className="absolute inset-0 bg-white camera-flash-effect z-40" data-testid="camera-flash" />}
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-3 bg-blush" data-testid="partner-status-panel">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${showPartnerVideo ? "block" : "hidden"}`}
          data-testid="partner-video"
        />
        {showPartnerVideo && (
          <span className="absolute top-3 left-3 rounded-full bg-blush/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-plum">
            Partner
          </span>
        )}

        {!showPartnerVideo && partnerState === "waiting" && (
          <>
            <UserPlus className="text-rose animate-pulse-soft" size={40} strokeWidth={2.5} />
            <p className="font-body font-medium text-plum text-sm sm:text-base text-center px-4">
              Waiting for your person to arrive…
            </p>
          </>
        )}
        {!showPartnerVideo && partnerState === "connecting" && (
          <>
            <Camera className="text-rose animate-pulse-soft" size={40} strokeWidth={2.5} />
            <p className="font-body font-medium text-plum text-sm sm:text-base text-center px-4">
              They're here! Turning on their camera…
            </p>
          </>
        )}
        {!showPartnerVideo && partnerState === "ready" && phase !== "captured_wait" && (
          <>
            <CheckCircle2 className="text-success" size={40} strokeWidth={2.5} />
            <p className="font-body font-medium text-plum text-sm sm:text-base text-center px-4">
              They're ready when you are
            </p>
          </>
        )}
        {phase === "captured_wait" && (
          <div
            className={
              showPartnerVideo
                ? "absolute inset-x-0 bottom-0 bg-plum/80 py-2 flex items-center justify-center gap-2"
                : "flex flex-col items-center gap-3"
            }
          >
            <Clock className={`${showPartnerVideo ? "text-rose" : "text-rose"} animate-pulse-soft`} size={showPartnerVideo ? 18 : 40} strokeWidth={2.5} />
            <p
              className={`font-body font-medium text-sm sm:text-base text-center px-4 ${
                showPartnerVideo ? "text-blush" : "text-plum"
              }`}
            >
              {waitingForPartnerShot
                ? `Waiting for your partner's photo… (${round}/${totalRounds})`
                : `Got it! Next shot coming up… (${round}/${totalRounds})`}
            </p>
          </div>
        )}
      </div>

      {["both_ready", "countdown", "captured_wait"].includes(phase) && (
        <span className="absolute top-3 right-3 z-30 rounded-full bg-plum/80 text-blush backdrop-blur-sm px-3 py-1 text-xs font-medium">
          Shot {round}/{totalRounds}
        </span>
      )}

      {phase === "countdown" && <CountdownOverlay value={countdownValue} />}
    </div>
  );
}
