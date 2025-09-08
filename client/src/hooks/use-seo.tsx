import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  keywords?: string;
}

export function useSEO({
  title = "Eventic",
  description = "Create and manage events, generate tickets, and validate them via QR codes with Eventic - your complete event management platform.",
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  twitterCard = "summary_large_image",
  keywords = "events, tickets, event management, QR codes, event ticketing, event platform"
}: SEOProps = {}) {
  useEffect(() => {
    // Set page title
    const pageTitle = title === "Eventic" ? title : `Eventic - ${title}`;
    document.title = pageTitle;

    // Helper function to update or create meta tag
    const updateMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let tag = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (tag) {
        tag.setAttribute("content", content);
      } else {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, property);
        tag.setAttribute("content", content);
        document.head.appendChild(tag);
      }
    };

    // Update meta description
    updateMetaTag("description", description);
    
    // Update keywords
    updateMetaTag("keywords", keywords);

    // Update Open Graph tags
    if (ogTitle || title) {
      updateMetaTag("og:title", ogTitle || pageTitle, true);
    }
    if (ogDescription || description) {
      updateMetaTag("og:description", ogDescription || description, true);
    }
    if (ogImage) {
      updateMetaTag("og:image", ogImage, true);
    }
    if (ogUrl) {
      updateMetaTag("og:url", ogUrl, true);
    }
    updateMetaTag("og:type", "website", true);
    updateMetaTag("og:site_name", "Eventic", true);

    // Update Twitter Card tags
    updateMetaTag("twitter:card", twitterCard);
    if (ogTitle || title) {
      updateMetaTag("twitter:title", ogTitle || pageTitle);
    }
    if (ogDescription || description) {
      updateMetaTag("twitter:description", ogDescription || description);
    }
    if (ogImage) {
      updateMetaTag("twitter:image", ogImage);
    }

    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = "Eventic";
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogUrl, twitterCard, keywords]);
}

// Page-specific SEO configurations
export const SEO_CONFIG = {
  home: {
    title: "Eventic",
    description: "Discover and create amazing events with Eventic. Generate QR tickets, manage attendees, and build your event community.",
    keywords: "events, tickets, event management, QR codes, event platform, create events"
  },
  events: {
    title: "Browse Events",
    description: "Explore upcoming events in your area. Find concerts, conferences, meetups, and more on Eventic.",
    keywords: "upcoming events, local events, event discovery, tickets, things to do"
  },
  createEvent: {
    title: "Create Event",
    description: "Create your event in minutes. Generate QR tickets, manage capacity, and track attendance with Eventic.",
    keywords: "create event, event planning, ticket generation, event management"
  },
  editEvent: {
    title: "Edit Event",
    description: "Update your event details, manage tickets, and control settings on Eventic.",
    keywords: "edit event, manage event, update event, event settings"
  },
  myTickets: {
    title: "My Tickets",
    description: "View and manage all your event tickets in one place. Access QR codes and event details.",
    keywords: "my tickets, event tickets, ticket management, QR codes"
  },
  profile: {
    title: "Profile",
    description: "Manage your Eventic profile, view your events, and track your reputation.",
    keywords: "profile, account settings, user profile, event history"
  },
  admin: {
    title: "Admin Settings",
    description: "Manage platform settings, events, and system configuration.",
    keywords: "admin, settings, platform management, system configuration"
  },
  scanner: {
    title: "Validate",
    description: "Validate event tickets by scanning QR codes. Fast and secure ticket validation.",
    keywords: "QR scanner, ticket validation, scan tickets, event check-in"
  },
  map: {
    title: "Event Map",
    description: "Discover events near you on the interactive map. Find local happenings and activities.",
    keywords: "event map, local events, nearby events, event locations"
  },
  notifications: {
    title: "Notifications",
    description: "Stay updated with your event notifications and important updates.",
    keywords: "notifications, updates, event alerts, messages"
  },
  login: {
    title: "Login",
    description: "Sign in to your Eventic account to manage events and tickets.",
    keywords: "login, sign in, authentication, account access"
  },
  signup: {
    title: "Sign Up",
    description: "Create your free Eventic account and start organizing amazing events.",
    keywords: "sign up, register, create account, join eventic"
  },
  manifesto: {
    title: "Manifesto",
    description: "Learn about Eventic's mission, vision, and how our platform revolutionizes event management.",
    keywords: "manifesto, mission, vision, about us, event platform philosophy"
  }
};