import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, FileText, CheckCircle, Copy, ExternalLink, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { Ticket, Event, RegistryRecord } from "@shared/schema";

interface CreateRegistryButtonProps {
  ticket: Ticket;
  event: Event;
}

interface RegistryStatus {
  canCreateRegistry: boolean;
  registryExists: boolean;
  needsValidation?: boolean;
  validatedAt?: string;
  timeRemaining?: number;
  timeRemainingHours?: number;
  registryRecord?: RegistryRecord;
}

export function CreateRegistryButton({ ticket, event }: CreateRegistryButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalMetadata, setAdditionalMetadata] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [withRoyalty, setWithRoyalty] = useState(true);
  const [registryUrls, setRegistryUrls] = useState<{
    registryUrl: string;
    metadataUrl: string;
  } | null>(null);
  
  const { toast } = useToast();
  const { addNotification } = useNotifications();

  const { data: registryStatus, isLoading, refetch } = useQuery<RegistryStatus>({
    queryKey: [`/api/tickets/${ticket.id}/registry-status`],
    refetchInterval: 60000,
  });

  const { data: registryEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/registry/enabled'],
  });

  useEffect(() => {
    if (!registryStatus || registryStatus.canCreateRegistry || registryStatus.registryExists || registryStatus.needsValidation) {
      setTimeLeft("");
      return;
    }

    const updateCountdown = () => {
      if (registryStatus.timeRemaining) {
        const totalSeconds = Math.floor(registryStatus.timeRemaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }

        if (totalSeconds <= 0) {
          refetch();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [registryStatus, refetch]);

  const createRegistryMutation = useMutation({
    mutationFn: async () => {
      const metadata: any = {
        imageUrl: event.imageUrl || '',
        mediaType: 'image/png'
      };
      
      if (additionalMetadata) {
        try {
          Object.assign(metadata, JSON.parse(additionalMetadata));
        } catch (e) {
          metadata.notes = additionalMetadata;
        }
      }

      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/create-registry`, {
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata),
        withRoyalty: withRoyalty
      });
      return response.json();
    },
    onSuccess: (data) => {
      setRegistryUrls({
        registryUrl: data.registryUrl,
        metadataUrl: data.metadataUrl
      });
      setShowInstructions(true);
      
      addNotification({
        type: "success",
        title: "Registry Entry Created!",
        description: `Your registry entry has been created. You can now mint your own NFT using the metadata URL.`,
      });

      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/registry-status`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/registry"] });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Creation Failed",
        description: error.message || "Failed to create registry entry",
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  // Don't show button if registry is disabled or ticket hasn't been validated
  if (!registryEnabled?.enabled || !ticket.isValidated || !registryStatus || registryStatus.needsValidation) {
    return null;
  }

  // Show already created state
  if (registryStatus.registryExists) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-100"
        data-testid="button-registry-exists"
      >
        <CheckCircle className="me-2" size={16} />
        Registry Entry Created
      </Button>
    );
  }

  // Show countdown timer if not ready yet
  if (!registryStatus.canCreateRegistry && timeLeft) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-100"
        data-testid="button-registry-countdown"
      >
        <Clock className="me-2" size={16} />
        Create Registry in {timeLeft}
      </Button>
    );
  }

  // Show create button when ready
  if (registryStatus.canCreateRegistry) {
    return (
      <>
        <Button
          variant="default"
          onClick={() => setShowModal(true)}
          className="w-100"
          data-testid="button-create-registry"
        >
          <FileText className="me-2" size={16} />
          Create NFT Registry Entry
        </Button>

        <Modal open={showModal} onOpenChange={setShowModal}>
          <ModalHeader onClose={() => setShowModal(false)}>
            {showInstructions ? "Registry Entry Created!" : "Create NFT Registry Entry"}
          </ModalHeader>
          <ModalBody>
            {!showInstructions ? (
              <>
                <div className="alert alert-info mb-3" role="alert">
                  <Info className="inline h-4 w-4 mr-2" />
                  <strong>How it works:</strong><br/>
                  • Pay {withRoyalty ? '12' : '15'} tickets to create a permanent registry entry<br/>
                  • Get a metadata URL you can use to mint your own NFT<br/>
                  • You control where and how you mint your NFT<br/>
                  • Compatible with any NFT platform (OpenSea, Zora, etc.)
                </div>

                <div className="mb-3">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="royaltyCheckbox"
                      checked={withRoyalty}
                      onChange={(e) => setWithRoyalty(e.target.checked)}
                      data-testid="checkbox-royalty"
                    />
                    <label className="form-check-label" htmlFor="royaltyCheckbox">
                      Include royalty preference (2.69% on resales)
                    </label>
                  </div>
                  <small className="text-muted">
                    {withRoyalty 
                      ? "Standard pricing (12 tickets): Suggests 2.69% royalty for resales"
                      : "No royalty pricing (15 tickets): No royalty suggestion"}
                  </small>
                </div>

                <div className="mb-3">
                  <label className="form-label">NFT Title (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., VIP Concert Experience #001"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-registry-title"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Description (optional)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Describe what makes this ticket special..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="input-registry-description"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Additional Metadata (optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="JSON format or plain text notes"
                    value={additionalMetadata}
                    onChange={(e) => setAdditionalMetadata(e.target.value)}
                    data-testid="input-registry-metadata"
                  />
                  <small className="text-muted">
                    Add any extra information you want to include
                  </small>
                </div>
              </>
            ) : (
              <>
                <div className="alert alert-success mb-3" role="alert">
                  <CheckCircle className="inline h-4 w-4 mr-2" />
                  Your registry entry has been created successfully!
                </div>

                {registryUrls && (
                  <>
                    <div className="mb-4">
                      <label className="form-label font-weight-bold">Registry Page</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={registryUrls.registryUrl}
                          readOnly
                          data-testid="input-registry-url"
                        />
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(registryUrls.registryUrl, "Registry URL")}
                          className="btn-sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <a
                          href={registryUrls.registryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-primary btn-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="form-label font-weight-bold">Metadata URL (for NFT minting)</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={registryUrls.metadataUrl}
                          readOnly
                          data-testid="input-metadata-url"
                        />
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(registryUrls.metadataUrl, "Metadata URL")}
                          className="btn-sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded p-3 bg-light">
                      <h6 className="mb-3">How to Mint Your NFT</h6>
                      
                      <div className="mb-3">
                        <strong>Option 1: OpenZeppelin Wizard</strong>
                        <ol className="small mt-2">
                          <li>Visit <a href="https://wizard.openzeppelin.com/#erc721" target="_blank" rel="noopener noreferrer">OpenZeppelin Wizard</a></li>
                          <li>Configure your NFT contract</li>
                          <li>In the mint function, set tokenURI to the metadata URL above</li>
                          <li>Deploy to any blockchain (Ethereum, Base, Polygon, etc.)</li>
                        </ol>
                      </div>

                      <div className="mb-3">
                        <strong>Option 2: No-Code Platforms</strong>
                        <ul className="small mt-2">
                          <li><a href="https://zora.co" target="_blank" rel="noopener noreferrer">Zora</a> - Create NFTs with custom metadata</li>
                          <li><a href="https://manifold.xyz" target="_blank" rel="noopener noreferrer">Manifold</a> - Professional NFT creation tools</li>
                          <li><a href="https://thirdweb.com" target="_blank" rel="noopener noreferrer">Thirdweb</a> - Easy NFT deployment</li>
                        </ul>
                        <p className="small text-muted">When creating, use the metadata URL as your token URI</p>
                      </div>

                      <div>
                        <strong>Option 3: Custom Contract</strong>
                        <p className="small mt-2">
                          Deploy your own ERC-721 contract and set the tokenURI to the metadata URL.
                          The metadata follows OpenSea's standard format.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!showInstructions ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => createRegistryMutation.mutate()}
                  disabled={createRegistryMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createRegistryMutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileText className="me-2" size={16} />
                      Create Registry ({withRoyalty ? '12' : '15'} Tickets)
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                onClick={() => {
                  setShowModal(false);
                  setShowInstructions(false);
                }}
              >
                Done
              </Button>
            )}
          </ModalFooter>
        </Modal>
      </>
    );
  }

  return null;
}