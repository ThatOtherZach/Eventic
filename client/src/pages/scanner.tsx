import { QrScannerImplementation } from "@/components/scanner/qr-scanner-implementation";
import validateIcon from "@assets/image_1756750482438.png";
import { useSEO, SEO_CONFIG } from "@/hooks/use-seo";

export default function Scanner() {
  // Set page SEO
  useSEO(SEO_CONFIG.scanner);

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-8 col-lg-6">
        <div className="text-center mb-4">
          <div
            className="bg-secondary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
            style={{ width: "64px", height: "64px" }}
          >
            <img src={validateIcon} alt="Validate" style={{ width: "40px", height: "40px" }} />
          </div>
          <h2 className="h3 fw-semibold text-dark mb-2">Validate</h2>
        </div>

        <QrScannerImplementation />
      </div>
    </div>
  );
}
