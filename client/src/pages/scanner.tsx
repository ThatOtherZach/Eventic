import { QrScanner } from "@/components/scanner/qr-scanner";
import { QrCode } from "lucide-react";

export default function Scanner() {
  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-8 col-lg-6">
        <div className="text-center mb-4">
          <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '64px', height: '64px'}}>
            <QrCode className="text-white" size={32} />
          </div>
          <h2 className="h3 fw-semibold text-dark mb-2">Ticket Validation</h2>
          <p className="text-muted mb-0">Scan QR codes to validate event tickets</p>
        </div>

        <QrScanner />
      </div>
    </div>
  );
}
