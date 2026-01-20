import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, Phone, Mail, Car, AlertTriangle, 
  CheckSquare, Package, FileText, Download, Printer,
  Loader2, Map, ExternalLink
} from "lucide-react";
import type { MissionBrief } from "@shared/missionBrief";

interface MissionBriefProps {
  projectId: number;
}

export function MissionBriefView({ projectId }: MissionBriefProps) {
  const { data: brief, isLoading, error } = useQuery<MissionBrief>({
    queryKey: ["/api/projects", projectId, "mission-brief"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mission-brief-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading mission brief...</span>
      </div>
    );
  }
  
  if (error || !brief) {
    return (
      <div className="text-center p-8 text-muted-foreground" data-testid="mission-brief-error">
        Unable to generate mission brief. Project data may be incomplete.
      </div>
    );
  }

  const handlePrint = () => window.print();
  const handleDownloadPdf = () => {
    window.open(`/api/projects/${projectId}/mission-brief/pdf`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:max-w-none" data-testid="mission-brief-view">
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Mission Brief</h1>
          <p className="text-muted-foreground">{brief.universalProjectId || `Project #${brief.projectId}`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-brief">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownloadPdf} data-testid="button-download-pdf">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">MISSION BRIEF</h1>
        <p className="text-lg">{brief.universalProjectId || `Project #${brief.projectId}`}</p>
        <p className="text-sm text-gray-500">Generated: {new Date(brief.generatedAt).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{brief.clientName || "Client not specified"}</p>
            <p>{brief.projectName || "Project not specified"}</p>
            <p className="mt-2">{brief.projectAddress || "Address not specified"}</p>
            {brief.distance && (
              <p className="text-sm text-muted-foreground mt-2">
                <Car className="w-4 h-4 inline mr-1" />
                {brief.distance} miles from {brief.dispatchLocation}
                {brief.estimatedDriveTime && ` • ${brief.estimatedDriveTime}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Client Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{brief.contact.name || "No contact specified"}</p>
            {brief.contact.phone && (
              <p className="flex items-center gap-2 mt-1">
                <Phone className="w-4 h-4" />
                <a href={`tel:${brief.contact.phone}`} className="text-blue-500 hover:underline">
                  {brief.contact.phone}
                </a>
              </p>
            )}
            {brief.contact.email && (
              <p className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                <a href={`mailto:${brief.contact.email}`} className="text-blue-500 hover:underline">
                  {brief.contact.email}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {brief.projectAddress && (
        <BuildingLocationCard address={brief.projectAddress} />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Scope Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brief.scopeSummary && <p className="mb-3">{brief.scopeSummary}</p>}
          <div className="flex gap-4 text-sm">
            <span><strong>{brief.areaCount}</strong> area{brief.areaCount !== 1 ? 's' : ''}</span>
            <span><strong>{brief.totalSqft.toLocaleString()}</strong> sqft total</span>
          </div>

          {brief.areas.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Area</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Sqft</th>
                    <th className="text-left p-2">Disciplines</th>
                    <th className="text-center p-2">LOD</th>
                  </tr>
                </thead>
                <tbody>
                  {brief.areas.map((area, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{area.name}</td>
                      <td className="p-2">{area.buildingType}</td>
                      <td className="p-2 text-right">{area.sqft.toLocaleString()}</td>
                      <td className="p-2">
                        {area.disciplines.map(d => (
                          <Badge key={d} variant="outline" className="mr-1 text-xs">
                            {d}
                          </Badge>
                        ))}
                      </td>
                      <td className="p-2 text-center">{area.lod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Site Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Occupied:</span>{' '}
              <strong>{brief.siteConditions.occupied === null ? 'Unknown' : brief.siteConditions.occupied ? 'Yes' : 'No'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Drop Ceilings:</span>{' '}
              <strong>{brief.siteConditions.dropCeilings || 'Unknown'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Hazardous Materials:</span>{' '}
              <strong>{brief.siteConditions.hazardousMaterials || 'Unknown'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Active Construction:</span>{' '}
              <strong>{brief.siteConditions.activeConstruction === null ? 'Unknown' : brief.siteConditions.activeConstruction ? 'Yes' : 'No'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Parking:</span>{' '}
              <strong>{brief.siteConditions.parkingAccess || 'Unknown'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Access Restrictions:</span>{' '}
              <strong>{brief.siteConditions.accessRestrictions || 'None noted'}</strong>
            </div>
          </div>

          {brief.siteConditions.additionalNotes && (
            <div className="mt-3 p-2 bg-muted rounded">
              <p className="text-sm"><strong>Additional Notes:</strong> {brief.siteConditions.additionalNotes}</p>
            </div>
          )}

          {brief.risks.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Risk Factors:</p>
              <div className="flex flex-wrap gap-2">
                {brief.risks.map((risk, i) => (
                  <Badge key={i} variant="destructive">{risk}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Special Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {brief.requirements.actScanning && (
              <Badge>ACT Scanning Required</Badge>
            )}
            {brief.requirements.georeferencing && (
              <Badge>Georeferencing Required</Badge>
            )}
            {brief.requirements.matterport && (
              <Badge>Matterport Capture</Badge>
            )}
            {brief.requirements.scanningOnly && (
              <Badge variant="outline">Scanning Only: {brief.requirements.scanningOnly}</Badge>
            )}
            {!brief.requirements.actScanning && 
             !brief.requirements.georeferencing && 
             !brief.requirements.matterport && 
             !brief.requirements.scanningOnly && (
              <span className="text-muted-foreground">Standard scan job</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Suggested Equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {brief.suggestedEquipment.map((item, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded" data-testid={`checkbox-equipment-${i}`} />
                {item}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {brief.projectNotes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{brief.projectNotes}</p>
          </CardContent>
        </Card>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-center text-sm text-gray-500">
        <p>Scan2Plan • {brief.universalProjectId || `Project #${brief.projectId}`} • Generated {new Date(brief.generatedAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function BuildingLocationCard({ address }: { address: string }) {
  const [satelliteError, setSatelliteError] = useState(false);
  const [roadmapError, setRoadmapError] = useState(false);
  const bothFailed = satelliteError && roadmapError;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="w-5 h-5" />
          Building Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bothFailed ? (
          <div className="bg-muted rounded-lg p-4 text-center">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">{address}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Maps could not be loaded. Use the button below to view in Google Maps.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`aspect-video rounded-lg overflow-hidden bg-muted ${satelliteError ? 'hidden' : ''}`}>
              <img 
                src={`/api/maps/static?center=${encodeURIComponent(address)}&size=600x400&maptype=satellite&zoom=18`}
                alt="Satellite view"
                className="w-full h-full object-cover"
                onError={() => setSatelliteError(true)}
                data-testid="map-satellite-view"
              />
            </div>
            <div className={`aspect-video rounded-lg overflow-hidden bg-muted ${roadmapError ? 'hidden' : ''}`}>
              <img 
                src={`/api/maps/static?center=${encodeURIComponent(address)}&size=600x400&maptype=roadmap&zoom=16`}
                alt="Road map view"
                className="w-full h-full object-cover"
                onError={() => setRoadmapError(true)}
                data-testid="map-road-view"
              />
            </div>
            {(satelliteError || roadmapError) && !bothFailed && (
              <div className="bg-muted rounded-lg p-4 flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">{address}</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')}
            data-testid="button-open-google-maps"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Google Maps
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Use "Street View" in Google Maps to see building imagery
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
