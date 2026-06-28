import React, { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { EventForm } from "../components/events/EventForm";
import { useAuthStore } from "../store/authStore";
import { ReemEvent, ReemEventStatus, createEmptyEvent, eventRepository } from "../utils/reemEventAdmin";

const AdminEventEdit: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [event] = useState<ReemEvent | null>(() => {
    if (!eventId || eventId === "new") return createEmptyEvent(user?._id);
    return eventRepository.get(eventId);
  });

  if (!event) return <Navigate to="/admin/events" replace />;

  const handleSubmit = (nextEvent: ReemEvent, status: ReemEventStatus) => {
    const saved = eventRepository.save({ ...nextEvent, status, adminId: user?._id ?? nextEvent.adminId });
    toast.success(`${saved.name} saved as ${status.replace(/_/g, " ")}.`);
    navigate(`/admin/events/${saved.id}`);
  };

  return (
    <div className="space-y-6">
      <section className="rt-panel-strong rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Event Builder</div>
        <h1 className="mt-3 text-4xl rt-page-title">{eventId === "new" ? "Create Event" : "Edit Event"}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/68">
          Friday Night Reem is live. Pull up, take a seat, and win the crib.
        </p>
      </section>
      <section className="rt-panel-strong rounded-[28px] border border-white/10 p-5 md:p-6">
        <EventForm event={event} onSubmit={handleSubmit} />
      </section>
    </div>
  );
};

export default AdminEventEdit;
