import { useState, useEffect, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plane, 
  Truck, 
  Train, 
  Car, 
  Hotel, 
  Calculator, 
  Search, 
  Loader2,
  MapPin,
  DollarSign,
  Clock,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TRAVEL_MODES, CPQ_DISPATCH_LOCATIONS, type TravelMode } from "@shared/schema";

interface TravelPricingCalculatorProps {
  form: UseFormReturn<any>;
  projectAddress?: string;
}

const TRAVEL_MODE_LABELS: Record<TravelMode, { label: string; icon: any; description: string }> = {
  local: { 
    label: "NYC / Long Island", 
    icon: Train, 
    description: "Local technician, subway/transit, optional rental car" 
  },
  regional: { 
    label: "Greater Northeast", 
    icon: Truck, 
    description: "Company truck from dispatch location" 
  },
  flyout: { 
    label: "Fly-Out Job", 
    icon: Plane, 
    description: "Flights, hotels, and ground transport" 
  },
};

const DISPATCH_LABELS: Record<string, string> = {
  troy: "Troy, NY",
  brooklyn: "Brooklyn, NY",
  boise: "Boise, ID",
  denver: "Denver, CO",
  remote: "Remote/Other",
};

const COMMON_AIRPORTS = [
  { code: "JFK", name: "New York JFK" },
  { code: "EWR", name: "Newark" },
  { code: "LGA", name: "LaGuardia" },
  { code: "ALB", name: "Albany" },
  { code: "BOS", name: "Boston Logan" },
  { code: "PHL", name: "Philadelphia" },
  { code: "DCA", name: "Washington Reagan" },
  { code: "IAD", name: "Washington Dulles" },
  { code: "ORD", name: "Chicago O'Hare" },
  { code: "LAX", name: "Los Angeles" },
  { code: "SFO", name: "San Francisco" },
  { code: "MIA", name: "Miami" },
  { code: "DEN", name: "Denver" },
  { code: "SEA", name: "Seattle" },
  { code: "ATL", name: "Atlanta" },
];

