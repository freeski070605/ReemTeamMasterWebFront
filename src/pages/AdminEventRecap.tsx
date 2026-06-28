import React, { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { EventRecapView } from "../components/events/EventRecapView";
import { ReemEvent, eventRepository } from "../utils/reemEventAdmin";

const AdminEventRecap: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event] = useState<ReemEvent | null>(() => (eventId ? eventRepository.get(eventId) : null));

  if (!event) return <Navigate to="/admin/events" replace />;

  return <EventRecapView event={event} admin />;
};

export default AdminEventRecap;
