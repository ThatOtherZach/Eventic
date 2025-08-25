import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, Clock, MapPin } from "lucide-react";
import type { FeaturedEvent, Event } from "@shared/schema";

interface FeaturedEventsResponse {
  id: string;
  eventId: string;
  duration: string;
  startTime: string;
  endTime: string;
  pricePaid: string;
  isBumped: boolean;
  position: number;
  createdAt: string;
  event: Event;
  isPaid: boolean;
}

export function FeaturedCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  const { data: featuredEvents = [], isLoading } = useQuery<FeaturedEventsResponse[]>({
    queryKey: ["/api/featured-events"],
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes to update carousel
  });

  // Preload images for current and next slides only (RAM optimization)
  const preloadImage = useCallback((imageUrl: string) => {
    if (!imageUrl || preloadedImages.has(imageUrl)) return;
    
    const img = new Image();
    img.onload = () => {
      setPreloadedImages(prev => new Set(Array.from(prev).concat(imageUrl)));
    };
    img.src = imageUrl;
  }, [preloadedImages]);

  // Preload current and next slide images
  useEffect(() => {
    if (featuredEvents.length === 0) return;
    
    const currentEvent = featuredEvents[currentSlide];
    const nextEvent = featuredEvents[(currentSlide + 1) % featuredEvents.length];
    
    if (currentEvent?.event.imageUrl) {
      preloadImage(currentEvent.event.imageUrl);
    }
    if (nextEvent?.event.imageUrl && nextEvent !== currentEvent) {
      preloadImage(nextEvent.event.imageUrl);
    }
  }, [currentSlide, featuredEvents, preloadImage]);

  // Auto-rotate slides every 30 seconds
  useEffect(() => {
    if (featuredEvents.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredEvents.length);
    }, 30 * 1000); // 30 seconds

    return () => clearInterval(interval);
  }, [featuredEvents.length]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % featuredEvents.length);
  }, [featuredEvents.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + featuredEvents.length) % featuredEvents.length);
  }, [featuredEvents.length]);

  if (isLoading) {
    return (
      <div className="mb-5">
        <h3 className="h4 fw-semibold text-dark mb-3">
          <Star className="me-2 text-warning" size={20} />
          Featured Events
        </h3>
        <div className="bg-light rounded-3 p-4" style={{ height: "300px" }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading featured events...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (featuredEvents.length === 0) {
    return null; // Don't show section if no featured events
  }

  const currentEvent = featuredEvents[currentSlide];

  return (
    <div className="mb-5">
      <h3 className="h4 fw-semibold text-dark mb-3">
        <Star className="me-2 text-warning" size={20} />
        Featured Events
      </h3>
      
      <div className="position-relative">
        <div 
          className="card border-0 shadow-sm overflow-hidden"
          style={{ height: "345px" }}
          data-testid="featured-carousel"
        >
          {/* Event Image Background - Lazy Loading */}
          <div 
            className="card-img-top position-absolute w-100 h-100"
            style={{
              backgroundImage: (currentEvent.event.imageUrl && preloadedImages.has(currentEvent.event.imageUrl))
                ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${currentEvent.event.imageUrl})`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              willChange: 'background-image', // Optimize for transitions
              transition: 'background-image 0.3s ease-in-out', // Smooth transitions
            }}
          />
          
          {/* Content Overlay */}
          <div className="card-img-overlay d-flex flex-column justify-content-end text-white p-4">
            <div className="mb-2">
              <span className={`badge me-2 ${currentEvent.isPaid ? 'bg-warning text-dark' : 'bg-primary'}`}>
                <Star size={12} className="me-1" />
                {currentEvent.isPaid ? 'Featured' : 'Popular'}
              </span>
              {currentEvent.isPaid && currentEvent.isBumped && (
                <span className="badge bg-danger me-2">
                  ⚡ Bumped
                </span>
              )}
              {currentEvent.isPaid && (
                <span className="badge bg-success">
                  <Clock size={12} className="me-1" />
                  {currentEvent.duration.replace('hour', 'h')}
                </span>
              )}
            </div>
            
            <h4 className="card-title text-white fw-bold mb-2">
              {currentEvent.event.name}
            </h4>
            
            <div className="d-flex flex-wrap gap-3 mb-2">
              <div className="d-flex align-items-center">
                <MapPin size={16} className="me-1" />
                <small>{currentEvent.event.venue}</small>
              </div>
              <div className="d-flex align-items-center">
                <Clock size={16} className="me-1" />
                <small>
                  {new Date(currentEvent.event.date).toLocaleDateString()} at {currentEvent.event.time}
                </small>
              </div>
            </div>
            
            <div 
              className="card-text text-white-50 mb-3" 
              style={{ fontSize: "0.9rem" }}
              dangerouslySetInnerHTML={{
                __html: currentEvent.event.description ? 
                  (currentEvent.event.description.length > 120 
                    ? currentEvent.event.description.substring(0, 120) + "..."
                    : currentEvent.event.description
                  )
                  : "Join us for this exciting event!"
              }}
            />
            
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="h5 text-white fw-bold mb-0">
                  ${currentEvent.event.ticketPrice}
                </span>
                <small className="text-white-50 ms-2">per ticket</small>
              </div>
              <button 
                className="btn btn-light"
                onClick={() => {
                  // TODO: Navigate to event details or ticket purchase
                  window.location.href = `/events/${currentEvent.event.id}`;
                }}
                data-testid="button-view-featured-event"
              >
                View Event
              </button>
            </div>
          </div>
        </div>
        
        {/* Navigation Controls */}
        {featuredEvents.length > 1 && (
          <>
            <button
              className="btn btn-dark btn-sm position-absolute top-50 start-0 translate-middle-y ms-2 rounded-circle"
              onClick={prevSlide}
              style={{ width: "40px", height: "40px", zIndex: 10 }}
              data-testid="button-carousel-prev"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="btn btn-dark btn-sm position-absolute top-50 end-0 translate-middle-y me-2 rounded-circle"
              onClick={nextSlide}
              style={{ width: "40px", height: "40px", zIndex: 10 }}
              data-testid="button-carousel-next"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
        
        {/* Slide Indicators */}
        {featuredEvents.length > 1 && (
          <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3">
            <div className="d-flex gap-2">
              {featuredEvents.map((_, index) => (
                <button
                  key={index}
                  className={`btn btn-sm rounded-circle p-0 ${
                    index === currentSlide ? 'btn-light' : 'btn-outline-light'
                  }`}
                  style={{ width: "12px", height: "12px" }}
                  onClick={() => setCurrentSlide(index)}
                  data-testid={`button-slide-${index}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}