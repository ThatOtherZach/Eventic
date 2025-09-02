import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, User, Hash, Trophy } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function RegistryPage() {
  const { data: registryRecords, isLoading } = useQuery({
    queryKey: ["/api/registry"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">NFT Registry</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">NFT Registry</h1>
        <p className="text-muted-foreground">
          A permanent collection of validated event tickets preserved as NFTs
        </p>
      </div>

      {!registryRecords || registryRecords.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground mb-2">No NFTs in the registry yet</p>
            <p className="text-sm text-muted-foreground">
              Validated tickets that have been minted as NFTs will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {registryRecords.map((record: any) => (
            <Link key={record.id} href={`/registry/${record.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                {record.eventImageUrl && (
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <img
                      src={record.eventImageUrl}
                      alt={record.eventName}
                      className="w-full h-full object-cover"
                    />
                    {record.ticketIsGolden && (
                      <Badge className="absolute top-2 right-2 bg-yellow-500">
                        Golden Ticket
                      </Badge>
                    )}
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{record.title}</CardTitle>
                  <CardDescription className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3" />
                      <span className="text-xs">Ticket #{record.ticketNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span className="text-xs">Owner: @{record.ownerUsername}</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{record.eventName}</h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{record.eventVenue}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3 h-3" />
                        <span>
                          {record.eventDate} at {record.eventTime}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {record.eventEventTypes && record.eventEventTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {record.eventEventTypes.map((type: string) => (
                        <Badge
                          key={type}
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: getEventTypeColor(type),
                            color: "white",
                          }}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Minted {format(new Date(record.mintedAt), "PPp")}
                    </p>
                    {record.ticketValidatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Validated {format(new Date(record.ticketValidatedAt), "PPp")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "Music": "#dc2626",
    "Sports": "#ea580c",
    "Comedy": "#ca8a04",
    "Theater": "#65a30d",
    "Art": "#16a34a",
    "Conference": "#059669",
    "Workshop": "#0891b2",
    "Festival": "#0284c7",
    "Party": "#2563eb",
    "Networking": "#4f46e5",
    "Charity": "#7c3aed",
    "Other": "#9333ea",
  };
  return colors[type] || "#6b7280";
}