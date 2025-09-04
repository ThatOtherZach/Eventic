import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Ticket, 
  Calendar, 
  Zap, 
  ChevronLeft, 
  Activity, 
  Award,
  DollarSign,
  Gift,
  RefreshCw,
  Coins,
  Trophy,
  Hash,
  ThumbsUp,
  ThumbsDown,
  Shield
} from "lucide-react";
import starIcon from "@assets/world_star-0_1756849251180.png";
import specialEffectsIcon from "@assets/image_1756849316138.png";
import p2pIcon from "@assets/users_green-4_1756849357200.png";
import gpsIcon from "@assets/gps-1_1756849430189.png";
import calendarIcon from "@assets/calendar-0_1756849638733.png";
import ticketsIcon from "@assets/certificate_multiple-1_1756849669534.png";
import checkIcon from "@assets/check-0_1756849706987.png";
import demandIcon from "@assets/image_1756849793480.png";
import coreMetricsIcon from "@assets/image_1756850088693.png";
import distributionIcon from "@assets/image_1756850111300.png";
import statsIcon from "@assets/chart1-4_1756850194937.png";
import ticketingTrendsIcon from "@assets/image_1756851232451.png";
import tealBg from "@assets/win98-teal_1756850231196.png";
import hashtagIcon from "@assets/modem-4_1756868854727.png";
import { countries as allCountries } from "@/lib/countries";

