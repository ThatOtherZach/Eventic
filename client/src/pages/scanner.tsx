import { QrScannerImplementation } from "@/components/scanner/qr-scanner-implementation";
import { Check, Users } from "lucide-react";
import { useRoute } from "wouter";

export default function Scanner() {
  // Check if this is P2P mode from URL params
  const [match, params] = useRoute("/scanner");
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const eventId = urlParams.get("eventId");
  const isP2PMode = mode === "p2p";

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-8 col-lg-6">
        <div className="text-center mb-4">
          <div
            className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
            style={{ width: "64px", height: "64px" }}
          >
            {isP2PMode ? (
              <Users className="text-white" size={32} />
            ) : (
              <Check className="text-white" size={32} />
            )}
          </div>
          <h2 className="h3 fw-semibold text-dark mb-2">
            {isP2PMode ? "P2P Voting Scanner" : "Validation"}
          </h2>
          {isP2PMode && (
            <p className="text-muted">
              Scan other attendees' tickets to validate and vote for them
            </p>
          )}
        </div>

        <QrScannerImplementation mode={isP2PMode ? "p2p" : "standard"} eventId={eventId} />
      </div>
    </div>
  );
}
