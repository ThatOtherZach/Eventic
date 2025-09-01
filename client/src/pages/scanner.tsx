import { QrScannerImplementation } from "@/components/scanner/qr-scanner-implementation";
import validateIcon from "@assets/image_1756750336692.png";

export default function Scanner() {
  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-8 col-lg-6">
        <div className="text-center mb-4">
          <div
            className="bg-success rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
            style={{ width: "64px", height: "64px" }}
          >
            <img src={validateIcon} alt="Validate" style={{ width: "32px", height: "32px" }} />
          </div>
          <h2 className="h3 fw-semibold text-dark mb-2">Validate</h2>
        </div>

        <QrScannerImplementation />
      </div>
    </div>
  );
}
