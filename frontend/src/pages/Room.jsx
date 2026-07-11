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
import { btnPrimary } from "@/lib/ui";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const MAX_CAPTURE_WIDTH = 640;
const MAX_RECONNECT_ATTEMPTS = 6;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("checking");
  const [role, setRole] = useState(null);
  const [countdownDuration, setCountdownDuration] = useState(3);
  const [countdownValue, setCountdownValue] = useState(null);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerCameraReady, setPartnerCameraReady] = useState(false);
  const [waitingForPartnerShot, setWaitingForPartnerShot] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const [filterName, setFilterName] = useState("warm");
  const [frameName, setFrameName] = useState("classic");
  const [applyingFilter, setApplyingFilter] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [flash, setFlash] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [selfDisconnected, setSelfDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [partnerVideoLive, setPartnerVideoLive] = useState(false);

  const videoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const manualCloseRef = useRef(false);
  const terminalErrorRef = useRef(false);
  const connectWebSocketRef = useRef(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const politeRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const restartConnectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchSessionStatus(code);
        if (cancelled) return;
        setCountdownDuration(status.countdown_duration);
        if (status.total_rounds) setTotalRounds(status.total_rounds);
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
      manualCloseRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // The <video> elements unmount whenever CameraStage leaves the tree (e.g.
  // during the result phase) and remount as fresh DOM nodes afterwards, so
  // BOTH streams must be re-attached on every phase change or one half of
  // the stage comes back black after a retake. iOS Safari additionally needs
  // an explicit play() after srcObject is reassigned.
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play?.().catch(() => {});
    }
  }, [phase]);

  // iOS suspends the page when the app is backgrounded: the WebSocket closes
  // and the camera track is often killed outright. On return to foreground,
  // reconnect immediately (instead of waiting out the backoff timer) and
  // re-acquire the camera if its track ended, swapping the new track into
  // the live peer connection.
  useEffect(() => {
    const revive = async () => {
      if (document.visibilityState !== "visible" || !role) return;
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (track && track.readyState === "ended") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play?.().catch(() => {});
          }
          const newTrack = stream.getVideoTracks()[0];
          const sender = pcRef.current?.getSenders?.().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(newTrack);
        } catch {
          // Camera unavailable; the permission flow will surface this.
        }
      }
      const ws = wsRef.current;
      const wsDown = !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;
      if (wsDown && !manualCloseRef.current && !terminalErrorRef.current) {
        reconnectAttemptsRef.current = 0;
        clearTimeout(reconnectTimeoutRef.current);
        connectWebSocketRef.current?.(role);
      }
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("pageshow", revive);
    return () => {
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("pageshow", revive);
    };
  }, [role]);

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
    // Downscale before sending: the strip renders each photo at ~200px wide,
    // and full-resolution frames produce multi-MB WebSocket messages that
    // hosting proxies drop, stranding the partner mid-round.
    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;
    const scale = Math.min(1, MAX_CAPTURE_WIDTH / srcW);
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    const ctx = canvas.getContext("2d");
    // Capture mirrored, matching the on-screen preview exactly (WYSIWYG).
    // Both the self-preview and the partner's live video are displayed
    // mirrored, so capturing mirrored means the final strip is identical to
    // what both people saw while posing -- hearts and paired poses line up.
    // Trade-off: hand-written signs read reversed, as in any mirror.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    setCountdownValue(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "photo_captured", round: roundNum, image: dataUrl }));
    }
  }, []);

  const teardownPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    pendingCandidatesRef.current = [];
    remoteStreamRef.current = null;
    setPartnerVideoLive(false);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const createPeerConnection = useCallback((ws) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "webrtc_ice_candidate", candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
      setPartnerVideoLive(true);
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) setPartnerVideoLive(false);
      if (pc.connectionState === "failed") {
        // Rebuild while the signaling channel is still healthy so both sides
        // re-negotiate instead of staying dark until the next both_ready.
        // Only the host (impolite side) initiates, and only if this pc is
        // still the active one and the socket can carry the new offer.
        if (
          politeRef.current === false &&
          pcRef.current === pc &&
          ws.readyState === WebSocket.OPEN
        ) {
          restartConnectionRef.current?.(ws);
        }
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "webrtc_offer", sdp: pc.localDescription }));
        }
      } catch (err) {
        console.error("negotiation failed", err);
      } finally {
        makingOfferRef.current = false;
      }
    };
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current));
    }
    return pc;
  }, []);

  const ensurePeerConnection = useCallback(
    (ws) => {
      if (pcRef.current && !["failed", "closed"].includes(pcRef.current.connectionState)) {
        return pcRef.current;
      }
      teardownPeerConnection();
      pcRef.current = createPeerConnection(ws);
      return pcRef.current;
    },
    [createPeerConnection, teardownPeerConnection]
  );

  useEffect(() => {
    restartConnectionRef.current = (ws) => {
      teardownPeerConnection();
      ensurePeerConnection(ws);
    };
  }, [ensurePeerConnection, teardownPeerConnection]);

  const flushPendingCandidates = useCallback(async (pc) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!ignoreOfferRef.current) console.warn("addIceCandidate failed", err);
      }
    }
  }, []);

  const handleOffer = useCallback(
    async (sdp, ws) => {
      const pc = ensurePeerConnection(ws);
      const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
      ignoreOfferRef.current = !politeRef.current && offerCollision;
      if (ignoreOfferRef.current) return;
      if (offerCollision) {
        await Promise.all([
          pc.setLocalDescription({ type: "rollback" }),
          pc.setRemoteDescription(new RTCSessionDescription(sdp)),
        ]);
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      await flushPendingCandidates(pc);
      await pc.setLocalDescription();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "webrtc_answer", sdp: pc.localDescription }));
      }
    },
    [ensurePeerConnection, flushPendingCandidates]
  );

  const handleAnswer = useCallback(
    async (sdp) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(pc);
    },
    [flushPendingCandidates]
  );

  const handleRemoteCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (!ignoreOfferRef.current) console.warn("addIceCandidate failed", err);
    }
  }, []);

  const handleServerMessage = useCallback(
    (data, ws) => {
      switch (data.type) {
        case "joined":
          politeRef.current = data.role === "guest";
          setPartnerConnected(data.partner_connected);
          setPartnerCameraReady(data.partner_camera_ready);
          setCountdownDuration(data.countdown_duration);
          if (data.total_rounds) setTotalRounds(data.total_rounds);
          if (data.filter) setFilterName(data.filter);
          if (data.frame) setFrameName(data.frame);
          ws.send(JSON.stringify({ type: "camera_ready" }));
          break;
        case "partner_joined":
          setPartnerConnected(true);
          break;
        case "partner_reconnected":
          setPartnerConnected(true);
          setPhase((p) => (p === "abandoned" ? "waiting_partner" : p));
          teardownPeerConnection(); // clean renegotiation on next both_ready
          break;
        case "partner_camera_ready":
          setPartnerCameraReady(true);
          break;
        case "both_ready":
          setWaitingForPartnerShot(false);
          setPhase("both_ready");
          // Host initiates; addTrack in ensurePeerConnection fires onnegotiationneeded.
          if (role === "host") ensurePeerConnection(ws);
          break;
        case "webrtc_offer":
          handleOffer(data.sdp, ws).catch((err) => console.error("offer handling failed", err));
          break;
        case "webrtc_answer":
          handleAnswer(data.sdp).catch((err) => console.error("answer handling failed", err));
          break;
        case "webrtc_ice_candidate":
          if (data.candidate) handleRemoteCandidate(data.candidate);
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
          if (data.filter) setFilterName(data.filter);
          if (data.frame) setFrameName(data.frame);
          setApplyingFilter(false);
          setPhase("result");
          break;
        case "retake_started":
          setResultImage(null);
          setRound(1);
          setWaitingForPartnerShot(false);
          // The server also broadcasts this as a mid-round resync when a
          // partner rejoins; don't yank a client that hasn't enabled its
          // camera yet out of the permission/join flow.
          setPhase((p) =>
            ["both_ready", "countdown", "captured_wait", "processing", "result"].includes(p)
              ? "both_ready"
              : p
          );
          break;
        case "partner_disconnected":
          setPartnerConnected(false);
          setPartnerCameraReady(false);
          setPhase("abandoned");
          teardownPeerConnection();
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
    [runLocalCountdown, capturePhoto, role, ensurePeerConnection, handleOffer, handleAnswer, handleRemoteCandidate, teardownPeerConnection]
  );

  const scheduleReconnect = useCallback((chosenRole) => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setReconnecting(false);
      setReconnectFailed(true);
      return;
    }
    setReconnecting(true);
    setReconnectFailed(false);
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current, MAX_RECONNECT_DELAY_MS);
    reconnectAttemptsRef.current += 1;
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!manualCloseRef.current) connectWebSocketRef.current?.(chosenRole);
    }, delay);
  }, []);

  const connectWebSocket = useCallback(
    (chosenRole) => {
      manualCloseRef.current = false;
      terminalErrorRef.current = false;
      setSelfDisconnected(false);
      const ws = new WebSocket(buildWsUrl(code, chosenRole));
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setReconnecting(false);
        setReconnectFailed(false);
      };
      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === "error" || data.type === "session_full") {
          // "role already connected" is a transient race with the server
          // still finalizing our own previous disconnect -- keep retrying
          // instead of treating it as fatal.
          const isStaleRoleRace =
            data.type === "error" && typeof data.message === "string" && data.message.includes("already connected");
          if (!isStaleRoleRace) terminalErrorRef.current = true;
        }
        handleServerMessage(data, ws);
      };
      ws.onclose = () => {
        teardownPeerConnection();
        setSelfDisconnected(true);
        setPhase((p) =>
          ["waiting_partner", "both_ready", "countdown", "captured_wait", "processing"].includes(p) ? "abandoned" : p
        );
        if (manualCloseRef.current || terminalErrorRef.current) return;
        scheduleReconnect(chosenRole);
      };
    },
    [code, handleServerMessage, scheduleReconnect, teardownPeerConnection]
  );

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  const handleManualRetryConnection = () => {
    reconnectAttemptsRef.current = 0;
    terminalErrorRef.current = false;
    setReconnectFailed(false);
    clearTimeout(reconnectTimeoutRef.current);
    connectWebSocket(role);
  };

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
      toast.error("We can't take your photo without the camera. Allow access in your browser and try again.");
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

  const handleSetFilter = (f) => {
    if (f === filterName || applyingFilter) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setApplyingFilter(true);
      wsRef.current.send(JSON.stringify({ type: "set_filter", filter: f }));
    }
  };

  const handleSetFrame = (f) => {
    if (f === frameName || applyingFilter) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setApplyingFilter(true);
      wsRef.current.send(JSON.stringify({ type: "set_frame", frame: f }));
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
    <div className="min-h-screen bg-cream px-4 sm:px-10 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            data-testid="back-home-btn"
            className="flex items-center gap-1.5 text-sm font-heading font-black text-ink hover:text-coral transition-colors"
          >
            <Home size={16} /> together<span className="font-accent italic font-medium text-coral">, apart</span>
          </button>
          {(role || phase === "join_prompt") && phase !== "not_found" && <SessionCodeBadge code={code} />}
        </div>

        {phase === "checking" && (
          <div className="flex flex-col items-center gap-3 py-24" data-testid="checking-state">
            <Loader2 className="animate-spin text-coral" size={32} />
            <p className="font-body text-warmgray">Looking for your session…</p>
          </div>
        )}

        {phase === "not_found" && (
          <div className="flex flex-col items-center gap-4 py-24 text-center" data-testid="not-found-state">
            <AlertTriangle className="text-coral" size={36} />
            <h2 className="font-heading text-2xl font-bold text-ink">We couldn't find that session</h2>
            <p className="font-body text-warmgray max-w-sm">
              This link may have expired, or the code might have a typo. Sessions close themselves once you're both done,
              so starting a fresh one takes a few seconds.
            </p>
            <button type="button" onClick={() => navigate("/")} className={btnPrimary} data-testid="not-found-home-btn">
              Start a new session
            </button>
          </div>
        )}

        {phase === "join_prompt" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center" data-testid="join-prompt-state">
            <Camera className="text-coral" size={40} />
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink">
              You've been invited to a photobooth <span className="font-accent italic text-coral">moment</span>
            </h2>
            <p className="font-body text-warmgray max-w-sm">
              Someone saved you a spot in session <strong>{code}</strong>. Turn on your camera when you're ready.
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
            <Camera className="text-coral" size={40} />
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink">Enable your camera</h2>
            <p className="font-body text-warmgray max-w-sm">
              Your camera fills your half of the strip. Nothing is saved or sent anywhere until the countdown finishes a shot.
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
            <AlertTriangle className="text-coral" size={36} />
            <h2 className="font-heading text-2xl font-bold text-ink">Hmm, that didn't work</h2>
            <p className="font-body text-warmgray max-w-sm" data-testid="error-message">
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
              remoteVideoRef={remoteVideoRef}
              partnerVideoLive={partnerVideoLive}
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
              <div className="flex items-center justify-center gap-2 text-warmgray" data-testid="processing-state">
                <Loader2 className="animate-spin" size={18} /> Stitching your two sides together…
              </div>
            )}

            {phase === "abandoned" && (
              <div
                className="flex flex-col items-center gap-3 text-center rounded-2xl bg-white shadow-soft border border-ink/5 p-6"
                data-testid="abandoned-state"
              >
                {selfDisconnected && reconnecting && (
                  <>
                    <Loader2 className="animate-spin text-coral" size={28} />
                    <p className="font-body font-medium text-ink" data-testid="reconnecting-message">
                      Lost you for a second, reconnecting…
                    </p>
                  </>
                )}
                {selfDisconnected && reconnectFailed && (
                  <>
                    <WifiOff className="text-coral" size={28} />
                    <p className="font-body font-medium text-ink">
                      We tried a few times but couldn't get back in. Check your internet and give it another go.
                    </p>
                    <button
                      type="button"
                      onClick={handleManualRetryConnection}
                      data-testid="retry-connection-btn"
                      className={btnPrimary}
                    >
                      Retry connection
                    </button>
                  </>
                )}
                {!selfDisconnected && (
                  <>
                    <WifiOff className="text-coral" size={28} />
                    <p className="font-body font-medium text-ink">
                      Looks like your partner's connection dropped. Sit tight, the moment they reopen the link, you'll
                      pick up right where you left off.
                    </p>
                  </>
                )}
              </div>
            )}

            <PrivacyBanner compact />
          </div>
        )}

        {phase === "result" && resultImage && (
          <ResultPanel
            image={resultImage}
            onDownload={handleDownload}
            onRetake={handleRetake}
            filterName={filterName}
            onChangeFilter={handleSetFilter}
            frameName={frameName}
            onChangeFrame={handleSetFrame}
            applyingFilter={applyingFilter}
          />
        )}
      </div>
    </div>
  );
}
