import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { isFirebaseConfigured, firebaseDb } from "@/lib/firebase";

const LOG_SESSION = "[Session:Referee]";

interface UseRefereSessionValidationResult {
  sessionId: string | null;
  isValid: boolean;
  isLoading: boolean;
  error: string | null;
  competitionId: string | null;
}

/**
 * Referee QR flow — NO authentication, but the session ID from the QR link is
 * validated against the Realtime Database in real time. If the admin ends the
 * session, the session node is removed or marked inactive and this hook
 * immediately reports the session as invalid, causing the referee page to show
 * the "Session expired" screen and stop tracking presence.
 */
export function useRefereSessionValidation(): UseRefereSessionValidationResult {
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState<string | null>(null);

  useEffect(() => {
    const urlSessionId = searchParams.get("session") || searchParams.get("sid");
    const cidFromUrl = searchParams.get("cid") || searchParams.get("competition_id");
    setSessionId(urlSessionId);
    setCompetitionId(cidFromUrl);

    console.log(LOG_SESSION, "referee station opening", {
      urlSessionId,
      cidFromUrl,
      firebaseConfigured: isFirebaseConfigured,
    });

    if (!isFirebaseConfigured || !firebaseDb) {
      setIsValid(false);
      setError("Firebase is not configured. Referee sessions are unavailable.");
      setIsLoading(false);
      return;
    }

    if (!urlSessionId || !cidFromUrl) {
      setIsValid(false);
      setError("Invalid QR code link. Please rescan the QR code from the admin panel.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const sessionRef = ref(firebaseDb, `referee_sessions/${cidFromUrl}/${urlSessionId}`);
    const unsubscribe = onValue(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setIsValid(false);
          setError("Session ended or was deleted. Please rescan the QR code.");
          setIsLoading(false);
          return;
        }
        const data = snap.val() as { is_active?: boolean; expires_at?: string };
        if (!data.is_active) {
          setIsValid(false);
          setError("Session ended. Please rescan the QR code.");
          setIsLoading(false);
          return;
        }
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        if (expiresAt && Date.now() > expiresAt.getTime()) {
          setIsValid(false);
          setError("Session expired. Please rescan the QR code.");
          setIsLoading(false);
          return;
        }
        setIsValid(true);
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error(LOG_SESSION, "session validation failed", err);
        setIsValid(false);
        setError("Could not verify session. Please check your connection.");
        setIsLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [searchParams]);

  return { sessionId, isValid, isLoading, error, competitionId };
}
