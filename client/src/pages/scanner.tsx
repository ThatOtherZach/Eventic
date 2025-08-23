import { QrScanner } from "@/components/scanner/qr-scanner";

export default function Scanner() {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
          <i className="fas fa-qrcode text-white text-2xl"></i>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Ticket Validation</h2>
        <p className="mt-2 text-gray-600">Scan QR codes to validate event tickets</p>
      </div>

      <QrScanner />
    </div>
  );
}