export default function NerdStats() {
  const [selectedCountry, setSelectedCountry] = useState<string>('Global');

  // Fetch various stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stats");
      return response.json();
    },
    // No auto-refresh, only refresh on page load
  });

  const { data: demandData } = useQuery({
    queryKey: ["/api/currency/demand"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/demand");
      return response.json();
    },
    // No auto-refresh
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/analytics/dashboard", selectedCountry],
    queryFn: async () => {
      const params = selectedCountry && selectedCountry !== 'Global' 
        ? `?country=${encodeURIComponent(selectedCountry)}` 
        : '';
      const response = await apiRequest("GET", `/api/analytics/dashboard${params}`);
      return response.json();
    },
  });

  // Prepare chart data for ticket sales trend (2-day periods)
  const periodData = analyticsData?.charts?.ticketsByMonth ? 
    analyticsData.charts.ticketsByMonth.labels.map((label: string, index: number) => ({
      period: label,
      tickets: analyticsData.charts.ticketsByMonth.data[index]
    })) : [];

  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
    // No auto-refresh
  });

  const { data: tickets } = useQuery({
    queryKey: ["/api/user/tickets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/tickets");
      return response.json();
    },
    // No auto-refresh
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leaderboard");
      return response.json();
    },
  });

  // Get countries that have events
  const countriesWithEvents = useMemo(() => {
    if (!events) return new Set<string>();
    const countrySet = new Set<string>();
    events.forEach((event: any) => {
      if (event.country) countrySet.add(event.country);
    });
    return countrySet;
  }, [events]);

  // Filter events by selected country
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (selectedCountry === 'Global') return events;
    return events.filter((event: any) => event.country === selectedCountry);
  }, [events, selectedCountry]);

  // Calculate advanced stats
  const calculateStats = () => {
    if (!filteredEvents || !stats) return null;

    const now = new Date();
    const activeEvents = filteredEvents.filter((e: any) => new Date(e.date) > now);
    const pastEvents = filteredEvents.filter((e: any) => new Date(e.date) <= now);
    
    // Calculate average tickets per event
    const avgTicketsPerEvent = filteredEvents.length > 0 
      ? Math.round(stats.totalTickets / filteredEvents.length * 100) / 100 
      : 0;

    // Calculate validation rate
    const validationRate = stats.totalTickets > 0 
      ? Math.round((stats.validatedTickets / stats.totalTickets) * 10000) / 100 
      : 0;

    // Events by day of week
    const dayStats = filteredEvents.reduce((acc: any, event: any) => {
      const day = new Date(event.date).getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
      acc[dayName] = (acc[dayName] || 0) + 1;
      return acc;
    }, {});

    // Price statistics
    const ticketPrices = filteredEvents.map((e: any) => parseFloat(e.ticketPrice)).filter((p: any) => p > 0);
    const avgPrice = ticketPrices.length > 0 
      ? Math.round(ticketPrices.reduce((a: number, b: number) => a + b, 0) / ticketPrices.length * 100) / 100
      : 0;
    const maxPrice = ticketPrices.length > 0 ? Math.max(...ticketPrices) : 0;
    const minPrice = ticketPrices.length > 0 ? Math.min(...ticketPrices) : 0;

    // Badge statistics
    const featuredEvents = 0; // Featured events are tracked separately in featuredEvents table
    const specialEffectsEvents = filteredEvents.filter((e: any) => e.specialEffectsEnabled).length;
    const locationSpecificEvents = filteredEvents.filter((e: any) => e.geofence).length;
    const p2pEvents = filteredEvents.filter((e: any) => e.p2pValidation).length;

    // Ticket economy stats
    const freeEvents = filteredEvents.filter((e: any) => parseFloat(e.ticketPrice) === 0).length;
    const paidEvents = filteredEvents.filter((e: any) => parseFloat(e.ticketPrice) > 0).length;
    const goldenTickets = tickets?.filter((t: any) => t.isGoldenTicket).length || 0;
    const resaleTickets = tickets?.filter((t: any) => t.resalePrice !== null).length || 0;

    return {
      activeEvents: activeEvents.length,
      pastEvents: pastEvents.length,
      avgTicketsPerEvent,
      validationRate,
      dayStats,
      avgPrice,
      maxPrice,
      minPrice,
      totalRevenue: Math.round(stats.totalTickets * 0.23 * 100) / 100,
      featuredEvents,
      specialEffectsEvents,
      locationSpecificEvents,
      p2pEvents,
      freeEvents,
      paidEvents,
      goldenTickets,
      resaleTickets,
    };
  };

  const advancedStats = calculateStats();

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };


  return (
    <div className="container py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Link to="/account" className="btn btn-sm btn-outline-secondary" data-testid="link-back-account">
              <ChevronLeft size={16} className="me-1" />
              Back
            </Link>
            <h1 className="h3 fw-bold mb-0 flex-grow-1">
              <img src={statsIcon} alt="Stats" className="me-2" style={{ width: 28, height: 28, verticalAlign: 'text-bottom' }} />
              Stats for Nerds
            </h1>
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-semibold mb-0">
              <img src={coreMetricsIcon} alt="Numbers & Stuff" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Numbers & Stuff
            </h5>
            <select 
              className="form-select" 
              style={{ width: '200px', fontSize: '14px', padding: '4px 8px', height: 'auto' }}
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <option value="Global">🌍 Global</option>
              {allCountries.filter(country => countriesWithEvents.has(country)).map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
              <optgroup label="All Countries">
                {allCountries.filter(country => !countriesWithEvents.has(country)).map(country => (
                  <option key={country} value={country} style={{ color: '#999' }}>{country}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Total Events</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={calendarIcon} alt="Calendar" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{formatNumber(stats?.totalEvents || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Total Tickets</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-start gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080',
                      marginTop: '2px'
                    }}>
                      <img src={ticketsIcon} alt="Tickets" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div>
                      <div className="h3 fw-bold mb-1" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{formatNumber(stats?.totalTickets || 0)}</div>
                      <div style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif', color: '#000000' }}>
                        {advancedStats?.avgTicketsPerEvent || 0} avg/event
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Ticket Demand</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-start gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080',
                      marginTop: '2px'
                    }}>
                      <img src={demandIcon} alt="Demand" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div>
                      <div className="h3 fw-bold mb-1" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{demandData?.demand || 0}</div>
                      <div style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif', color: '#000000' }}>
                        Tickets/hour
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Validation Rate</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={checkIcon} alt="Validation" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.validationRate || 0}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badge & Event Type Statistics */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Boosted Events</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={starIcon} alt="Star" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.featuredEvents || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Special Effects</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={specialEffectsIcon} alt="Special Effects" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.specialEffectsEvents || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>P2P Validation</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={p2pIcon} alt="P2P Validation" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.p2pEvents || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Location Specific</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <img src={gpsIcon} alt="Location Specific" style={{ width: 20, height: 20, display: 'block' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.locationSpecificEvents || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row g-3 mt-2">
            <div className="col-md-4">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Free Events</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <Gift size={20} style={{ color: '#000080' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.freeEvents || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Golden Tickets</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <Award size={20} style={{ color: '#FFD700' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>{advancedStats?.goldenTickets || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="h-100" style={{ 
                background: '#c0c0c0',
                border: '3px solid',
                borderColor: '#ffffff #000000 #000000 #ffffff',
                boxShadow: '1px 1px 0 #808080'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #000080, #1084d0)',
                  padding: '2px 4px',
                  marginBottom: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div className="text-white fw-bold" style={{ fontSize: '11px', fontFamily: 'Tahoma, sans-serif' }}>Average Price</div>
                  <div style={{ 
                    width: '13px', 
                    height: '11px', 
                    background: '#c0c0c0',
                    border: '1px solid',
                    borderColor: '#ffffff #000000 #000000 #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    cursor: 'pointer'
                  }}>×</div>
                </div>
                <div className="p-3" style={{ background: '#c0c0c0' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ 
                      padding: '4px',
                      background: '#ffffff',
                      border: '1px solid',
                      borderColor: '#808080 #ffffff #ffffff #808080'
                    }}>
                      <DollarSign size={20} style={{ color: '#000080' }} />
                    </div>
                    <div className="h3 fw-bold mb-0" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000080' }}>${(advancedStats?.avgPrice || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Distribution */}
      {analyticsData?.charts?.eventDistribution && analyticsData.charts.eventDistribution.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <h5 className="fw-semibold mb-3">
              <img src={distributionIcon} alt="Event Distribution" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Next 7 Days
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="row g-2">
                  {analyticsData.charts.eventDistribution.map((item: { date: string; count: number; badges?: any }) => {
                    const maxCount = 24;
                    const percentage = (item.count / maxCount) * 100;
                    
                    return (
                      <div key={item.date} className="col">
                        <div className="text-center">
                          <div className="text-muted small mb-1">{item.date}</div>
                          <div className="h5 fw-bold mb-2">{item.count}</div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Sales Trend and Top Hashtags */}
      {periodData.length > 0 && (
        <div className="row mb-4">
          <div className="col-md-8">
            <h5 className="fw-semibold mb-3">
              <img src={ticketingTrendsIcon} alt="Ticketing Trends" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Ticketing Trends
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `Period ending: ${value}`}
                      formatter={(value) => [`${value} tickets`, '2-Day Total']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tickets" 
                      stroke="#0d6efd" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#0d6efd' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <h5 className="fw-semibold mb-3">
              <img src={hashtagIcon} alt="Hashtags" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Top 10 Hashtags
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                {analyticsData?.charts?.topHashtags && analyticsData.charts.topHashtags.length > 0 ? (
                  <div className="list-group list-group-flush">
                    {analyticsData.charts.topHashtags.map((item: { hashtag: string; count: number }, index: number) => {
                      const rankEmoji = index === 0 ? '🔥' : (index + 1).toString();
                      const formattedHashtag = item.hashtag.charAt(0).toUpperCase() + item.hashtag.slice(1).toLowerCase();
                      return (
                        <div key={item.hashtag} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div className="d-flex align-items-center">
                            <span className="me-2" style={{ minWidth: '25px', fontSize: '16px' }}>{rankEmoji}</span>
                            <Link href={`/hashtag/${encodeURIComponent(item.hashtag)}`} className="text-decoration-none text-primary">
                              #{formattedHashtag}
                            </Link>
                          </div>
                          <span className="badge bg-light text-dark">{item.count} Events</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted text-center mb-0">No hashtags found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Section */}
      <div className="row mt-4">
        <div className="col-12">
          <h4 className="fw-semibold mb-3">
            <Trophy className="text-warning me-2" size={24} style={{ verticalAlign: 'text-bottom' }} />
            Reputation Leaderboard - Top 100 Users
            {selectedCountry !== 'Global' && ` (${selectedCountry})`}
          </h4>
          <div className="card shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                      <th>User</th>
                      <th style={{ textAlign: 'center' }}>Validations</th>
                      <th style={{ textAlign: 'center' }}>Approval</th>
                      <th style={{ textAlign: 'center' }}>Badge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard && leaderboard.length > 0 ? (
                      leaderboard.map((user: any, index: number) => {
                        const totalVotes = user.thumbsUp + user.thumbsDown;
                        const getReputationBadge = (percentage: number | null, thumbsUp: number, thumbsDown: number) => {
                          const total = thumbsUp + thumbsDown;
                          
                          if (total === 0 || percentage === null) {
                            return { badge: "NPC", color: "#28a745" };
                          } else if (percentage >= 1 && percentage <= 49) {
                            return { badge: "Interesting", color: "#ffc107" };
                          } else if (percentage >= 50 && percentage <= 79) {
                            return { badge: "Nice", color: "#17a2b8" };
                          } else if (percentage >= 80) {
                            return { badge: "😎", color: null };
                          } else {
                            return { badge: "NPC", color: "#28a745" };
                          }
                        };
                        const reputationInfo = getReputationBadge(user.percentage, user.thumbsUp, user.thumbsDown);
                        const isTop3 = index < 3;
                        
                        return (
                          <tr key={user.userId}>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {isTop3 ? (
                                <div style={{ fontSize: '24px' }}>
                                  {index === 0 && '🥇'}
                                  {index === 1 && '🥈'}
                                  {index === 2 && '🥉'}
                                </div>
                              ) : (
                                <span style={{ fontWeight: '600', color: '#6c757d' }}>
                                  {index + 1}
                                </span>
                              )}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div className="d-flex align-items-center gap-2">
                                <Users size={20} className="text-muted" />
                                <div>
                                  <div style={{ fontWeight: '500' }}>
                                    {user.displayName}
                                  </div>
                                  <small className="text-muted">
                                    {user.memberStatus}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{ fontWeight: '600' }}>
                                {formatNumber(user.validatedCount)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: user.percentage !== null && user.percentage >= 80 
                                  ? '#28a745'
                                  : user.percentage !== null && user.percentage >= 50
                                  ? '#ffc107'
                                  : user.percentage !== null
                                  ? '#dc3545'
                                  : '#6c757d'
                              }}>
                                {user.percentage !== null ? `${user.percentage}%` : '—'}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {reputationInfo.badge === '😎' ? (
                                <span style={{ fontSize: '20px' }}>
                                  {reputationInfo.badge}
                                </span>
                              ) : (
                                <span className="badge" style={{
                                  backgroundColor: reputationInfo.color || '#6c757d',
                                  color: '#fff',
                                  fontSize: '11px',
                                  padding: '5px 10px',
                                  borderRadius: '0',
                                  fontWeight: '500'
                                }}>
                                  {reputationInfo.badge}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-5">
                          <div className="text-muted">
                            <Trophy size={48} className="mb-3 opacity-25" />
                            <p>No users with reputation yet</p>
                            <p className="small">Be the first to earn reputation by hosting or rating events!</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-muted small">
            <Shield size={16} className="me-1" style={{ verticalAlign: 'text-bottom' }} />
            Reputation resets every 69 days to keep things fresh and fair
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-5 pt-4 border-top">
        <p className="text-muted small">Designed by Saym Services Inc.</p>
      </div>

    </div>
  );
}