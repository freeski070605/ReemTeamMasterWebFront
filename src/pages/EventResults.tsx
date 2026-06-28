import React, { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { EventRecapView } from "../components/events/EventRecapView";
import { ReemEvent, eventRepository } from "../utils/reemEventAdmin";

const EventResults: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event] = useState<ReemEvent | null>(() => (slug ? eventRepository.get(slug) : null));

  if (!event) return <Navigate to="/tables" replace />;

  return <EventRecapView event={event} />;
};

export default EventResults;
