import * as authActions from "./actions.js";
import { campusSession } from "../../shared/api/campus-client.js";
import { useSignal } from "@preact/signals-react";
import { useState, useEffect } from "react";
export default function useSession({
  say,
  resetCabinet
}) {
  const {
    enablePush: subscribePush,
    stopDelivery,
    markRead,
    pushMode,
    payments,
    housing,
    grades,
    electives,
    wifi,
    owner,
    messages,
    teachingGroups,
    role,
    token,
    records,
    notes,
    reservations,
    avatars,
    busy,
    login,
    logout,
    refresh,
    assistantApi,
    assistantSendStream,
    perform,
    download,
    bookings,
    schedule,
    lessonChanges,
    scheduleRevision
  } = useState(() => campusSession(say, resetCabinet))[0];
  const connectionIssue = useSignal(false);
  async function reconnectCabinet() {
    return await authActions.reconnectCabinet({
      token,
      refresh,
      role,
      connectionIssue
    }, ...arguments);
  }
  useEffect(() => {
    void reconnectCabinet();
    const poll = setInterval(reconnectCabinet, 2000);
    return () => {
      clearInterval(poll);
      stopDelivery();
    };
  }, []);
  return {
    subscribePush,
    stopDelivery,
    markRead,
    pushMode,
    payments,
    housing,
    grades,
    electives,
    wifi,
    owner,
    messages,
    teachingGroups,
    role,
    token,
    records,
    notes,
    reservations,
    avatars,
    busy,
    login,
    logout,
    refresh,
    assistantApi,
    assistantSendStream,
    perform,
    download,
    bookings,
    schedule,
    lessonChanges,
    scheduleRevision,
    connectionIssue,
    reconnectCabinet
  };
}
