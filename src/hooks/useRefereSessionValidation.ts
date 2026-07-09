import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isFirebaseConfigured } from "@/lib/firebase";

const LOG_SESSION = "[Session:Referee]";

interface UseRefereSessionValidationResult {
  sessionId: string | null;
  isValid: boolean;
  isLoading: boolean;
  error: string | null;
  competitionId: string | null;
}

/**
 * Referee QR flow — NO authentication.
 * The referee scans the QR code and is granted access immediately as long
 * as the link contains a session id and a competition id. No Firebase
 * anonymous sign-in and no server-side session lookup is performed.
 *
 * NOTE: For signals to reach the control station, your Realtime Database
 * rules for `referee_signals/$cid` must allow public read/write (no auth
 * required). Example:
 *   "referee_signals": { "$cid": { ".read": true, ".write": true } }
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

    console.log(LOG_SESSION, "referee station opening (no auth)", {
      urlSessionId,
      cidFromUrl,
      firebaseConfigured: isFirebaseConfigured,
    });

    if (!urlSessionId || !cidFromUrl) {
      setIsValid(false);
      setError("Invalid QR code link. Please rescan the QR code from the admin panel.");
      setIsLoading(false);
      return;
    }

    // No auth, no DB validation — just accept the scan.
    setIsValid(true);
    setError(null);
    setIsLoading(false);
  }, [searchParams]);

  return { sessionId, isValid, isLoading, error, competitionId };
}
