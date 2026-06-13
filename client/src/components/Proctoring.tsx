import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Eye, ShieldAlert, VideoOff } from 'lucide-react';
import { api } from '../lib/api';

export type ActiveMockAttempt = {
  attemptId: string;
  test?: { title: string };
  endsAt?: string;
  webcamEnabled?: boolean;
};

type ViolationResponse = {
  violationCount: number;
  warningsLeft: number;
  autoSubmit: boolean;
  reason?: string | null;
};

type ProctoringOptions = {
  attempt: ActiveMockAttempt | null;
  enabled: boolean;
  onAutoSubmit?: (reason: string) => void | Promise<void>;
};

const blockedShortcutKeys = new Set(['c', 'v', 'x', 'p', 's', 'f']);
const ACTIVE_MOCK_ATTEMPT_KEY = 'activeMockAttempt';
const LATEST_MOCK_RESULT_KEY = 'latestMockResult';

export function getActiveMockAttempt(): ActiveMockAttempt | null {
  const raw = localStorage.getItem(ACTIVE_MOCK_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveMockAttempt;
  } catch {
    return null;
  }
}

function collectDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || null,
    touchPoints: navigator.maxTouchPoints || 0
  };
}

async function submitAttemptForProctoring(attemptId: string, reason: string) {
  const result = await api(`/mock-attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ autoSubmitted: true, cheatingSuspected: true, cheatingReason: reason })
  });
  localStorage.setItem(LATEST_MOCK_RESULT_KEY, JSON.stringify(result));
  localStorage.removeItem(ACTIVE_MOCK_ATTEMPT_KEY);
}

export function useStoredMockAttempt() {
  const [attempt, setAttempt] = useState<ActiveMockAttempt | null>(() => getActiveMockAttempt());

  useEffect(() => {
    const sync = () => setAttempt(getActiveMockAttempt());
    window.addEventListener('storage', sync);
    window.addEventListener('pkh-mock-attempt-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pkh-mock-attempt-updated', sync);
    };
  }, []);

  return attempt;
}

export function useProctoring({ attempt, enabled, onAutoSubmit }: ProctoringOptions) {
  const [warning, setWarning] = useState<{ count: number; message: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const lastEventAt = useRef<Record<string, number>>({});
  const autoSubmittingRef = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);

  const logViolation = useCallback(async (type: string, message: string, webcamStatus = attempt?.webcamEnabled ? 'enabled' : 'not_required') => {
    if (!enabled || !attempt?.attemptId || autoSubmittingRef.current) return;
    const now = Date.now();
    const key = `${type}:${message}`;
    if (now - (lastEventAt.current[key] || 0) < 1800) return;
    lastEventAt.current[key] = now;

    try {
      const response = await api<ViolationResponse>(`/mock-attempts/${attempt.attemptId}/violations`, {
        method: 'POST',
        body: JSON.stringify({ type, message, webcamStatus, deviceInfo: collectDeviceInfo() })
      });

      if (response.autoSubmit) {
        autoSubmittingRef.current = true;
        const reason = response.reason || message;
        setLocked(true);
        if (onAutoSubmitRef.current) {
          await onAutoSubmitRef.current(reason);
        } else {
          await submitAttemptForProctoring(attempt.attemptId, reason);
          window.location.assign('/mock-tests');
        }
        return;
      }

      setWarning({
        count: response.violationCount,
        message: `Warning ${response.violationCount}/2: ${message}`
      });
      window.setTimeout(() => setWarning(null), 4500);
    } catch {
      setWarning({ count: 1, message: 'Could not log proctoring event. Please stay on the test screen.' });
    }
  }, [attempt?.attemptId, attempt?.webcamEnabled, enabled]);

  useEffect(() => {
    if (!enabled || !attempt?.attemptId) return;
    let lastResizeAt = 0;
    let hasSettled = false;
    const settleTimer = window.setTimeout(() => {
      hasSettled = true;
    }, 1200);

    const blockMouse = (event: MouseEvent) => {
      event.preventDefault();
      logViolation('right_click', 'Right-click is disabled during the mock test.');
    };
    const blockClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      logViolation(event.type, `${event.type} is disabled during the mock test.`);
    };
    const blockSelect = (event: Event) => {
      event.preventDefault();
    };
    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const devTools = event.key === 'F12' || ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'i') || (event.metaKey && event.altKey && key === 'i');
      const blocked = devTools || (modifier && blockedShortcutKeys.has(key)) || event.key === 'PrintScreen';
      if (!blocked) return;
      event.preventDefault();
      logViolation('blocked_shortcut', `Shortcut ${event.key} is not allowed during the test.`);
    };
    const onVisibility = () => {
      if (document.hidden) logViolation('tab_switch', 'Please do not switch tabs, minimize, or open another window during the test.');
    };
    const onBlur = () => logViolation('focus_lost', 'Please keep the test window active during the test.');
    const onFullscreen = () => {
      if (!document.fullscreenElement) logViolation('fullscreen_exit', 'Please do not exit full-screen mode during the test.');
    };
    const onResize = () => {
      const now = Date.now();
      if (!hasSettled || now - lastResizeAt < 4000) return;
      lastResizeAt = now;
      logViolation('resize', 'Repeated resizing during the test is marked for review.');
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      logViolation('leaving_page', 'Leaving or refreshing the test page is not allowed.');
      event.preventDefault();
      event.returnValue = '';
    };

    document.body.classList.add('proctoring-active');
    document.addEventListener('contextmenu', blockMouse);
    document.addEventListener('copy', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    document.addEventListener('paste', blockClipboard);
    document.addEventListener('selectstart', blockSelect);
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.clearTimeout(settleTimer);
      document.body.classList.remove('proctoring-active');
      document.removeEventListener('contextmenu', blockMouse);
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      document.removeEventListener('paste', blockClipboard);
      document.removeEventListener('selectstart', blockSelect);
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [attempt?.attemptId, enabled, logViolation]);

  return { warning, locked, logViolation };
}

export function ProctoringWarning({ warning, locked }: { warning: { message: string } | null; locked?: boolean }) {
  if (!warning && !locked) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-md rounded-lg border border-amber-200 bg-white p-5 text-center shadow-panel">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert size={30} />
        </div>
        <div className="mt-3 text-xl font-black text-slate-900">{locked ? 'Auto-submitting test' : 'Proctoring Warning'}</div>
        <p className="mt-2 text-sm font-semibold text-slate-700">{locked ? 'Repeated rule violations were detected. Your test is being submitted for admin review.' : warning?.message}</p>
      </div>
    </div>
  );
}

export function TestDeclaration({
  testTitle,
  accepted,
  webcamEnabled,
  onAcceptedChange,
  onWebcamEnabledChange,
  onStart,
  onCancel,
  loading
}: {
  testTitle: string;
  accepted: boolean;
  webcamEnabled: boolean;
  onAcceptedChange: (value: boolean) => void;
  onWebcamEnabledChange: (value: boolean) => void;
  onStart: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand">
            <Eye size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Test Rules Declaration</h2>
            <p className="mt-1 text-sm text-slate-600">{testTitle} will run in full-screen proctored mode.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
          <div>No mobile phone or second device</div>
          <div>No notes, books, or outside help</div>
          <div>No tab switching or other websites</div>
          <div>No AI tools, screen sharing, or remote assistance</div>
          <div>No copy, paste, print, save, search, or DevTools shortcuts</div>
          <div>Two warnings are allowed; third violation auto-submits</div>
        </div>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Browser proctoring reduces cheating but cannot fully detect hidden phones, physical notes, all virtual machines, or advanced remote access. Suspicious activity is sent to admin for review.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} />
          <span>I confirm that I will not use another website, mobile phone, smartwatch, notes, remote assistance, AI tools, screen sharing, or any unfair means during this test.</span>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={webcamEnabled} onChange={(event) => onWebcamEnabledChange(event.target.checked)} />
          <Camera size={16} />
          Enable webcam monitoring for this attempt
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="btn btn-soft" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" type="button" disabled={!accepted || loading} onClick={onStart}>
            {loading ? 'Starting...' : 'Enter Full Screen & Start'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WebcamMonitor({ enabled, onIssue }: { enabled: boolean; onIssue: (type: string, message: string, webcamStatus?: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onIssueRef = useRef(onIssue);
  const [status, setStatus] = useState(enabled ? 'Starting camera...' : 'Camera off');

  useEffect(() => {
    onIssueRef.current = onIssue;
  }, [onIssue]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('Camera active');
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          setStatus('Camera stopped');
          onIssueRef.current('camera_disabled', 'Camera was disabled during the mock test.', 'disabled');
        });
      })
      .catch(() => {
        setStatus('Camera permission denied');
        onIssueRef.current('camera_denied', 'Camera permission was denied for webcam monitoring.', 'denied');
      });

    const lookCheck = window.setInterval(() => {
      const active = streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live');
      onIssueRef.current('webcam_check', 'Random look-at-camera check during the test.', active ? 'enabled' : 'review_required');
    }, 8 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(lookCheck);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 w-36 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-panel">
      <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
      <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold">
        {status === 'Camera active' ? <Camera size={13} /> : <VideoOff size={13} />}
        {status}
      </div>
    </div>
  );
}