export function TravelPricingCalculator({ form, projectAddress }: TravelPricingCalculatorProps) {
  const { toast } = useToast();
  const [isSearchingFlights, setIsSearchingFlights] = useState(false);
  
  const travelMode = form.watch("cpqTravel.travelMode") || "local";
  const scanDays = form.watch("cpqTravel.scanDays") || 1;
  
  const calculateLocalCost = useMemo(() => {
    const transit = form.watch("cpqTravel.localTransitCost") || 0;
    const rentalNeeded = form.watch("cpqTravel.localRentalCarNeeded");
    const rentalCost = form.watch("cpqTravel.localRentalCarCost") || 0;
    const rentalDays = form.watch("cpqTravel.localRentalDays") || 1;
    const mileage = form.watch("cpqTravel.localMileage") || 0;
    const mileageRate = form.watch("cpqTravel.localMileageRate") || 0.67;
    const parking = form.watch("cpqTravel.localParkingCost") || 0;
    const tolls = form.watch("cpqTravel.localTollsCost") || 0;
    const perDiem = form.watch("cpqTravel.perDiem") || 75;
    const days = form.watch("cpqTravel.scanDays") || 1;
    
    let total = transit + (perDiem * days);
    if (rentalNeeded) {
      total += (rentalCost * rentalDays) + (mileage * mileageRate) + parking + tolls;
    }
    return total;
  }, [
    form.watch("cpqTravel.localTransitCost"),
    form.watch("cpqTravel.localRentalCarNeeded"),
    form.watch("cpqTravel.localRentalCarCost"),
    form.watch("cpqTravel.localRentalDays"),
    form.watch("cpqTravel.localMileage"),
    form.watch("cpqTravel.localMileageRate"),
    form.watch("cpqTravel.localParkingCost"),
    form.watch("cpqTravel.localTollsCost"),
    form.watch("cpqTravel.perDiem"),
    form.watch("cpqTravel.scanDays"),
  ]);
  
  const calculateRegionalCost = useMemo(() => {
    const distance = form.watch("cpqTravel.distance") || 0;
    const mileageRate = form.watch("cpqTravel.truckMileageRate") || 0.67;
    const days = form.watch("cpqTravel.scanDays") || 1;
    const perDiem = form.watch("cpqTravel.perDiem") || 75;
    const overnightRequired = form.watch("cpqTravel.overnightRequired");
    const hotelCost = form.watch("cpqTravel.hotelCostRegional") || 0;
    const hotelNights = form.watch("cpqTravel.hotelNightsRegional") || 0;
    
    const driveCost = distance * 2 * mileageRate;
    const perDiemCost = days * perDiem;
    const hotelTotal = overnightRequired ? (hotelCost * hotelNights) : 0;
    
    return driveCost + perDiemCost + hotelTotal;
  }, [
    form.watch("cpqTravel.distance"),
    form.watch("cpqTravel.truckMileageRate"),
    form.watch("cpqTravel.scanDays"),
    form.watch("cpqTravel.perDiem"),
    form.watch("cpqTravel.overnightRequired"),
    form.watch("cpqTravel.hotelCostRegional"),
    form.watch("cpqTravel.hotelNightsRegional"),
  ]);
  
  const calculateFlyoutCost = useMemo(() => {
    const flightCost = form.watch("cpqTravel.flyoutFlightCost") || 0;
    const numTechnicians = form.watch("cpqTravel.flyoutNumTechnicians") || 1;
    const hotelCost = form.watch("cpqTravel.flyoutHotelCost") || 0;
    const hotelNights = form.watch("cpqTravel.flyoutHotelNights") || 0;
    const groundTransport = form.watch("cpqTravel.flyoutGroundTransport") || 0;
    const perDiem = form.watch("cpqTravel.flyoutPerDiem") || 75;
    const days = form.watch("cpqTravel.scanDays") || 1;
    const baggageFees = form.watch("cpqTravel.flyoutBaggageFees") || 0;
    
    const flightTotal = flightCost * numTechnicians;
    const hotelTotal = hotelCost * hotelNights * numTechnicians;
    const perDiemTotal = perDiem * days * numTechnicians;
    
    return flightTotal + hotelTotal + groundTransport + perDiemTotal + baggageFees;
  }, [
    form.watch("cpqTravel.flyoutFlightCost"),
    form.watch("cpqTravel.flyoutNumTechnicians"),
    form.watch("cpqTravel.flyoutHotelCost"),
    form.watch("cpqTravel.flyoutHotelNights"),
    form.watch("cpqTravel.flyoutGroundTransport"),
    form.watch("cpqTravel.flyoutPerDiem"),
    form.watch("cpqTravel.scanDays"),
    form.watch("cpqTravel.flyoutBaggageFees"),
  ]);
  
  const totalTravelCost = useMemo(() => {
    const customCost = form.watch("cpqTravel.customTravelCost");
    if (customCost !== undefined && customCost !== null && customCost > 0) {
      return customCost;
    }
    
    switch (travelMode) {
      case "local": return calculateLocalCost;
      case "regional": return calculateRegionalCost;
      case "flyout": return calculateFlyoutCost;
      default: return 0;
    }
  }, [travelMode, calculateLocalCost, calculateRegionalCost, calculateFlyoutCost, form.watch("cpqTravel.customTravelCost")]);
  
  useEffect(() => {
    form.setValue("cpqTravel.calculatedTravelCost", totalTravelCost);
  }, [totalTravelCost, form]);
  
  const searchFlightAndHotelPrices = async () => {
    const origin = form.watch("cpqTravel.flyoutOrigin");
    const destination = form.watch("cpqTravel.flyoutDestination");
    
    if (!origin || !destination) {
      toast({
        title: "Missing Information",
        description: "Please select both origin and destination airports.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSearchingFlights(true);
    
    try {
      const response = await apiRequest("POST", "/api/travel/search-prices", {
        origin,
        destination,
        projectAddress,
        scanDays,
      });
      
      const data = await response.json();
      
      if (data.flightEstimate) {
        form.setValue("cpqTravel.flyoutFlightCost", data.flightEstimate);
      }
      if (data.hotelEstimate) {
        form.setValue("cpqTravel.flyoutHotelCost", data.hotelEstimate);
      }
      if (data.flightSearchResults) {
        form.setValue("cpqTravel.flightSearchResults", data.flightSearchResults);
      }
      if (data.hotelSearchResults) {
        form.setValue("cpqTravel.hotelSearchResults", data.hotelSearchResults);
      }
      form.setValue("cpqTravel.searchTimestamp", new Date().toISOString());
      
      toast({
        title: "Prices Updated",
        description: `Found flight estimates ($${data.flightEstimate || 'N/A'}) and hotel estimates ($${data.hotelEstimate || 'N/A'}/night).`,
      });
    } catch (error) {
      console.error("Flight search error:", error);
      toast({
        title: "Search Failed",
        description: "Could not fetch flight/hotel prices. Please enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingFlights(false);
    }
  };
  
  const ModeIcon = TRAVEL_MODE_LABELS[travelMode as TravelMode]?.icon || Train;
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-2">Travel Mode</h3>
        <p className="text-xs text-muted-foreground mb-3">Select how your technician will get to this job site</p>
        
        <div className="grid grid-cols-3 gap-3">
          {TRAVEL_MODES.map((mode) => {
            const { label, icon: Icon, description } = TRAVEL_MODE_LABELS[mode];
            const isSelected = travelMode === mode;
            
            return (
              <Card 
                key={mode}
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => form.setValue("cpqTravel.travelMode", mode)}
                data-testid={`card-travel-mode-${mode}`}
              >
                <CardContent className="p-4 text-center">
                  <Icon className={`h-8 w-8 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="font-medium text-sm">{label}</div>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      
      <Separator />
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Scan Days On Site</Label>
          <Input
            type="number"
            min="1"
            value={scanDays}
            onChange={(e) => form.setValue("cpqTravel.scanDays", parseInt(e.target.value) || 1)}
            data-testid="input-scan-days"
          />
        </div>
        <div className="flex items-end">
          <Card className="flex-1 bg-primary/10 border-primary/20">
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total Travel Cost</span>
              </div>
              <span className="text-lg font-bold text-primary">
                ${totalTravelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Separator />
      
      {travelMode === "local" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Train className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">NYC / Long Island Travel</h4>
          </div>
          <p className="text-xs text-muted-foreground">Local technician uses subway/transit. Rental car available when needed for equipment or remote locations.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Transit/Subway Cost</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="15.00"
                value={form.watch("cpqTravel.localTransitCost") || ""}
                onChange={(e) => form.setValue("cpqTravel.localTransitCost", parseFloat(e.target.value) || 0)}
                data-testid="input-local-transit"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-md border">
            <Checkbox
              checked={form.watch("cpqTravel.localRentalCarNeeded") || false}
              onCheckedChange={(checked) => form.setValue("cpqTravel.localRentalCarNeeded", !!checked)}
              data-testid="checkbox-rental-car"
            />
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Rental Car Needed</span>
            </div>
          </div>
          
          {form.watch("cpqTravel.localRentalCarNeeded") && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Daily Rental Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="75.00"
                      value={form.watch("cpqTravel.localRentalCarCost") || ""}
                      onChange={(e) => form.setValue("cpqTravel.localRentalCarCost", parseFloat(e.target.value) || 0)}
                      data-testid="input-rental-cost"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rental Days</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={form.watch("cpqTravel.localRentalDays") || ""}
                      onChange={(e) => form.setValue("cpqTravel.localRentalDays", parseInt(e.target.value) || 1)}
                      data-testid="input-rental-days"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Estimated Mileage</Label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={form.watch("cpqTravel.localMileage") || ""}
                      onChange={(e) => form.setValue("cpqTravel.localMileage", parseFloat(e.target.value) || 0)}
                      data-testid="input-local-mileage"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Parking Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="25.00"
                      value={form.watch("cpqTravel.localParkingCost") || ""}
                      onChange={(e) => form.setValue("cpqTravel.localParkingCost", parseFloat(e.target.value) || 0)}
                      data-testid="input-parking"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tolls</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="20.00"
                      value={form.watch("cpqTravel.localTollsCost") || ""}
                      onChange={(e) => form.setValue("cpqTravel.localTollsCost", parseFloat(e.target.value) || 0)}
                      data-testid="input-tolls"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {travelMode === "regional" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">Greater Northeast (Company Truck)</h4>
          </div>
          <p className="text-xs text-muted-foreground">Technician drives company truck from dispatch location. Includes mileage, per diem, and overnight stays if needed.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Dispatch Location</Label>
              <Select
                value={form.watch("cpqTravel.dispatchLocation") || "troy"}
                onValueChange={(value) => form.setValue("cpqTravel.dispatchLocation", value)}
              >
                <SelectTrigger data-testid="select-dispatch-location">
                  <SelectValue placeholder="Select dispatch" />
                </SelectTrigger>
                <SelectContent>
                  {CPQ_DISPATCH_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>{DISPATCH_LABELS[loc] || loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Distance to Site (one-way miles)</Label>
              <Input
                type="number"
                placeholder="175"
                value={form.watch("cpqTravel.distance") || ""}
                onChange={(e) => form.setValue("cpqTravel.distance", parseFloat(e.target.value) || 0)}
                data-testid="input-distance-regional"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Truck Mileage Rate ($/mile)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.67"
                value={form.watch("cpqTravel.truckMileageRate") || ""}
                onChange={(e) => form.setValue("cpqTravel.truckMileageRate", parseFloat(e.target.value) || 0.67)}
                data-testid="input-mileage-rate"
              />
            </div>
            <div>
              <Label className="text-xs">Per Diem ($/day)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="75.00"
                value={form.watch("cpqTravel.perDiem") || ""}
                onChange={(e) => form.setValue("cpqTravel.perDiem", parseFloat(e.target.value) || 75)}
                data-testid="input-per-diem"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-md border">
            <Checkbox
              checked={form.watch("cpqTravel.overnightRequired") || false}
              onCheckedChange={(checked) => form.setValue("cpqTravel.overnightRequired", !!checked)}
              data-testid="checkbox-overnight"
            />
            <div className="flex items-center gap-2">
              <Hotel className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Overnight Stay Required</span>
            </div>
          </div>
          
          {form.watch("cpqTravel.overnightRequired") && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Hotel Cost ($/night)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={form.watch("cpqTravel.hotelCostRegional") || ""}
                      onChange={(e) => form.setValue("cpqTravel.hotelCostRegional", parseFloat(e.target.value) || 0)}
                      data-testid="input-hotel-regional"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Number of Nights</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={form.watch("cpqTravel.hotelNightsRegional") || ""}
                      onChange={(e) => form.setValue("cpqTravel.hotelNightsRegional", parseInt(e.target.value) || 1)}
                      data-testid="input-nights-regional"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Drive Cost (round trip):</span>
                  <span>${((form.watch("cpqTravel.distance") || 0) * 2 * (form.watch("cpqTravel.truckMileageRate") || 0.67)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Per Diem ({scanDays} days):</span>
                  <span>${((form.watch("cpqTravel.perDiem") || 75) * scanDays).toFixed(2)}</span>
                </div>
                {form.watch("cpqTravel.overnightRequired") && (
                  <div className="flex justify-between">
                    <span>Hotel ({form.watch("cpqTravel.hotelNightsRegional") || 0} nights):</span>
                    <span>${((form.watch("cpqTravel.hotelCostRegional") || 0) * (form.watch("cpqTravel.hotelNightsRegional") || 0)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {travelMode === "flyout" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">Fly-Out Job</h4>
          </div>
          <p className="text-xs text-muted-foreground">Technician(s) fly to job site. Includes flights, hotels, ground transport, and per diem.</p>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Origin Airport</Label>
              <Select
                value={form.watch("cpqTravel.flyoutOrigin") || ""}
                onValueChange={(value) => form.setValue("cpqTravel.flyoutOrigin", value)}
              >
                <SelectTrigger data-testid="select-origin-airport">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_AIRPORTS.map((airport) => (
                    <SelectItem key={airport.code} value={airport.code}>
                      {airport.code} - {airport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Destination Airport</Label>
              <Select
                value={form.watch("cpqTravel.flyoutDestination") || ""}
                onValueChange={(value) => form.setValue("cpqTravel.flyoutDestination", value)}
              >
                <SelectTrigger data-testid="select-destination-airport">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_AIRPORTS.map((airport) => (
                    <SelectItem key={airport.code} value={airport.code}>
                      {airport.code} - {airport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Technicians Flying</Label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={form.watch("cpqTravel.flyoutNumTechnicians") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutNumTechnicians", parseInt(e.target.value) || 1)}
                data-testid="input-num-technicians"
              />
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={searchFlightAndHotelPrices}
            disabled={isSearchingFlights}
            className="w-full"
            data-testid="button-search-prices"
          >
            {isSearchingFlights ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching prices...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Flight & Hotel Prices
              </>
            )}
          </Button>
          
          {form.watch("cpqTravel.searchTimestamp") && (
            <p className="text-xs text-muted-foreground text-center">
              Last searched: {new Date(form.watch("cpqTravel.searchTimestamp")).toLocaleString()}
            </p>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Flight Cost (per person)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="450.00"
                value={form.watch("cpqTravel.flyoutFlightCost") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutFlightCost", parseFloat(e.target.value) || 0)}
                data-testid="input-flight-cost"
              />
            </div>
            <div>
              <Label className="text-xs">Baggage/Equipment Fees</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="150.00"
                value={form.watch("cpqTravel.flyoutBaggageFees") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutBaggageFees", parseFloat(e.target.value) || 0)}
                data-testid="input-baggage-fees"
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Hotel Cost ($/night)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="175.00"
                value={form.watch("cpqTravel.flyoutHotelCost") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutHotelCost", parseFloat(e.target.value) || 0)}
                data-testid="input-hotel-cost-flyout"
              />
            </div>
            <div>
              <Label className="text-xs">Number of Nights</Label>
              <Input
                type="number"
                min="1"
                placeholder="2"
                value={form.watch("cpqTravel.flyoutHotelNights") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutHotelNights", parseInt(e.target.value) || 1)}
                data-testid="input-hotel-nights-flyout"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Ground Transport (rental/Uber)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="200.00"
                value={form.watch("cpqTravel.flyoutGroundTransport") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutGroundTransport", parseFloat(e.target.value) || 0)}
                data-testid="input-ground-transport"
              />
            </div>
            <div>
              <Label className="text-xs">Per Diem ($/day)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="75.00"
                value={form.watch("cpqTravel.flyoutPerDiem") || ""}
                onChange={(e) => form.setValue("cpqTravel.flyoutPerDiem", parseFloat(e.target.value) || 75)}
                data-testid="input-per-diem-flyout"
              />
            </div>
          </div>
          
          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Flights ({form.watch("cpqTravel.flyoutNumTechnicians") || 1} person(s)):</span>
                  <span>${((form.watch("cpqTravel.flyoutFlightCost") || 0) * (form.watch("cpqTravel.flyoutNumTechnicians") || 1)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Baggage Fees:</span>
                  <span>${(form.watch("cpqTravel.flyoutBaggageFees") || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hotels ({form.watch("cpqTravel.flyoutHotelNights") || 0} nights x {form.watch("cpqTravel.flyoutNumTechnicians") || 1} rooms):</span>
                  <span>${((form.watch("cpqTravel.flyoutHotelCost") || 0) * (form.watch("cpqTravel.flyoutHotelNights") || 0) * (form.watch("cpqTravel.flyoutNumTechnicians") || 1)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ground Transport:</span>
                  <span>${(form.watch("cpqTravel.flyoutGroundTransport") || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Per Diem ({scanDays} days x {form.watch("cpqTravel.flyoutNumTechnicians") || 1} person(s)):</span>
                  <span>${((form.watch("cpqTravel.flyoutPerDiem") || 75) * scanDays * (form.watch("cpqTravel.flyoutNumTechnicians") || 1)).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Separator />
      
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Custom Override (optional)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Leave empty to use calculated total"
            value={form.watch("cpqTravel.customTravelCost") || ""}
            onChange={(e) => {
              const val = e.target.value;
              form.setValue("cpqTravel.customTravelCost", val ? parseFloat(val) : undefined);
            }}
            data-testid="input-custom-travel-cost"
          />
          <p className="text-xs text-muted-foreground mt-1">Enter a value to override the calculated travel cost</p>
        </div>
        
        <div>
          <Label className="text-xs">Travel Notes</Label>
          <Textarea
            placeholder="Special travel considerations, contact information, etc."
            value={form.watch("cpqTravel.travelNotes") || ""}
            onChange={(e) => form.setValue("cpqTravel.travelNotes", e.target.value)}
            className="resize-none"
            rows={2}
            data-testid="input-travel-notes"
          />
        </div>
      </div>
    </div>
  );
}
